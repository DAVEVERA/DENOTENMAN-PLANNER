import { supabase, T, unwrap } from './db'
import type { TimeLog, Location, HoursSummary, SubmissionStatus, HourConfirmationMode } from '@/types'
import { calcHoursWorked } from './dateUtils'

export async function logHours(
  data: Omit<TimeLog,
    | 'id'
    | 'created_at'
    | 'planned_clock_in'
    | 'planned_clock_out'
    | 'planned_break_minutes'
    | 'confirmation_mode'
    | 'submission_revision'
    | 'submitted_at'
  > & Partial<Pick<TimeLog,
    | 'planned_clock_in'
    | 'planned_clock_out'
    | 'planned_break_minutes'
    | 'confirmation_mode'
    | 'submission_revision'
    | 'submitted_at'
  >>,
  createdBy = '',
): Promise<TimeLog> {
  return unwrap<TimeLog>(await supabase
    .from(T('time_logs'))
    .insert({ ...data, created_by: createdBy })
    .select()
    .single())
}

export async function submitEmployeeHours(data: {
  employee_id: number
  employee_name: string
  log_date: string
  location: Location
  clock_in: string
  clock_out: string
  break_minutes: number
  note: string | null
  created_by: string
}): Promise<TimeLog> {
  return unwrap<TimeLog>(await supabase
    .from(T('time_logs'))
    .insert({
      ...data,
      overtime_hours: 0,
      shift_id: null,
      is_processed: 0,
      processed_at: null,
      submission_status: 'pending',
      reviewed_by: null,
      reviewed_at: null,
      review_note: null,
    })
    .select()
    .single())
}

export class HourSubmissionConflictError extends Error {
  constructor(
    message: string,
    public readonly existingLog: TimeLog | null = null,
    public readonly isSameSubmission = false,
  ) {
    super(message)
    this.name = 'HourSubmissionConflictError'
  }
}

type EmployeeShiftHourSubmission = {
  employee_id: number
  employee_name: string
  shift_id: number
  log_date: string
  location: Location
  clock_in: string
  clock_out: string
  break_minutes: number
  overtime_hours: number
  note: string | null
  confirmation_mode: HourConfirmationMode
  planned_clock_in: string | null
  planned_clock_out: string | null
  planned_break_minutes: number
  created_by: string
}

function matchesSubmission(log: TimeLog, data: EmployeeShiftHourSubmission): boolean {
  const time = (value: string | null | undefined) => value?.slice(0, 5) ?? null
  const note = (value: string | null | undefined) => value?.trim() || null
  return log.confirmation_mode === data.confirmation_mode
    && time(log.clock_in) === time(data.clock_in)
    && time(log.clock_out) === time(data.clock_out)
    && log.break_minutes === data.break_minutes
    && note(log.note) === note(data.note)
}

export async function submitEmployeeShiftHours(data: EmployeeShiftHourSubmission): Promise<TimeLog> {
  const history = unwrap<TimeLog[]>(await supabase
    .from(T('time_logs'))
    .select('*')
    .eq('shift_id', data.shift_id)
    .eq('employee_id', data.employee_id)
    .order('created_at', { ascending: false }))

  const active = history.find(log => ['pending', 'approved', 'direct'].includes(log.submission_status))
  if (active) {
    const label = active.submission_status === 'pending' ? 'al ingediend' : 'al definitief verwerkt'
    throw new HourSubmissionConflictError(
      `De uren voor deze dienst zijn ${label}.`,
      active,
      matchesSubmission(active, data),
    )
  }

  const revision = history.reduce(
    (highest, log) => Math.max(highest, log.submission_revision ?? 0),
    0,
  ) + 1
  const submittedAt = new Date().toISOString()
  const automaticallyApproved = data.confirmation_mode === 'confirmed'

  const result = await supabase
    .from(T('time_logs'))
    .insert({
      employee_id: data.employee_id,
      employee_name: data.employee_name,
      log_date: data.log_date,
      location: data.location,
      clock_in: data.clock_in,
      clock_out: data.clock_out,
      break_minutes: data.break_minutes,
      overtime_hours: data.overtime_hours,
      shift_id: data.shift_id,
      note: data.note,
      is_processed: 0,
      processed_at: null,
      submission_status: automaticallyApproved ? 'approved' : 'pending',
      reviewed_by: automaticallyApproved ? 'Automatisch na medewerkerakkoord' : null,
      reviewed_at: automaticallyApproved ? submittedAt : null,
      review_note: automaticallyApproved ? 'Geplande uren ongewijzigd bevestigd door medewerker' : null,
      planned_clock_in: data.planned_clock_in,
      planned_clock_out: data.planned_clock_out,
      planned_break_minutes: data.planned_break_minutes,
      confirmation_mode: data.confirmation_mode,
      submission_revision: revision,
      submitted_at: submittedAt,
      created_by: data.created_by,
    })
    .select()
    .single()

  if (result.error && (result.error as { code?: string }).code === '23505') {
    const retryHistory = unwrap<TimeLog[]>(await supabase
      .from(T('time_logs'))
      .select('*')
      .eq('shift_id', data.shift_id)
      .eq('employee_id', data.employee_id)
      .order('created_at', { ascending: false }))
    const existingLog = retryHistory.find(log => ['pending', 'approved', 'direct'].includes(log.submission_status)) ?? null
    throw new HourSubmissionConflictError(
      'De uren voor deze dienst zijn zojuist al ingediend.',
      existingLog,
      existingLog ? matchesSubmission(existingLog, data) : false,
    )
  }
  return unwrap<TimeLog>(result)
}

