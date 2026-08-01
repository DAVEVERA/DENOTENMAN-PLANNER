import { createHash } from 'node:crypto'

import type { InsightCard } from '../insights'
import { getWeeklyInsights } from '../insights'
import { getSupabase, T } from '../db'
import type { SessionUser } from '../../types'
import { currentWeekYear } from '../dateUtils'
import { getChatBootstrap, isTeamChatOwner, TeamChatRepositoryError, type TeamChatBootstrap } from './repository'

export type PlanningWatchKind =
  | 'open_shift'
  | 'exchange_response'
  | 'exchange_waiting'
  | 'exchange_conflict'
  | 'staffing'

export type PlanningWatchSeverity = 'calm' | 'info' | 'attention' | 'urgent'

export interface PlanningWatchItem {
  id: string
  kind: PlanningWatchKind
  severity: PlanningWatchSeverity
  title: string
  message: string
  conversation_id: number | null
  shift_id: number | null
  request_id: string | null
  expires_at: string | null
  action: { label: string; href: string } | null
}

export interface PlanningWatchShift {
  id: number
  employee_id: number | null
  employee_name: string
  week_number: number
  year: number
  day_of_week: string
  shift_type: string
  start_time: string | null
  end_time: string | null
  full_day: number
  break_minutes: number
  location: string
  is_open: number
  opened_at: string | null
  assignment_version: number
}

export interface PlanningWatchExchange {
  id: string
  conversation_id: number
  kind: 'takeover' | 'swap'
  status: 'pending' | 'conflict' | 'expired'
  source_shift_id: number
  target_shift_id: number | null
  initiator_user_id: string
  counterparty_user_id: string
  expires_at: string
  conflict_code: string | null
}

export interface PublishPlanningTriggerInput {
  conversationId: number
  userId: string
  employeeId: number | null
  eventKey: string
  eventType: string
  body: string
  payload: Record<string, unknown>
}

export type PublishPlanningTriggerResult =
  | { status: 'published' | 'duplicate'; message_id: number }
  | { status: 'invalid' | 'forbidden' | 'not_found'; error_code: string; message_id: null }

export interface PlanningWatchAdapter {
  listOpenShifts(): Promise<PlanningWatchShift[]>
  listUserExchanges(conversationIds: number[], userId: string): Promise<PlanningWatchExchange[]>
  publishTrigger(input: PublishPlanningTriggerInput): Promise<PublishPlanningTriggerResult>
}

interface PlanningWatchDependencies {
  adapter: PlanningWatchAdapter
  getChatBootstrap(user: SessionUser): Promise<TeamChatBootstrap>
  isTeamChatOwner(userId: string): Promise<boolean>
  getWeeklyInsights(week: number, year: number, location?: SessionUser['location']): Promise<InsightCard[]>
  now(): Date
}

const SEVERITY_ORDER: Record<PlanningWatchSeverity, number> = {
  urgent: 0,
  attention: 1,
  info: 2,
  calm: 3,
}

