import { supabase, T, unwrap } from './db'
import { getWeekShifts, shiftHours, getISOWeek } from './scheduler'
import { getLeaveRequests } from './leave'
import type { Shift, Day, Location, LeaveRequest } from '@/types'
import { DAYS } from '@/types'

// ─── Types ────────────────────────────────────────────────────────────────────

export type WarningSeverity = 'error' | 'warning' | 'info'
export type WarningType =
  | 'duplicate'
  | 'leave_conflict'
  | 'max_hours'
  | 'rest_time'
  | 'understaffed'
  | 'overstaffed'

export interface GuardrailWarning {
  type: WarningType
  severity: WarningSeverity
  message: string
  employeeId?: number
  employeeName?: string
  day?: Day
  details?: Record<string, unknown>
}

// ─── Configuration ────────────────────────────────────────────────────────────

const DEFAULT_MAX_WEEKLY_HOURS = 40
const MIN_REST_HOURS = 11 // CAO-norm: minimaal 11 uur tussen twee diensten

// ─── Time helpers ─────────────────────────────────────────────────────────────

function timeToMinutes(t: string | null): number | null {
  if (!t) return null
  const [h, m] = t.slice(0, 5).split(':').map(Number)
  return h * 60 + m
}

function shiftEndMinutes(s: Pick<Shift, 'start_time' | 'end_time' | 'full_day'>): number | null {
  if (s.full_day) return 17 * 60 // assume 17:00 for full-day
  return timeToMinutes(s.end_time)
}

function shiftStartMinutes(s: Pick<Shift, 'start_time' | 'end_time' | 'full_day'>): number | null {
  if (s.full_day) return 9 * 60 // assume 09:00 for full-day
  return timeToMinutes(s.start_time)
}

// ─── Duplicate detection ──────────────────────────────────────────────────────

function checkDuplicate(
  shift: Partial<Shift>,
  existing: Shift[],
): GuardrailWarning | null {
  if (!shift.employee_id) return null

  const overlapping = existing.filter(s => {
    if (s.employee_id !== shift.employee_id) return false
    if (s.day_of_week !== shift.day_of_week) return false
    if (s.id && shift.id && s.id === shift.id) return false // same shift

    // Full-day always conflicts
    if (shift.full_day || s.full_day) return true

    // Time overlap check
    const newStart = timeToMinutes(shift.start_time ?? null)
    const newEnd   = timeToMinutes(shift.end_time ?? null)
    const exStart  = timeToMinutes(s.start_time)
    const exEnd    = timeToMinutes(s.end_time)

    if (newStart === null || newEnd === null || exStart === null || exEnd === null) return false
    return newStart < exEnd && newEnd > exStart
  })

  if (overlapping.length > 0) {
    return {
      type: 'duplicate',
      severity: 'error',
      message: `${shift.employee_name ?? 'Medewerker'} is al ingepland op ${shift.day_of_week} in dit tijdslot`,
      employeeId: shift.employee_id,
      employeeName: shift.employee_name ?? undefined,
      day: shift.day_of_week as Day,
      details: { conflictingShiftIds: overlapping.map(s => s.id) },
    }
  }
  return null
}

// ─── Leave conflict detection ─────────────────────────────────────────────────

function dateForDayInWeek(day: Day, week: number, year: number): string {
  const jan4 = new Date(year, 0, 4)
  const dayOfWeek = jan4.getDay() || 7
  const weekStart = new Date(jan4)
  weekStart.setDate(jan4.getDate() - dayOfWeek + 1 + (week - 1) * 7)
  const dayIdx = DAYS.indexOf(day)
  weekStart.setDate(weekStart.getDate() + dayIdx)
  return weekStart.toISOString().slice(0, 10)
}