export async function getPendingSubmissions(): Promise<TimeLog[]> {
  return unwrap<TimeLog[]>(await supabase
    .from(T('time_logs'))
    .select('*')
    .eq('submission_status', 'pending')
    .order('created_at', { ascending: false }))
}

export async function reviewHourSubmission(
  id: number,
  status: 'approved' | 'rejected',
  reviewedBy: string,
  reviewNote?: string,
): Promise<TimeLog> {
  return unwrap<TimeLog>(await supabase
    .from(T('time_logs'))
    .update({
      submission_status: status,
      reviewed_by: reviewedBy,
      reviewed_at: new Date().toISOString(),
      review_note: reviewNote ?? null,
    })
    .eq('id', id)
    .eq('submission_status', 'pending')
    .select()
    .single())
}

export async function getEmployeeTimeLog(id: number): Promise<TimeLog | null> {
  const { data } = await supabase
    .from(T('time_logs'))
    .select('*')
    .eq('id', id)
    .maybeSingle()
  return data ?? null
}

export async function withdrawEmployeeSubmission(id: number, employeeId: number): Promise<void> {
  unwrap(await supabase
    .from(T('time_logs'))
    .update({
      submission_status: 'withdrawn',
      reviewed_at: new Date().toISOString(),
      review_note: 'Ingetrokken door medewerker',
    })
    .eq('id', id)
    .eq('employee_id', employeeId)
    .eq('submission_status', 'pending'))
}

export async function getTimeLogs(opts: {
  employee_id?: number
  from?: string
  to?: string
  location?: Location
  is_processed?: number
  submission_status?: SubmissionStatus
  exclude_rejected?: boolean
  /** Alleen definitieve regels: directe beheerinvoer en goedgekeurde medewerkeruren. */
  only_finalized?: boolean
}): Promise<TimeLog[]> {
  let q = supabase.from(T('time_logs')).select('*').order('log_date', { ascending: false })
  if (opts.employee_id) q = q.eq('employee_id', opts.employee_id)
  if (opts.from) q = q.gte('log_date', opts.from)
  if (opts.to) q = q.lte('log_date', opts.to)
  if (opts.location && opts.location !== 'both') q = q.eq('location', opts.location)
  if (opts.is_processed !== undefined) q = q.eq('is_processed', opts.is_processed)
  if (opts.submission_status) q = q.eq('submission_status', opts.submission_status)
  if (opts.only_finalized) q = q.in('submission_status', ['direct', 'approved'])
  else if (opts.exclude_rejected) q = q.neq('submission_status', 'rejected')
  return unwrap<TimeLog[]>(await q)
}

export async function getExportTimeLogs(opts: {
  employee_id?: number
  from?: string
  to?: string
  location?: Location
  is_processed?: number
}): Promise<TimeLog[]> {
  const logs = await getTimeLogs({ ...opts, only_finalized: true })
  return logs.sort((a, b) =>
    a.log_date === b.log_date
      ? a.employee_name.localeCompare(b.employee_name)
      : a.log_date.localeCompare(b.log_date),
  )
}

export async function updateTimeLog(id: number, data: Partial<TimeLog>): Promise<TimeLog> {
  return unwrap<TimeLog>(await supabase
    .from(T('time_logs')).update(data).eq('id', id).select().single())
}

export async function archiveTimeLog(id: number, archivedBy: string): Promise<boolean> {
  const { error } = await supabase
    .from(T('time_logs'))
    .update({
      submission_status: 'withdrawn',
      reviewed_by: archivedBy,
      reviewed_at: new Date().toISOString(),
      review_note: 'Gearchiveerd door beheerder',
    })
    .eq('id', id)
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
  const logs = await getTimeLogs({ from, to, location, only_finalized: true })

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
