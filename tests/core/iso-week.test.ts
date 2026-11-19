import test from 'node:test'
import assert from 'node:assert/strict'
import {
  currentWeekYear,
  formatWeekSpan,
  getISOWeeksInYear,
  getISOWeekYear,
  isValidISOWeek,
  nextWeekYear,
  prevWeekYear,
  shiftWeekYear,
  weeksInRange,
} from '../../lib/dateUtils'
import { dateForDayInWeek } from '../../lib/shiftDate'
import { saveShift } from '../../lib/scheduler'

test('identifies ISO week-years with 52 and 53 weeks', () => {
  assert.equal(getISOWeeksInYear(2025), 52)
  assert.equal(getISOWeeksInYear(2026), 53)
  assert.equal(getISOWeeksInYear(2027), 52)
  assert.equal(getISOWeeksInYear(2028), 52)
})

test('rejects week 53 for a 52-week year but accepts it for 2026', () => {
  assert.equal(isValidISOWeek(53, 2025), false)
  assert.equal(isValidISOWeek(53, 2026), true)
  assert.equal(isValidISOWeek(53, 2027), false)
  assert.equal(isValidISOWeek(53, 2028), false)
  assert.equal(isValidISOWeek(0, 2026), false)
  assert.equal(isValidISOWeek(1.5, 2026), false)
})

test('navigates forward through ISO week 53 and into the next week-year', () => {
  assert.deepEqual(nextWeekYear(52, 2026), { week: 53, year: 2026 })
  assert.deepEqual(nextWeekYear(53, 2026), { week: 1, year: 2027 })
  assert.deepEqual(nextWeekYear(52, 2025), { week: 1, year: 2026 })
  assert.deepEqual(nextWeekYear(52, 2027), { week: 1, year: 2028 })
})

test('navigates backward from week one using the previous ISO week-year length', () => {
  assert.deepEqual(prevWeekYear(1, 2027), { week: 53, year: 2026 })
  assert.deepEqual(prevWeekYear(1, 2026), { week: 52, year: 2025 })
  assert.deepEqual(prevWeekYear(1, 2028), { week: 52, year: 2027 })
})

test('shifts one, four and thirteen weeks across ISO week-year boundaries', () => {
  assert.deepEqual(shiftWeekYear(53, 2026, 1), { week: 1, year: 2027 })
  assert.deepEqual(shiftWeekYear(51, 2026, 4), { week: 2, year: 2027 })
  assert.deepEqual(shiftWeekYear(45, 2026, 13), { week: 5, year: 2027 })
  assert.deepEqual(shiftWeekYear(1, 2027, -1), { week: 53, year: 2026 })
  assert.deepEqual(shiftWeekYear(2, 2027, -4), { week: 51, year: 2026 })
  assert.deepEqual(shiftWeekYear(5, 2027, -13), { week: 45, year: 2026 })
})

test('builds ranges that retain week 53 instead of skipping it', () => {
  assert.deepEqual(weeksInRange(52, 2026, 4), [
    { week: 52, year: 2026 },
    { week: 53, year: 2026 },
    { week: 1, year: 2027 },
    { week: 2, year: 2027 },
  ])
})

test('maps every day from 28 December 2026 through 3 January 2027 to ISO week 53 of 2026', () => {
  const expectedDates = [
    '2026-12-28', '2026-12-29', '2026-12-30', '2026-12-31',
    '2027-01-01', '2027-01-02', '2027-01-03',
  ]
  const days = ['maandag', 'dinsdag', 'woensdag', 'donderdag', 'vrijdag', 'zaterdag', 'zondag'] as const

  assert.deepEqual(days.map(day => dateForDayInWeek(day, 53, 2026)), expectedDates)
  for (const date of expectedDates) {
    const [year, month, day] = date.split('-').map(Number)
    assert.deepEqual(getISOWeekYear(new Date(Date.UTC(year, month - 1, day, 12))), { week: 53, year: 2026 })
  }
})

test('maps the 2027 to 2028 boundary to the correct ISO year', () => {
  assert.deepEqual(getISOWeekYear(new Date(2028, 0, 1, 12)), { week: 52, year: 2027 })
  assert.deepEqual(getISOWeekYear(new Date(2028, 0, 2, 12)), { week: 52, year: 2027 })
  assert.deepEqual(getISOWeekYear(new Date(2028, 0, 3, 12)), { week: 1, year: 2028 })
  assert.equal(dateForDayInWeek('zaterdag', 52, 2027), '2028-01-01')
  assert.equal(dateForDayInWeek('maandag', 1, 2028), '2028-01-03')
})

test('uses Amsterdam calendar days for the current week on a UTC server', () => {
  assert.deepEqual(currentWeekYear(new Date('2026-12-27T23:30:00Z')), { week: 53, year: 2026 })
  assert.deepEqual(currentWeekYear(new Date('2027-01-03T23:30:00Z')), { week: 1, year: 2027 })
  assert.deepEqual(currentWeekYear(new Date('2028-01-02T23:30:00Z')), { week: 1, year: 2028 })
})

test('shows both ISO years in labels that cross New Year', () => {
  assert.equal(formatWeekSpan(52, 2026, 4), 'Wk 52–2 · 2026–2027')
  assert.equal(formatWeekSpan(52, 2027, 4), 'Wk 52–3 · 2027–2028')
  assert.equal(formatWeekSpan(1, 2028, 4), 'Wk 1–4 · 2028')
})

test('rejects a new shift in non-existent week 53 before any database access', async () => {
  assert.deepEqual(await saveShift({ week_number: 53, year: 2027 }), {
    error: 'Ongeldige week voor dit jaar',
  })
  assert.deepEqual(await saveShift({ week_number: 53, year: 2028 }), {
    error: 'Ongeldige week voor dit jaar',
  })
})
