import { supabase, T, unwrap } from './db'
import type { TimeLog, Location, HoursSummary, Shift, Day } from '@/types'
import { DAYS, WORK_TYPES } from '@/types'
import { calcHoursWorked } from './dateUtils'

export async function logHours(
  data: Omit<TimeLog, 'id' | 'created_at'>, createdBy = '',
): Promise<TimeLog> {
  return unwrap<TimeLog>(await supabase
    .from(T('time_logs'))
    .insert({ ...data, created_by: createdBy })
    .select()
    .single())
}

export async function getTimeLogs(opts: {
  employee_id?: number
  from?: string
  to?: string
  location?: Location
  is_processed?: number
}): Promise<TimeLog[]> {
  let q = supabase.from(T('time_logs')).select('*').order('log_date', { ascending: false })
  if (opts.employee_id) q = q.eq('employee_id', opts.employee_id)
  if (opts.from) q = q.gte('log_date', opts.from)
  if (opts.to) q = q.lte('log_date', opts.to)
  if (opts.location && opts.location !== 'both') q = q.eq('location', opts.location)
  if (opts.is_processed !== undefined) q = q.eq('is_processed', opts.is_processed)
  return unwrap<TimeLog[]>(await q)
}

export async function getExportTimeLogs(opts: {
  employee_id?: number
  from?: string
  to?: string
  location?: Location
  is_processed?: number
}): Promise<TimeLog[]> {
  const logs = await getTimeLogs(opts)
  const plannedLogs = await getPlannedShiftLogs(opts, logs)

  return [...logs, ...plannedLogs].sort((a, b) =>
    a.log_date === b.log_date
      ? a.employee_name.localeCompare(b.employee_name)
      : a.log_date.localeCompare(b.log_date),
  )
}

async function getPlannedShiftLogs(
  opts: {
    employee_id?: number
    from?: string
    to?: string
    location?: Location
    is_processed?: number
  },
  existingLogs: TimeLog[],
): Promise<TimeLog[]> {
  if (!opts.from || !opts.to || opts.is_processed === 1) return []

  const weeks = weeksInRange(opts.from, opts.to)
  if (!weeks.length) return []

  const shifts: Shift[] = []
  const weeksByYear = new Map<number, number[]>()
  for (const { week, year } of weeks) {
    weeksByYear.set(year, [...(weeksByYear.get(year) ?? []), week])
  }

  for (const [year, yearWeeks] of weeksByYear) {
    let q = supabase
      .from(T('shifts'))
      .select('*')
      .eq('year', year)
      .in('week_number', yearWeeks)
      .eq('is_open', 0)
      .not('employee_id', 'is', null)

    if (opts.employee_id) q = q.eq('employee_id', opts.employee_id)
    if (opts.location && opts.location !== 'both') q = q.eq('location', opts.location)

    shifts.push(...unwrap<Shift[]>(await q))
  }

  const loggedShiftIds = new Set(existingLogs.map(l => l.shift_id).filter((id): id is number => id !== null))
  const loggedEmployeeDates = new Set(existingLogs.map(l => `${l.employee_id}:${l.log_date}`))

  return shifts
    .map(shiftToTimeLog)
    .filter((log): log is TimeLog => Boolean(log))
    .filter(log => log.log_date >= opts.from! && log.log_date <= opts.to!)
    .filter(log => !loggedShiftIds.has(log.shift_id!))
    .filter(log => !loggedEmployeeDates.has(`${log.employee_id}:${log.log_date}`))
}