function checkLeaveConflict(
  shift: Partial<Shift>,
  leaveRequests: LeaveRequest[],
): GuardrailWarning | null {
  if (!shift.employee_id || !shift.week_number || !shift.year || !shift.day_of_week) return null

  const shiftDate = dateForDayInWeek(shift.day_of_week as Day, shift.week_number, shift.year)

  const conflicting = leaveRequests.find(lr =>
    lr.employee_id === shift.employee_id &&
    lr.status === 'approved' &&
    shiftDate >= lr.start_date &&
    shiftDate <= lr.end_date,
  )

  if (conflicting) {
    return {
      type: 'leave_conflict',
      severity: 'warning',
      message: `${shift.employee_name ?? 'Medewerker'} heeft goedgekeurd ${conflicting.leave_type.toLowerCase()} op ${shift.day_of_week}`,
      employeeId: shift.employee_id,
      employeeName: shift.employee_name ?? undefined,
      day: shift.day_of_week as Day,
      details: { leaveId: conflicting.id, leaveType: conflicting.leave_type },
    }
  }
  return null
}

// ─── Max weekly hours ─────────────────────────────────────────────────────────

function checkMaxHours(
  shift: Partial<Shift>,
  weekShifts: Shift[],
  maxHours = DEFAULT_MAX_WEEKLY_HOURS,
): GuardrailWarning | null {
  if (!shift.employee_id) return null

  const empShifts = weekShifts.filter(
    s => s.employee_id === shift.employee_id && s.id !== shift.id,
  )

  const currentHours = empShifts.reduce((sum, s) => sum + shiftHours(s), 0)
  const newHours = shiftHours(shift as Shift)
  const totalHours = currentHours + newHours

  if (totalHours > maxHours) {
    return {
      type: 'max_hours',
      severity: 'warning',
      message: `${shift.employee_name ?? 'Medewerker'} komt op ${totalHours.toFixed(1)} uur deze week (max: ${maxHours}u)`,
      employeeId: shift.employee_id,
      employeeName: shift.employee_name ?? undefined,
      details: { totalHours, maxHours, currentHours, newHours },
    }
  }
  return null
}

// ─── Rest time check ──────────────────────────────────────────────────────────

