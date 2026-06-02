import type { Day } from '@/types'
import { DAYS } from '@/types'

export function dateForDayInWeek(day: Day, week: number, year: number): string {
  const jan4 = new Date(Date.UTC(year, 0, 4))
  const weekStart = new Date(jan4)
  weekStart.setUTCDate(jan4.getUTCDate() - (jan4.getUTCDay() || 7) + 1 + (week - 1) * 7)
  weekStart.setUTCDate(weekStart.getUTCDate() + DAYS.indexOf(day))
  return weekStart.toISOString().slice(0, 10)
}

export function formatShiftDate(day: Day, week: number, year: number): string {
  const date = dateForDayInWeek(day, week, year)
  const [y, m, d] = date.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('nl-NL', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  })
}
