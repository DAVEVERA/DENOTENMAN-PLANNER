import { dateForDayInWeek } from './shiftDate'
import type { Shift, TimeLog } from '@/types'
import { WORK_TYPES } from '@/types'

export interface PlannedShiftHours {
  log_date: string
  clock_in: string | null
  clock_out: string | null
  break_minutes: number
}

function normalizeTime(value: string | null): string | null {
  return value ? value.slice(0, 5) : null
}

export function getPlannedShiftHours(shift: Shift): PlannedShiftHours {
  const isFullDay = Boolean(shift.full_day) || shift.shift_type === 'Hele dag'
  const scheduledClockIn = normalizeTime(shift.start_time)
  const scheduledClockOut = normalizeTime(shift.end_time)
  return {
    log_date: dateForDayInWeek(shift.day_of_week, shift.week_number, shift.year),
    clock_in: scheduledClockIn ?? (isFullDay ? '09:00' : null),
    clock_out: scheduledClockOut ?? (isFullDay ? '17:00' : null),
    break_minutes: shift.break_minutes ?? 0,
  }
}

function amsterdamDateAndTime(now: Date): { date: string; time: string } {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Amsterdam',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now)
  const value = (type: Intl.DateTimeFormatPartTypes) => parts.find(part => part.type === type)?.value ?? ''
  return {
    date: `${value('year')}-${value('month')}-${value('day')}`,
    time: `${value('hour')}:${value('minute')}`,
  }
}

export function isShiftReadyForHourConfirmation(shift: Shift, now = new Date()): boolean {
  if (shift.is_open === 1 || !shift.employee_id || !WORK_TYPES.includes(shift.shift_type)) return false

  const planned = getPlannedShiftHours(shift)
  const current = amsterdamDateAndTime(now)
  if (planned.log_date < current.date) return true
  if (planned.log_date > current.date) return false

  // Op de werkdag zelf pas na de geplande eindtijd. Zonder eindtijd wordt de
  // dienst vanaf de volgende dag beschikbaar, zodat vooraf indienen niet kan.
  return Boolean(planned.clock_out && current.time >= planned.clock_out)
}

export function latestTimeLogForShift(logs: TimeLog[], shiftId: number): TimeLog | null {
  const matches = logs.filter(log => log.shift_id === shiftId)
  if (!matches.length) return null
  return matches.sort((a, b) => {
    const revisionDiff = (b.submission_revision ?? 0) - (a.submission_revision ?? 0)
    if (revisionDiff) return revisionDiff
    return b.created_at.localeCompare(a.created_at)
  })[0]
}
