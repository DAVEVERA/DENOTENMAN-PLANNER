import assert from 'node:assert/strict'
import { test } from 'node:test'

import { getPlannedShiftHours, isShiftReadyForHourConfirmation, latestTimeLogForShift } from '../../lib/shift-hours'
import type { Shift, TimeLog } from '../../types'

function shift(overrides: Partial<Shift> = {}): Shift {
  return {
    id: 42,
    employee_id: 7,
    employee_name: 'Medewerker',
    week_number: 31,
    year: 2026,
    day_of_week: 'vrijdag',
    shift_type: 'Ochtend',
    start_time: '09:00:00',
    end_time: '17:00:00',
    full_day: 0,
    buddy: null,
    note: null,
    admin_note: null,
    open_note: null,
    open_note_author_employee_id: null,
    opened_at: null,
    break_minutes: 30,
    location: 'markt',
    is_open: 0,
    open_invite_emp_id: null,
    open_invite_status: null,
    shift_category: 'regular',
    created_by: 'admin',
    created_at: '2026-07-01T08:00:00Z',
    claims: [],
    ...overrides,
  }
}

test('employee hour confirmation uses the immutable planned times', () => {
  assert.deepEqual(getPlannedShiftHours(shift()), {
    log_date: '2026-07-31',
    clock_in: '09:00',
    clock_out: '17:00',
    break_minutes: 30,
  })
  assert.equal(isShiftReadyForHourConfirmation(shift(), new Date('2026-07-31T16:00:00Z')), true)
  assert.equal(isShiftReadyForHourConfirmation(shift({ is_open: 1 }), new Date('2026-08-01T12:00:00Z')), false)
})

test('latest employee submission is selected by revision before timestamp', () => {
  const base = {
    id: 1,
    employee_id: 7,
    employee_name: 'Medewerker',
    shift_id: 42,
    log_date: '2026-07-31',
    location: 'markt',
    clock_in: '09:00',
    clock_out: '17:00',
    break_minutes: 30,
    overtime_hours: 0,
    note: null,
    is_processed: 0,
    processed_at: null,
    submission_status: 'pending',
    reviewed_by: null,
    reviewed_at: null,
    review_note: null,
    planned_clock_in: '09:00',
    planned_clock_out: '17:00',
    planned_break_minutes: 30,
    confirmation_mode: 'adjusted',
    submission_revision: 1,
    submitted_at: '2026-08-01T08:00:00Z',
    created_by: 'employee',
    created_at: '2026-08-01T08:00:00Z',
  } as TimeLog
  const latest = latestTimeLogForShift([
    { ...base, id: 2, submission_revision: 2, created_at: '2026-08-01T08:00:00Z' },
    { ...base, id: 3, submission_revision: 1, created_at: '2026-08-01T10:00:00Z' },
  ], 42)
  assert.equal(latest?.id, 2)
})