export function planningTriggerUuid(source: string): string {
  const bytes = createHash('sha256').update(source).digest().subarray(0, 16)
  bytes[6] = (bytes[6] & 0x0f) | 0x50
  bytes[8] = (bytes[8] & 0x3f) | 0x80
  const hex = bytes.toString('hex')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

function formatShift(shift: PlanningWatchShift): string {
  const time = shift.full_day === 1
    ? 'hele dag'
    : shift.start_time && shift.end_time
      ? `${shift.start_time.slice(0, 5)}–${shift.end_time.slice(0, 5)}`
      : 'tijd volgt'
  return `${shift.day_of_week} · ${time} · ${shift.location}`
}

function exchangeItem(exchange: PlanningWatchExchange, userId: string, nowMs: number): PlanningWatchItem {
  const expiresAt = Date.parse(exchange.expires_at)
  const expired = exchange.status === 'expired' || expiresAt <= nowMs
  const isCounterparty = exchange.counterparty_user_id === userId
  if (exchange.status === 'conflict' || expired) {
    return {
      id: `exchange-conflict:${exchange.id}`,
      kind: 'exchange_conflict',
      severity: 'urgent',
      title: expired ? 'Dienstverzoek verlopen' : 'Roostercontrole nodig',
      message: expired
        ? 'Dit verzoek is niet meer geldig. Start vanuit de actuele dienst een nieuw verzoek.'
        : 'De planning is veranderd. Bekijk de actuele dienst voordat je opnieuw afstemt.',
      conversation_id: exchange.conversation_id,
      shift_id: exchange.source_shift_id,
      request_id: exchange.id,
      expires_at: exchange.expires_at,
      action: { label: 'Bekijk actuele dienst', href: `/me?shift=${exchange.source_shift_id}` },
    }
  }

  const expiring = expiresAt <= nowMs + 24 * 60 * 60 * 1000
  return {
    id: `exchange:${exchange.id}`,
    kind: isCounterparty ? 'exchange_response' : 'exchange_waiting',
    severity: isCounterparty && expiring ? 'urgent' : isCounterparty ? 'attention' : 'info',
    title: isCounterparty
      ? exchange.kind === 'takeover' ? 'Overname wacht op jou' : 'Ruil wacht op jou'
      : 'Wachten op collega',
    message: isCounterparty
      ? 'Controleer de onveranderlijke dienstgegevens en kies akkoord of afwijzen.'
      : 'Jouw akkoord staat vast. De planning wijzigt pas na het tweede akkoord.',
    conversation_id: exchange.conversation_id,
    shift_id: exchange.source_shift_id,
    request_id: exchange.id,
    expires_at: exchange.expires_at,
    action: {
      label: isCounterparty ? 'Reageer nu' : 'Bekijk verzoek',
      href: `/me/chat?conversation=${exchange.conversation_id}&exchange=${exchange.id}`,
    },
  }
}

export function createPlanningWatchService(dependencies: PlanningWatchDependencies) {
  async function getPlanningWatch(user: SessionUser): Promise<PlanningWatchItem[]> {
    const chat = await dependencies.getChatBootstrap(user)
    const conversationIds = chat.conversations.map(conversation => conversation.id)
    const includeInsights = user.role === 'admin' || user.role === 'manager'
    const weekYear = currentWeekYear()
    const [openShifts, exchanges, insights] = await Promise.all([
      dependencies.adapter.listOpenShifts(),
      dependencies.adapter.listUserExchanges(conversationIds, user.user_id),
      includeInsights
        ? dependencies.getWeeklyInsights(
            weekYear.week,
            weekYear.year,
            user.location === 'both' ? undefined : user.location ?? undefined,
          )
        : Promise.resolve([]),
    ])

    const nowMs = dependencies.now().getTime()
    const items: PlanningWatchItem[] = []
    for (const shift of openShifts) {
      if (shift.is_open !== 1) continue
      if (user.location && user.location !== 'both' && shift.location !== user.location) continue
      const openedAt = shift.opened_at ? Date.parse(shift.opened_at) : Number.NaN
      const old = Number.isFinite(openedAt) && openedAt <= nowMs - 48 * 60 * 60 * 1000
      items.push({
        id: `open-shift:${shift.id}:${shift.assignment_version}`,
        kind: 'open_shift',
        severity: old ? 'attention' : 'info',
        title: old ? 'Open dienst vraagt aandacht' : 'Open dienst beschikbaar',
        message: `${shift.shift_type} · ${formatShift(shift)}`,
        conversation_id: null,
        shift_id: shift.id,
        request_id: null,
        expires_at: null,
        action: { label: 'Bekijk en claim', href: `/me/open-shifts?shift=${shift.id}` },
      })
    }

    items.push(...exchanges.map(exchange => exchangeItem(exchange, user.user_id, nowMs)))
    for (const insight of insights.filter(item => item.severity === 'danger' || item.severity === 'warning')) {
      items.push({
        id: `staffing:${weekYear.year}:${weekYear.week}:${insight.id}`,
        kind: 'staffing',
        severity: insight.severity === 'danger' ? 'urgent' : 'attention',
        title: insight.title,
        message: insight.message,
        conversation_id: null,
        shift_id: null,
        request_id: null,
        expires_at: null,
        action: { label: 'Open rooster', href: `/?week=${weekYear.week}&year=${weekYear.year}` },
      })
    }

    return items.sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity] || a.id.localeCompare(b.id))
  }

  async function syncPlanningTriggers(user: SessionUser): Promise<{ published: number; duplicates: number }> {
    const chat = await dependencies.getChatBootstrap(user)
    const owner = user.role === 'admin' || await dependencies.isTeamChatOwner(user.user_id)
    if (!owner) throw new TeamChatRepositoryError('TEAM_CHAT_MANAGEMENT_REQUIRED', 403)
    const nootschap = chat.conversations.find(conversation => conversation.slug === 'nootschap' && conversation.fixed)
    if (!nootschap) throw new TeamChatRepositoryError('NOOTSCHAP_CHANNEL_UNAVAILABLE', 409)

    const candidates = (await getPlanningWatch(user)).filter(item => (
      (item.kind === 'open_shift' || item.kind === 'staffing')
      && (item.severity === 'attention' || item.severity === 'urgent')
    ))
    let published = 0
    let duplicates = 0
    for (const item of candidates) {
      const result = await dependencies.adapter.publishTrigger({
        conversationId: nootschap.id,
        userId: user.user_id,
        employeeId: user.employee_id,
        eventKey: planningTriggerUuid(item.id),
        eventType: item.kind === 'open_shift' ? 'open_shift_attention' : 'staffing_attention',
        body: `${item.title}: ${item.message}`,
        payload: { watch_item_id: item.id, shift_id: item.shift_id },
      })
      if (result.status === 'published') published++
      else if (result.status === 'duplicate') duplicates++
      else if ('error_code' in result) {
        throw new TeamChatRepositoryError(result.error_code.toUpperCase(), result.status === 'forbidden' ? 403 : 400)
      } else {
        throw new TeamChatRepositoryError('INVALID_PLANNING_TRIGGER_RESPONSE', 502)
      }
    }
    return { published, duplicates }
  }

  return { getPlanningWatch, syncPlanningTriggers }
}

