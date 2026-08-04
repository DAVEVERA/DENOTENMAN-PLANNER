import assert from 'node:assert/strict'
import { test } from 'node:test'

import { getPlannedShiftHours, isShiftReadyForHourConfirmation, latestTimeLogForShift } from '../../lib/shift-hours'
import { interpretHourSubmissionResponse } from '../../lib/hour-submission-client'
import { HourSubmissionConflictError } from '../../lib/hours'
import { hourSubmissionConflictResponse, hourSubmissionFailure } from '../../pages/api/hours/shift'
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
    archived_at: null,
    archived_by: null,
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

test('PostgREST schema drift returns a stable temporary-service error without database details', () => {
  const failure = hourSubmissionFailure({
    code: 'PGRST204',
    message: "Could not find the 'confirmation_mode' column of 'planner20_time_logs' in the schema cache",
    details: 'internal database detail',
  })

  assert.deepEqual(failure, {
    status: 503,
    body: {
      success: false,
      code: 'HOURS_SCHEMA_UNAVAILABLE',
      message: 'Uren opslaan is tijdelijk niet beschikbaar. Probeer het later opnieuw.',
      retryable: true,
    },
  })
  assert.equal(JSON.stringify(failure).includes('confirmation_mode'), false)
  assert.equal(JSON.stringify(failure).includes('planner20_time_logs'), false)
})

test('unexpected hour submission failures remain generic', () => {
  assert.deepEqual(hourSubmissionFailure(new Error('private internal failure')), {
    status: 500,
    body: {
      success: false,
      code: 'HOURS_SUBMISSION_FAILED',
      message: 'Uren opslaan is niet gelukt. Probeer het opnieuw.',
      retryable: false,
    },
  })
})

test('a direct PostgreSQL missing-column error also maps to temporary schema unavailability', () => {
  assert.equal(hourSubmissionFailure({ code: '42703' }).status, 503)
})

test('a retry after a committed submission reconciles to the existing registration', () => {
  const existing = {
    id: 25,
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
    submission_status: 'approved',
    reviewed_by: 'Automatisch na medewerkerakkoord',
    reviewed_at: '2026-08-02T16:00:00Z',
    review_note: 'Geplande uren ongewijzigd bevestigd door medewerker',
    planned_clock_in: '09:00',
    planned_clock_out: '17:00',
    planned_break_minutes: 30,
    confirmation_mode: 'confirmed',
    submission_revision: 1,
    submitted_at: '2026-08-02T16:00:00Z',
    created_by: 'employee-user',
    created_at: '2026-08-02T16:00:00Z',
  } as TimeLog
  const response = hourSubmissionConflictResponse(
    new HourSubmissionConflictError('De uren voor deze dienst zijn al definitief verwerkt.', existing, true),
  )

  assert.deepEqual(response, {
    status: 409,
    body: {
      success: false,
      code: 'HOURS_ALREADY_SUBMITTED',
      message: 'De uren voor deze dienst zijn al definitief verwerkt.',
      data: existing,
    },
  })
  assert.deepEqual(interpretHourSubmissionResponse(response.status, response.body), {
    kind: 'success',
    data: existing,
  })
})

test('a changed retry is not presented as if the new values were saved', () => {
  const existing = {
    id: 25,
    employee_id: 7,
    log_date: '2026-07-31',
    submission_status: 'approved',
  } as TimeLog
  const response = hourSubmissionConflictResponse(
    new HourSubmissionConflictError('conflict', existing, false),
  )

  assert.equal(response.body.code, 'HOURS_SUBMISSION_CONFLICT')
  assert.deepEqual(interpretHourSubmissionResponse(response.status, response.body), {
    kind: 'error',
    message: 'Voor deze dienst zijn al uren opgeslagen. Je nieuwe aanpassing is niet opgeslagen; vernieuw je rooster.',
  })
})

test('null JSON from a gateway remains a safe submission error', () => {
  assert.deepEqual(interpretHourSubmissionResponse(502, null), {
    kind: 'error',
    message: 'Indienen is niet gelukt. Probeer het opnieuw.',
  })
})
