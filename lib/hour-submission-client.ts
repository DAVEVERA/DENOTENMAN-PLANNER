import type { TimeLog } from '@/types'

type SubmissionOutcome =
  | { kind: 'success'; data: TimeLog }
  | { kind: 'error'; message: string }

function isTimeLog(value: unknown): value is TimeLog {
  if (!value || typeof value !== 'object') return false
  const record = value as Record<string, unknown>
  return Number.isInteger(record.id)
    && Number.isInteger(record.employee_id)
    && typeof record.log_date === 'string'
    && typeof record.submission_status === 'string'
}

export function interpretHourSubmissionResponse(status: number, payload: unknown): SubmissionOutcome {
  const record = payload && typeof payload === 'object'
    ? payload as Record<string, unknown>
    : null
  const data = record?.data

  if (isTimeLog(data) && (record?.success === true || (
    status === 409 && record?.code === 'HOURS_ALREADY_SUBMITTED'
  ))) {
    return { kind: 'success', data }
  }

  return {
    kind: 'error',
    message: typeof record?.message === 'string' && record.message.trim()
      ? record.message
      : 'Indienen is niet gelukt. Probeer het opnieuw.',
  }
}
