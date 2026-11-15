import assert from 'node:assert/strict'
import { test } from 'node:test'
import { can } from '../../lib/capabilities'
import { calcHoursWorked } from '../../lib/dateUtils'
import { buildCSV, buildJSON } from '../../lib/export'
import { isInspectorPathAllowed } from '../../lib/auth'
import { shiftHours } from '../../lib/scheduler'
import type { SessionUser, TimeLog } from '../../types'

test('calculates worked hours with breaks, rounding boundaries and invalid ranges', () => {
  assert.equal(calcHoursWorked('09:00', '17:00', 30), 7.5)
  assert.equal(calcHoursWorked('09:00', '09:01', 0), 1 / 60)
  assert.equal(calcHoursWorked('17:00', '09:00', 0), 0)
  assert.equal(calcHoursWorked(null, '17:00', 0), 0)
})

test('applies scheduler hour rules without producing negative totals', () => {
  assert.equal(shiftHours({ full_day: 1, start_time: null, end_time: null, break_minutes: 0 }), 8)
  assert.equal(shiftHours({ full_day: 0, start_time: '08:15', end_time: '12:45', break_minutes: 30 }), 4)
  assert.equal(shiftHours({ full_day: 0, start_time: '12:00', end_time: '11:00', break_minutes: 0 }), 0)
})

test('keeps export dates literal across the ISO week-year boundary', () => {
  const logs = [timeLog('2026-12-31'), timeLog('2027-01-01')]
  const csv = buildCSV(logs)
  const json = JSON.parse(buildJSON(logs))

  assert.match(csv, /"2026-12-31"/)
  assert.match(csv, /"2027-01-01"/)
  assert.deepEqual(json.map((row: TimeLog) => row.log_date), ['2026-12-31', '2027-01-01'])
  assert.deepEqual(json.map((row: TimeLog & { hours_worked: number }) => row.hours_worked), [7.5, 7.5])
})

test('keeps authorization role-based and denies missing sessions', () => {
  const admin = user('admin')
  const employee = user('employee')

  assert.equal(can(undefined, 'read'), false)
  assert.equal(can(admin, 'manage_settings'), true)
  assert.equal(can(employee, 'manage_settings'), false)
  assert.equal(can(employee, 'read'), true)
})

test('keeps inspector sessions inside the explicit path allowlist', () => {
  assert.equal(isInspectorPathAllowed('/inspectie'), true)
  assert.equal(isInspectorPathAllowed('/api/inspectie/overzicht'), true)
  assert.equal(isInspectorPathAllowed('/api/session'), true)
  assert.equal(isInspectorPathAllowed('/api/shifts'), false)
  assert.equal(isInspectorPathAllowed('/admin'), false)
})

function timeLog(logDate: string): TimeLog {
  return {
    id: logDate.endsWith('31') ? 1 : 2,
    employee_id: 7,
    employee_name: 'Test Employee',
    log_date: logDate,
    location: 'markt',
    clock_in: '09:00',
    clock_out: '17:00',
    break_minutes: 30,
    overtime_hours: 0,
    shift_id: null,
    note: null,
    is_processed: 0,
    processed_at: null,
    submission_status: 'approved',
    reviewed_by: null,
    reviewed_at: null,
    review_note: null,
    planned_clock_in: null,
    planned_clock_out: null,
    planned_break_minutes: null,
    confirmation_mode: null,
    submission_revision: null,
    submitted_at: null,
    created_by: 'test',
    created_at: '2026-01-01T00:00:00.000Z',
  }
}

function user(role: SessionUser['role']): SessionUser {
  return {
    user_id: `${role}-test`,
    display_name: 'Test User',
    role,
    employee_id: role === 'employee' ? 7 : null,
    location: role === 'employee' ? 'markt' : null,
  }
}
