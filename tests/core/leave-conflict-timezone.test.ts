import test from 'node:test'
import assert from 'node:assert/strict'
import { checkLeaveConflict } from '../../lib/guardrails'
import { dateForDayInWeek } from '../../lib/shiftDate'
import type { Day, LeaveRequest, Shift } from '../../types'

function leave(startDate: string, endDate: string): LeaveRequest {
  return {
    id: 1,
    employee_id: 7,
    employee_name: 'Test Employee',
    leave_type: 'Vakantie',
    start_date: startDate,
    end_date: endDate,
    note: null,
    status: 'approved',
    reviewed_by: null,
    reviewed_at: null,
    created_at: '2026-01-01T00:00:00.000Z',
  }
}

function shift(day: Day, week: number, year: number): Partial<Shift> {
  return {
    employee_id: 7,
    employee_name: 'Test Employee',
    day_of_week: day,
    week_number: week,
    year,
  }
}

test('detects the first and last approved leave day but not adjacent days', () => {
  const approvedLeave = leave('2026-07-14', '2026-07-16')

  assert.equal(checkLeaveConflict(shift('maandag', 29, 2026), [approvedLeave]), null)
  assert.equal(checkLeaveConflict(shift('dinsdag', 29, 2026), [approvedLeave])?.type, 'leave_conflict')
  assert.equal(checkLeaveConflict(shift('donderdag', 29, 2026), [approvedLeave])?.type, 'leave_conflict')
  assert.equal(checkLeaveConflict(shift('vrijdag', 29, 2026), [approvedLeave]), null)
})

test('detects approved leave across the calendar-year boundary inside ISO week 53', () => {
  const approvedLeave = leave('2026-12-31', '2027-01-02')

  assert.equal(checkLeaveConflict(shift('woensdag', 53, 2026), [approvedLeave]), null)
  assert.equal(checkLeaveConflict(shift('donderdag', 53, 2026), [approvedLeave])?.type, 'leave_conflict')
  assert.equal(checkLeaveConflict(shift('zaterdag', 53, 2026), [approvedLeave])?.type, 'leave_conflict')
  assert.equal(checkLeaveConflict(shift('zondag', 53, 2026), [approvedLeave]), null)
})

test('produces identical UTC calendar dates in UTC and Europe/Amsterdam during winter and daylight saving time', () => {
  const originalTimezone = process.env.TZ
  const cases: Array<[Day, number, number]> = [
    ['zondag', 13, 2026],
    ['zondag', 43, 2026],
    ['donderdag', 53, 2026],
    ['zondag', 53, 2026],
  ]

  try {
    process.env.TZ = 'UTC'
    const utcDates = cases.map(args => dateForDayInWeek(...args))
    process.env.TZ = 'Europe/Amsterdam'
    const amsterdamDates = cases.map(args => dateForDayInWeek(...args))

    assert.deepEqual(utcDates, ['2026-03-29', '2026-10-25', '2026-12-31', '2027-01-03'])
    assert.deepEqual(amsterdamDates, utcDates)
  } finally {
    if (originalTimezone === undefined) delete process.env.TZ
    else process.env.TZ = originalTimezone
  }
})

