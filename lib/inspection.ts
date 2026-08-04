import crypto from 'crypto'
import { supabase, T } from './db'
import { getISOWeekYear } from './dateUtils'
import type { Day, DocType, SessionUser } from '@/types'

type InspectionSession = {
  user?: SessionUser
  csrf?: string
  inspection_expires_at?: number
  inspection_admin_return?: SessionUser
  inspection_service_number_hash?: string
  inspection_service_number_suffix?: string
  inspection_integrity_accepted_at?: number
}

const DOCUMENT_BUCKET = 'employee-documents'
const INSPECTION_DOC_TYPES: DocType[] = ['legitimatie', 'arbeidsovereenkomst']
const DAYS: Day[] = ['zondag', 'maandag', 'dinsdag', 'woensdag', 'donderdag', 'vrijdag', 'zaterdag']

export interface InspectionDocumentMeta {
  id: number
  type: 'identity' | 'employment_contract'
  viewCount: number
  nextAllowedAt: string | null
  blockedUntil: string | null
}

export interface InspectionEmployeeRow {
  id: number
  name: string
  shifts: Array<{ startTime: string | null; endTime: string | null; fullDay: boolean }>
  documents: InspectionDocumentMeta[]
}

export interface InspectionOverview {
  date: string
  day: Day
  timezone: 'Europe/Brussels'
  employees: InspectionEmployeeRow[]
}

export function getBrusselsToday(now = new Date()): {
  date: string
  day: Day
  week: number
  year: number
} {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Brussels', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(now)
  const value = (type: Intl.DateTimeFormatPartTypes) => parts.find(part => part.type === type)?.value ?? ''
  const date = `${value('year')}-${value('month')}-${value('day')}`
  const localDate = new Date(`${date}T12:00:00Z`)
  const { week, year } = getISOWeekYear(localDate)
  return { date, day: DAYS[localDate.getUTCDay()], week, year }
}

export function validateServiceNumber(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const clean = value.trim()
  return /^[A-Za-zÀ-ÿ0-9][A-Za-zÀ-ÿ0-9/-]{2,31}$/.test(clean) ? clean : null
}

function signingSecret(): string {
  const secret = process.env.SECRET_KEY
    ?? (process.env.NODE_ENV !== 'production' ? 'dev-only-inspection-hmac-not-for-production-use' : '')
  if (!secret) throw new Error('Inspection signing secret is not configured')
  return secret
}

export function hashInspectionValue(value: string): string {
  return crypto.createHmac('sha256', signingSecret()).update(value).digest('hex')
}

export async function isInspectionLoginRateLimited(attemptKeyHash: string): Promise<boolean> {
  const since = new Date(Date.now() - 15 * 60 * 1000).toISOString()
  const { count, error } = await supabase
    .from(T('inspection_login_attempts'))
    .select('id', { count: 'exact', head: true })
    .eq('attempt_key_hash', attemptKeyHash)
    .eq('succeeded', false)
    .gte('created_at', since)
  if (error) throw error
  return (count ?? 0) >= 5
}

export async function recordInspectionLoginAttempt(attemptKeyHash: string, succeeded: boolean): Promise<void> {
  const { error } = await supabase.from(T('inspection_login_attempts')).insert({
    attempt_key_hash: attemptKeyHash,
    succeeded,
  })
  if (error) throw error
}

export function inspectionSessionHash(session: InspectionSession): string {
  if (!session.user || !session.csrf || !session.inspection_expires_at) throw new Error('Invalid inspection session')
  return hashInspectionValue(`${session.user.user_id}:${session.csrf}:${session.inspection_expires_at}`)
}

export function inspectionActor(session: InspectionSession): { inspectorId: string; adminUserId: string | null } {
  if (!session.user || session.user.role !== 'inspector') throw new Error('Inspection role required')
  return {
    inspectorId: session.user.user_id,
    adminUserId: session.inspection_admin_return?.user_id ?? null,
  }
}

async function assertInspectionActorActive(session: InspectionSession): Promise<void> {
  const { inspectorId, adminUserId } = inspectionActor(session)
  const username = adminUserId ?? inspectorId
  const role = adminUserId ? 'admin' : 'inspector'
  const { data, error } = await supabase
    .from(T('users'))
    .select('username')
    .eq('username', username)
    .eq('role', role)
    .is('archived_at', null)
    .maybeSingle()
  if (error || !data) throw error ?? new Error('Inspection account is inactive')
}