function checkRestTime(
  shift: Partial<Shift>,
  weekShifts: Shift[],
): GuardrailWarning | null {
  if (!shift.employee_id || !shift.day_of_week) return null

  const dayIdx = DAYS.indexOf(shift.day_of_week as Day)
  const prevDay = dayIdx > 0 ? DAYS[dayIdx - 1] : null
  const nextDay = dayIdx < 6 ? DAYS[dayIdx + 1] : null

  const empShifts = weekShifts.filter(s => s.employee_id === shift.employee_id && s.id !== shift.id)

  const newStart = shiftStartMinutes(shift as Shift)
  const newEnd   = shiftEndMinutes(shift as Shift)

  // Check previous day → current day rest
  if (prevDay && newStart !== null) {
    const prevShifts = empShifts.filter(s => s.day_of_week === prevDay)
    for (const ps of prevShifts) {
      const prevEnd = shiftEndMinutes(ps)
      if (prevEnd !== null) {
        const restMinutes = (24 * 60 - prevEnd) + newStart
        if (restMinutes < MIN_REST_HOURS * 60) {
          return {
            type: 'rest_time',
            severity: 'warning',
            message: `${shift.employee_name ?? 'Medewerker'} heeft minder dan ${MIN_REST_HOURS} uur rust tussen ${prevDay} en ${shift.day_of_week}`,
            employeeId: shift.employee_id,
            employeeName: shift.employee_name ?? undefined,
            day: shift.day_of_week as Day,
            details: { restHours: Math.round(restMinutes / 6) / 10 },
          }
        }
      }
    }
  }

  // Check current day → next day rest
  if (nextDay && newEnd !== null) {
    const nextShifts = empShifts.filter(s => s.day_of_week === nextDay)
    for (const ns of nextShifts) {
      const nextStart = shiftStartMinutes(ns)
      if (nextStart !== null) {
        const restMinutes = (24 * 60 - newEnd) + nextStart
        if (restMinutes < MIN_REST_HOURS * 60) {
          return {
            type: 'rest_time',
            severity: 'warning',
            message: `${shift.employee_name ?? 'Medewerker'} heeft minder dan ${MIN_REST_HOURS} uur rust tussen ${shift.day_of_week} en ${nextDay}`,
            employeeId: shift.employee_id,
            employeeName: shift.employee_name ?? undefined,
            day: shift.day_of_week as Day,
            details: { restHours: Math.round(restMinutes / 6) / 10 },
          }
        }
      }
    }
  }

  return null
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Validate a single shift assignment against all guardrails.
 * Returns a list of warnings (may be empty).
 */
export async function validateShiftAssignment(
  shift: Partial<Shift>,
): Promise<GuardrailWarning[]> {
  const warnings: GuardrailWarning[] = []

  if (!shift.week_number || !shift.year) return warnings

  // Fetch existing data
  const [weekShifts, leaveRequests] = await Promise.all([
    getWeekShifts(shift.week_number, shift.year),
    shift.employee_id
      ? getLeaveRequests({ employee_id: shift.employee_id, status: 'approved' })
      : Promise.resolve([]),
  ])

  // Run all checks
  const dup = checkDuplicate(shift, weekShifts)
  if (dup) warnings.push(dup)

  const leave = checkLeaveConflict(shift, leaveRequests)
  if (leave) warnings.push(leave)

  const hours = checkMaxHours(shift, weekShifts)
  if (hours) warnings.push(hours)

  const rest = checkRestTime(shift, weekShifts)
  if (rest) warnings.push(rest)

  return warnings
}

/**
 * Validate an entire week for staffing issues.
 */
export async function validateWeek(
  week: number,
  year: number,
  location?: Location,
): Promise<GuardrailWarning[]> {
  const warnings: GuardrailWarning[] = []
  const shifts = await getWeekShifts(week, year, location)

  // Check staffing levels per day/shift-type
  const avgOccupancy = await getAverageOccupancy(week, year, location)

  for (const day of DAYS) {
    const dayShifts = shifts.filter(s => s.day_of_week === day && !s.is_open)
    const types = ['Ochtend', 'Middag', 'Avond'] as const

    for (const type of types) {
      const count = dayShifts.filter(s => s.shift_type === type).length
      const avg = avgOccupancy[day]?.[type.toLowerCase() as 'ochtend' | 'middag' | 'avond'] ?? 0

      if (avg > 0 && count < avg * 0.5) {
        warnings.push({
          type: 'understaffed',
          severity: 'warning',
          message: `${day} ${type.toLowerCase()}: ${count} medewerker${count !== 1 ? 's' : ''} ingepland (gemiddeld: ${avg.toFixed(0)})`,
          day,
          details: { shiftType: type, count, average: avg },
        })
      }

      if (avg > 0 && count > avg * 1.5 && count > avg + 1) {
        warnings.push({
          type: 'overstaffed',
          severity: 'info',
          message: `${day} ${type.toLowerCase()}: ${count} medewerker${count !== 1 ? 's' : ''} ingepland (gemiddeld: ${avg.toFixed(0)})`,
          day,
          details: { shiftType: type, count, average: avg },
        })
      }
    }
  }

  return warnings
}

/**
 * Get average occupancy from the previous 4 weeks for reference.
 */
async function getAverageOccupancy(
  currentWeek: number,
  currentYear: number,
  location?: Location,
): Promise<Record<string, { ochtend: number; middag: number; avond: number }>> {
  const result: Record<string, { ochtend: number; middag: number; avond: number }> = {}
  for (const day of DAYS) result[day] = { ochtend: 0, middag: 0, avond: 0 }

  let w = currentWeek
  let y = currentYear
  let weeksProcessed = 0

  for (let i = 0; i < 4; i++) {
    w--
    if (w < 1) { w = 52; y-- }

    const shifts = await getWeekShifts(w, y, location)
    if (shifts.length === 0) continue
    weeksProcessed++

    for (const s of shifts) {
      if (s.is_open || !result[s.day_of_week]) continue
      const type = s.shift_type.toLowerCase()
      if (type === 'ochtend') result[s.day_of_week].ochtend++
      else if (type === 'middag') result[s.day_of_week].middag++
      else if (type === 'avond') result[s.day_of_week].avond++
    }
  }

  if (weeksProcessed > 0) {
    for (const day of DAYS) {
      result[day].ochtend /= weeksProcessed
      result[day].middag  /= weeksProcessed
      result[day].avond   /= weeksProcessed
    }
  }

  return result
}
