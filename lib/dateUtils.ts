import type { WeekInfo } from '@/types'

export function getISOWeek(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7))
  const y = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  return Math.ceil((((d.getTime() - y.getTime()) / 86400000) + 1) / 7)
}

export function getISOWeekYear(date: Date): { week: number; year: number } {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7))
  const y = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  return {
    week: Math.ceil((((d.getTime() - y.getTime()) / 86400000) + 1) / 7),
    year: d.getUTCFullYear(),
  }
}

export function currentWeekYear(): WeekInfo {
  return getISOWeekYear(new Date())
}

export function prevWeekYear(week: number, year: number): WeekInfo {
  if (week > 1) return { week: week - 1, year }
  return { week: 52, year: year - 1 }
}

export function nextWeekYear(week: number, year: number): WeekInfo {
  if (week < 52) return { week: week + 1, year }
  return { week: 1, year: year + 1 }
}

/** Returns all ISO week/year combos that overlap with a given month span */
export function weeksForMonths(
  startMonth: number, startYear: number, numMonths: number,
): WeekInfo[] {
  const seen = new Set<string>()
  const result: WeekInfo[] = []
  for (let m = 0; m < numMonths; m++) {
    let month = startMonth + m
    let year  = startYear
    while (month > 12) { month -= 12; year++ }
    const last   = new Date(year, month, 0)
    let cursor   = new Date(year, month - 1, 1)
    // step back to Monday of the first week
    cursor.setDate(cursor.getDate() - ((cursor.getDay() + 6) % 7))
    while (cursor <= last) {
      const { week, year: wy } = getISOWeekYear(cursor)
      const key = `${wy}-${week}`
      if (!seen.has(key)) { seen.add(key); result.push({ week, year: wy }) }
      cursor = new Date(cursor.getTime() + 7 * 86400000)
    }
  }
  return result
}

/** Format a date range for display */
export function fmtDateRange(from: string, to: string): string {
  const a = new Date(from), b = new Date(to)
  const opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' }
  if (from === to) return a.toLocaleDateString('nl-NL', opts)
  return `${a.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })} – ${b.toLocaleDateString('nl-NL', opts)}`
}

/** Compute hours worked from clock_in, clock_out, break_minutes */
export function calcHoursWorked(
  clockIn: string | null, clockOut: string | null, breakMinutes: number,
): number {
  if (!clockIn || !clockOut) return 0
  const [ih, im] = clockIn.split(':').map(Number)
  const [oh, om] = clockOut.split(':').map(Number)
  const totalMin = (oh * 60 + om) - (ih * 60 + im) - breakMinutes
  return Math.max(0, Math.round(totalMin) / 60)
}