export async function getInspectionOverview(session: InspectionSession): Promise<InspectionOverview> {
  const { inspectorId } = inspectionActor(session)
  await assertInspectionActorActive(session)
  const today = getBrusselsToday()
  const { data: shifts, error: shiftError } = await supabase
    .from(T('shifts'))
    .select('employee_id, employee_name, start_time, end_time, full_day')
    .eq('week_number', today.week)
    .eq('year', today.year)
    .eq('day_of_week', today.day)
    .in('location', ['markt', 'both'])
    .eq('is_open', 0)
    .is('archived_at', null)
    .not('employee_id', 'is', null)
    .not('shift_type', 'in', '(Verlof,Vakantie,Verzuim)')
    .order('start_time')

  if (shiftError) throw shiftError

  const scheduledEmployeeIds = [...new Set((shifts ?? []).map(shift => Number(shift.employee_id)).filter(Boolean))]
  const activeEmployeeIds = new Set<number>()
  if (scheduledEmployeeIds.length > 0) {
    const { data: activeEmployees, error: employeeError } = await supabase
      .from(T('employees'))
      .select('id')
      .in('id', scheduledEmployeeIds)
      .eq('is_active', 1)
    if (employeeError) throw employeeError
    for (const employee of activeEmployees ?? []) activeEmployeeIds.add(Number(employee.id))
  }

  const employeeMap = new Map<number, InspectionEmployeeRow>()
  for (const shift of shifts ?? []) {
    if (!shift.employee_id || !activeEmployeeIds.has(Number(shift.employee_id))) continue
    const row: InspectionEmployeeRow = employeeMap.get(shift.employee_id) ?? {
      id: shift.employee_id,
      name: shift.employee_name,
      shifts: [],
      documents: [],
    }
    row.shifts.push({
      startTime: shift.start_time ? String(shift.start_time).slice(0, 5) : null,
      endTime: shift.end_time ? String(shift.end_time).slice(0, 5) : null,
      fullDay: Boolean(shift.full_day),
    })
    employeeMap.set(shift.employee_id, row)
  }

  const employeeIds = [...employeeMap.keys()]
  if (employeeIds.length === 0) {
    return { date: today.date, day: today.day, timezone: 'Europe/Brussels', employees: [] }
  }

  const { data: documents, error: documentError } = await supabase
    .from(T('employee_documents'))
    .select('id, employee_id, doc_type')
    .in('employee_id', employeeIds)
    .in('doc_type', INSPECTION_DOC_TYPES)
    .eq('inspection_released', true)
    .is('archived_at', null)
    .order('uploaded_at', { ascending: false })
  if (documentError) throw documentError

  const documentIds = (documents ?? []).map(document => Number(document.id))
  const stateByDocument = new Map<number, { consecutive_views: number; next_allowed_at: string | null; blocked_until: string | null }>()
  if (documentIds.length > 0) {
    const { data: states, error: stateError } = await supabase
      .from(T('inspection_document_state'))
      .select('document_id, consecutive_views, next_allowed_at, blocked_until')
      .eq('inspector_id', inspectorId)
      .in('document_id', documentIds)
    if (stateError) throw stateError
    for (const state of states ?? []) stateByDocument.set(Number(state.document_id), state)
  }

  for (const document of documents ?? []) {
    const employee = employeeMap.get(Number(document.employee_id))
    if (!employee) continue
    const state = stateByDocument.get(Number(document.id))
    employee.documents.push({
      id: Number(document.id),
      type: document.doc_type === 'legitimatie' ? 'identity' : 'employment_contract',
      viewCount: state?.consecutive_views ?? 0,
      nextAllowedAt: state?.next_allowed_at ?? null,
      blockedUntil: state?.blocked_until ?? null,
    })
  }

  return {
    date: today.date,
    day: today.day,
    timezone: 'Europe/Brussels',
    employees: [...employeeMap.values()].sort((a, b) => a.name.localeCompare(b.name, 'nl-BE')),
  }
}

export async function recordInspectionOverview(session: InspectionSession): Promise<void> {
  const { inspectorId, adminUserId } = inspectionActor(session)
  const { error } = await supabase.from(T('inspection_events')).insert({
    inspector_id: inspectorId,
    admin_user_id: adminUserId,
    action: 'overview_opened',
    service_number_hash: session.inspection_service_number_hash,
    service_number_suffix: session.inspection_service_number_suffix,
    integrity_accepted: true,
  })
  if (error) throw error
}

export async function requestDocumentView(session: InspectionSession, documentId: number) {
  const { inspectorId, adminUserId } = inspectionActor(session)
  if (!session.inspection_service_number_hash || !session.inspection_service_number_suffix
    || !session.inspection_integrity_accepted_at
    || session.inspection_integrity_accepted_at > Date.now()
    || Date.now() - session.inspection_integrity_accepted_at > 30 * 60 * 1000) {
    return { status: 'integrity_required' as const }
  }
  const token = crypto.randomBytes(32).toString('base64url')
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex')
  const { data, error } = await supabase.rpc(T('request_inspection_document_view'), {
    p_inspector_id: inspectorId,
    p_admin_user_id: adminUserId,
    p_document_id: documentId,
    p_service_number_hash: session.inspection_service_number_hash,
    p_service_number_suffix: session.inspection_service_number_suffix,
    p_token_hash: tokenHash,
    p_session_hash: inspectionSessionHash(session),
  })
  if (error) throw error
  const result = data as Record<string, unknown>
  return result.status === 'allowed' ? { ...result, token } : result
}

export async function consumeDocumentView(session: InspectionSession, token: string) {
  const { inspectorId, adminUserId } = inspectionActor(session)
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex')
  const { data, error } = await supabase.rpc(T('consume_inspection_document_grant'), {
    p_inspector_id: inspectorId,
    p_admin_user_id: adminUserId,
    p_token_hash: tokenHash,
    p_session_hash: inspectionSessionHash(session),
  })
  if (error) throw error
  const grant = Array.isArray(data) ? data[0] : null
  if (!grant) return null
  const { data: blob, error: storageError } = await supabase.storage
    .from(DOCUMENT_BUCKET)
    .download(grant.storage_path)
  if (storageError || !blob) throw storageError ?? new Error('Document unavailable')
  if (new Date(grant.expires_at).getTime() <= Date.now()) return null
  return {
    buffer: Buffer.from(await blob.arrayBuffer()),
    mimeType: grant.mime_type === 'application/pdf' ? 'application/pdf'
      : grant.mime_type === 'image/png' ? 'image/png'
      : grant.mime_type === 'image/webp' ? 'image/webp'
      : 'image/jpeg',
    expiresAt: grant.expires_at as string,
  }
}