function createPlanningWatchAdapter(): PlanningWatchAdapter {
  const client = getSupabase()
  return {
    async listOpenShifts() {
      const { data, error } = await client
        .from(T('shifts'))
        .select('id, employee_id, employee_name, week_number, year, day_of_week, shift_type, start_time, end_time, full_day, break_minutes, location, is_open, opened_at, assignment_version')
        .eq('is_open', 1)
        .order('year', { ascending: true })
        .order('week_number', { ascending: true })
        .limit(100)
      if (error) throw new Error('Planningwacht kon open diensten niet ophalen', { cause: error })
      return (data ?? []) as PlanningWatchShift[]
    },

    async listUserExchanges(conversationIds, userId) {
      if (conversationIds.length === 0) return []
      const { data, error } = await client
        .from(T('shift_exchange_requests'))
        .select('id, conversation_id, kind, status, source_shift_id, target_shift_id, initiator_user_id, counterparty_user_id, expires_at, conflict_code')
        .in('conversation_id', conversationIds)
        .in('status', ['pending', 'conflict', 'expired'])
        .order('updated_at', { ascending: false })
        .limit(200)
      if (error) throw new Error('Planningwacht kon dienstverzoeken niet ophalen', { cause: error })
      return ((data ?? []) as PlanningWatchExchange[]).filter(exchange => (
        exchange.initiator_user_id === userId || exchange.counterparty_user_id === userId
      ))
    },

    async publishTrigger(input) {
      const { data, error } = await client.rpc(T('publish_planning_trigger'), {
        p_conversation_id: input.conversationId,
        p_user_id: input.userId,
        p_employee_id: input.employeeId,
        p_event_key: input.eventKey,
        p_event_type: input.eventType,
        p_body: input.body,
        p_payload: input.payload,
      })
      if (error) throw new Error('Planningwacht kon de systeemkaart niet publiceren', { cause: error })
      return data as PublishPlanningTriggerResult
    },
  }
}

let defaultService: ReturnType<typeof createPlanningWatchService> | null = null

function planningWatchService() {
  defaultService ??= createPlanningWatchService({
    adapter: createPlanningWatchAdapter(),
    getChatBootstrap,
    isTeamChatOwner,
    getWeeklyInsights,
    now: () => new Date(),
  })
  return defaultService
}

export async function getPlanningWatch(user: SessionUser): Promise<PlanningWatchItem[]> {
  return planningWatchService().getPlanningWatch(user)
}

export async function syncPlanningTriggers(user: SessionUser): Promise<{ published: number; duplicates: number }> {
  return planningWatchService().syncPlanningTriggers(user)
}