function shiftToTimeLog(shift: Shift): TimeLog | null {
  if (!shift.employee_id || !WORK_TYPES.includes(shift.shift_type)) return null

  const logDate = dateForDayInWeek(shift.day_of_week, shift.week_number, shift.year)
  const fullDay = Boolean(shift.full_day)
  const clockIn = fullDay ? '09:00:00' : normalizeTime(shift.start_time)
  const clockOut = fullDay ? '17:00:00' : normalizeTime(shift.end_time)

  return {
    id: -shift.id,
    employee_id: shift.employee_id,
    employee_name: shift.employee_name,
    log_date: logDate,
    location: shift.location,
    clock_in: clockIn,
    clock_out: clockOut,
    break_minutes: shift.break_minutes ?? 0,
    overtime_hours: shift.shift_type === 'Overwerk' || shift.shift_category === 'overtime'
      ? calcHoursWorked(clockIn, clockOut, shift.break_minutes ?? 0)
      : 0,
    shift_id: shift.id,
    note: shift.note ?? null,
    is_processed: 0,
    processed_at: null,
    created_by: shift.created_by,
    created_at: shift.created_at,
  }
}

function normalizeTime(value: string | null): string | null {
  if (!value) return null
  const time = value.slice(0, 8)
  return time.length === 5 ? `${time}:00` : time
}

function weeksInRange(from: string, to: string): Array<{ week: number; year: number }> {
  const start = parseDate(from)
  const end = parseDate(to)
  if (!start || !end || start > end) return []

  const weeks = new Map<string, { week: number; year: number }>()
  const cursor = new Date(start)

  while (cursor <= end) {
    const { week, year } = getISOWeekYear(cursor)
    weeks.set(`${year}-${week}`, { week, year })
    cursor.setUTCDate(cursor.getUTCDate() + 1)
  }

  return [...weeks.values()]
}

function parseDate(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null
  const [year, month, day] = value.split('-').map(Number)
  return new Date(Date.UTC(year, month - 1, day))
}

function getISOWeekYear(date: Date): { week: number; year: number } {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7))
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  return {
    week: Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7),
    year: d.getUTCFullYear(),
  }
}

function dateForDayInWeek(day: Day, week: number, year: number): string {
  const jan4 = new Date(Date.UTC(year, 0, 4))
  const weekStart = new Date(jan4)
  weekStart.setUTCDate(jan4.getUTCDate() - (jan4.getUTCDay() || 7) + 1 + (week - 1) * 7)
  weekStart.setUTCDate(weekStart.getUTCDate() + DAYS.indexOf(day))
  return weekStart.toISOString().slice(0, 10)
}

export async function updateTimeLog(id: number, data: Partial<TimeLog>): Promise<TimeLog> {
  return unwrap<TimeLog>(await supabase
    .from(T('time_logs')).update(data).eq('id', id).select().single())
}

export async function deleteTimeLog(id: number): Promise<boolean> {
  const { error } = await supabase.from(T('time_logs')).delete().eq('id', id)
  return !error
}

export async function markLogsProcessed(ids: number[]): Promise<void> {
  unwrap(await supabase
    .from(T('time_logs'))
    .update({ is_processed: 1, processed_at: new Date().toISOString() })
    .in('id', ids))
}

export async function getHoursSummary(
  from: string, to: string, location?: Location,
): Promise<HoursSummary[]> {
  const logs = await getTimeLogs({ from, to, location })

  const byEmp = new Map<number, { name: string; contract: number; logged: number; overtime: number }>()

  for (const log of logs) {
    const hours = calcHoursWorked(log.clock_in, log.clock_out, log.break_minutes)
    const existing = byEmp.get(log.employee_id)
    if (existing) {
      existing.logged   += hours
      existing.overtime += log.overtime_hours
    } else {
      byEmp.set(log.employee_id, {
        name:     log.employee_name,
        contract: 0,
        logged:   hours,
        overtime: log.overtime_hours,
      })
    }
  }

  return Array.from(byEmp.entries()).map(([id, v]) => ({
    employee_id:    id,
    employee_name:  v.name,
    contract_hours: v.contract,
    logged_hours:   Math.round(v.logged * 100) / 100,
    overtime_hours: Math.round(v.overtime * 100) / 100,
  }))
}
