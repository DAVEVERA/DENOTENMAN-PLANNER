import type { SupabaseClient } from '@supabase/supabase-js'

import type { SessionUser } from '../../types'
import type { CreateExchangeInput, ShiftExchangeKind, ShiftExchangeStatus } from '../../types/team-chat'
import { getSupabase, T } from '../db'
import { sendPushToEmployee } from '../push'
import { requireConversationMember, TeamChatRepositoryError } from './repository'
import { validateExchangeInput } from './validation'

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export interface ShiftExchangeSnapshot {
  week_number: number
  year: number
  day_of_week: string
  shift_type: string
  start_time: string | null
  end_time: string | null
  full_day: number
  break_minutes: number
  location: string
}

export interface ShiftExchangeRequest {
  id: string
  conversation_id: number
  client_nonce: string
  kind: ShiftExchangeKind
  status: ShiftExchangeStatus
  source_shift_id: number
  target_shift_id: number | null
  initiator_user_id: string
  initiator_employee_id: number | null
  counterparty_user_id: string
  counterparty_employee_id: number | null
  source_employee_id: number | null
  target_employee_id: number | null
  source_assignment_version: number
  target_assignment_version: number | null
  source_shift_snapshot: ShiftExchangeSnapshot
  target_shift_snapshot: ShiftExchangeSnapshot | null
  conflict_code: string | null
  expires_at: string
  completed_at: string | null
  created_at: string
  updated_at: string
}

export interface CreateShiftExchangeInput extends CreateExchangeInput {
  conversation_id: number
  client_nonce: string
}

export interface CreateExchangeAtomicInput {
  conversationId: number
  clientNonce: string
  kind: ShiftExchangeKind
  sourceShiftId: number
  targetShiftId: number | null
  userId: string
  employeeId: number
}

type ExchangeFailureStatus = 'invalid' | 'forbidden' | 'not_found' | 'conflict'

export type CreateExchangeAtomicResult =
  | { status: 'created' | 'duplicate'; error_code: null; request: ShiftExchangeRequest }
  | { status: ExchangeFailureStatus; error_code: string; request: null }

export interface ExchangeResponse {
  request_id: string
  status: ShiftExchangeStatus
  completed: boolean
  source_shift_id: number
  target_shift_id: number | null
  error_code: null
}

export interface RespondExchangeAtomicResult {
  status: ShiftExchangeStatus
  completed: boolean
  source_shift_id: number
  target_shift_id: number | null
  error_code: string | null
}

export interface ExchangeAdapter {
  createExchangeAtomic(input: CreateExchangeAtomicInput): Promise<CreateExchangeAtomicResult>
  findExchangeRequest(requestId: string): Promise<ShiftExchangeRequest | null>
  respondExchangeAtomic(input: {
    requestId: string
    userId: string
    employeeId: number | null
    decision: 'accepted' | 'declined'
  }): Promise<RespondExchangeAtomicResult>
  recordPushFailure(input: {
    requestId: string
    conversationId: number
    actorUserId: string
    eventType: 'shift_exchange_request_push_failed' | 'shift_exchange_completed_push_failed'
    failedEmployeeIds: number[]
  }): Promise<void>
}

interface ExchangeServiceDependencies {
  adapter: ExchangeAdapter
  requireConversationMember(conversationId: number, userId: string): Promise<unknown>
  notifyEmployee(employeeId: number, payload: { title: string; body: string; url: string }): Promise<void>
}

const ERROR_CONTRACT: Record<string, { code: string; status: number }> = {
  invalid_actor_or_request: { code: 'INVALID_EXCHANGE_REQUEST', status: 400 },
  invalid_exchange_input: { code: 'INVALID_EXCHANGE_REQUEST', status: 400 },
  invalid_decision: { code: 'INVALID_EXCHANGE_DECISION', status: 400 },
  active_account_required: { code: 'ACTIVE_TEAM_CHAT_ACCOUNT_REQUIRED', status: 403 },
  active_employee_required: { code: 'ACTIVE_EMPLOYEE_REQUIRED', status: 403 },
  conversation_membership_required: { code: 'CONVERSATION_MEMBERSHIP_REQUIRED', status: 403 },
  counterparty_membership_required: { code: 'EXCHANGE_COUNTERPARTY_MEMBERSHIP_REQUIRED', status: 409 },
  actor_not_a_party: { code: 'EXCHANGE_PARTY_REQUIRED', status: 403 },
  actor_employee_mismatch: { code: 'EXCHANGE_ACTOR_MISMATCH', status: 403 },
  request_not_found: { code: 'EXCHANGE_REQUEST_NOT_FOUND', status: 404 },
  source_shift_not_found: { code: 'SOURCE_SHIFT_NOT_FOUND', status: 404 },
  target_shift_not_found: { code: 'TARGET_SHIFT_NOT_FOUND', status: 404 },
  takeover_source_owned_by_initiator: { code: 'TAKEOVER_OWN_SHIFT_NOT_ALLOWED', status: 400 },
  swap_source_not_owned_by_initiator: { code: 'SWAP_SOURCE_NOT_OWNED', status: 403 },
  counterparty_account_not_found: { code: 'EXCHANGE_COUNTERPARTY_NOT_FOUND', status: 409 },
  counterparty_account_ambiguous: { code: 'EXCHANGE_COUNTERPARTY_AMBIGUOUS', status: 409 },
  request_expired: { code: 'EXCHANGE_REQUEST_EXPIRED', status: 409 },
  request_not_pending: { code: 'EXCHANGE_REQUEST_NOT_PENDING', status: 409 },
  decision_already_recorded: { code: 'EXCHANGE_DECISION_ALREADY_RECORDED', status: 409 },
  exchange_nonce_conflict: { code: 'EXCHANGE_NONCE_CONFLICT', status: 409 },
  source_shift_not_future: { code: 'SOURCE_SHIFT_NOT_FUTURE', status: 409 },
  target_shift_not_future: { code: 'TARGET_SHIFT_NOT_FUTURE', status: 409 },
  source_shift_not_exchangeable: { code: 'SOURCE_SHIFT_NOT_EXCHANGEABLE', status: 409 },
  target_shift_not_exchangeable: { code: 'TARGET_SHIFT_NOT_EXCHANGEABLE', status: 409 },
  source_assignment_changed: { code: 'SOURCE_ASSIGNMENT_CHANGED', status: 409 },
  target_assignment_changed: { code: 'TARGET_ASSIGNMENT_CHANGED', status: 409 },
  source_snapshot_changed: { code: 'SOURCE_SHIFT_CHANGED', status: 409 },
  target_snapshot_changed: { code: 'TARGET_SHIFT_CHANGED', status: 409 },
  source_overlap: { code: 'SOURCE_SHIFT_OVERLAP', status: 409 },
  target_overlap: { code: 'TARGET_SHIFT_OVERLAP', status: 409 },
  source_approved_leave: { code: 'SOURCE_APPROVED_LEAVE', status: 409 },
  target_approved_leave: { code: 'TARGET_APPROVED_LEAVE', status: 409 },
  inactive_party: { code: 'EXCHANGE_PARTY_INACTIVE', status: 409 },
  invalid_takeover_parties: { code: 'INVALID_TAKEOVER_PARTIES', status: 409 },
  invalid_swap_parties: { code: 'INVALID_SWAP_PARTIES', status: 409 },
}

function exchangeError(errorCode: string | null | undefined): TeamChatRepositoryError {
  const mapped = errorCode ? ERROR_CONTRACT[errorCode] : undefined
  return mapped
    ? new TeamChatRepositoryError(mapped.code, mapped.status)
    : new TeamChatRepositoryError('INVALID_EXCHANGE_RPC_RESPONSE', 502)
}

function validateCreateInput(rawInput: CreateShiftExchangeInput): CreateShiftExchangeInput {
  if (!rawInput || typeof rawInput !== 'object') throw new TeamChatRepositoryError('INVALID_EXCHANGE_REQUEST', 400)
  if (!Number.isSafeInteger(rawInput.conversation_id) || rawInput.conversation_id < 1
    || typeof rawInput.client_nonce !== 'string' || !UUID_PATTERN.test(rawInput.client_nonce)) {
    throw new TeamChatRepositoryError('INVALID_EXCHANGE_REQUEST', 400)
  }
  try {
    const exchange = validateExchangeInput(rawInput)
    return { ...exchange, conversation_id: rawInput.conversation_id, client_nonce: rawInput.client_nonce }
  } catch (error) {
    throw new TeamChatRepositoryError('INVALID_EXCHANGE_REQUEST', 400, { cause: error })
  }
}

function validRequestId(value: string): boolean {
  return UUID_PATTERN.test(value)
}

export function createExchangeService(dependencies: ExchangeServiceDependencies) {
  async function recordFailedPushes(
    exchangeRequest: ShiftExchangeRequest,
    actorUserId: string,
    eventType: 'shift_exchange_request_push_failed' | 'shift_exchange_completed_push_failed',
    employeeIds: number[],
  ): Promise<void> {
    const uniqueIds = [...new Set(employeeIds.filter(id => Number.isSafeInteger(id) && id > 0))]
    const results = await Promise.allSettled(uniqueIds.map(employeeId => dependencies.notifyEmployee(employeeId, {
      title: eventType === 'shift_exchange_request_push_failed' ? 'Nieuw dienstverzoek' : 'Rooster bijgewerkt',
      body: eventType === 'shift_exchange_request_push_failed'
        ? 'Een collega wacht op jouw reactie in Chat.'
        : 'Een afgesproken dienstwijziging is verwerkt.',
      url: `/me/chat?conversation=${exchangeRequest.conversation_id}`,
    })))
    const failedEmployeeIds = results.flatMap((result, index) => result.status === 'rejected' ? [uniqueIds[index]] : [])
    if (failedEmployeeIds.length === 0) return
    try {
      await dependencies.adapter.recordPushFailure({
        requestId: exchangeRequest.id,
        conversationId: exchangeRequest.conversation_id,
        actorUserId,
        eventType,
        failedEmployeeIds,
      })
    } catch (error) {
      console.error('[team-chat/exchanges/push-audit]', error instanceof Error ? error.message : 'Unknown error')
    }
  }

  async function createShiftExchange(user: SessionUser, rawInput: CreateShiftExchangeInput): Promise<ShiftExchangeRequest> {
    if (!user.employee_id) throw new TeamChatRepositoryError('ACTIVE_EMPLOYEE_REQUIRED', 403)
    const input = validateCreateInput(rawInput)
    await dependencies.requireConversationMember(input.conversation_id, user.user_id)
    const result = await dependencies.adapter.createExchangeAtomic({
      conversationId: input.conversation_id,
      clientNonce: input.client_nonce,
      kind: input.kind,
      sourceShiftId: input.source_shift_id,
      targetShiftId: input.target_shift_id ?? null,
      userId: user.user_id,
      employeeId: user.employee_id,
    })
    if (result.status !== 'created' && result.status !== 'duplicate') throw exchangeError(result.error_code)
    const matches = result.error_code === null && result.request
      && result.request.conversation_id === input.conversation_id
      && result.request.client_nonce === input.client_nonce
      && result.request.kind === input.kind
      && result.request.source_shift_id === input.source_shift_id
      && result.request.target_shift_id === (input.target_shift_id ?? null)
      && result.request.initiator_user_id === user.user_id
      && result.request.initiator_employee_id === user.employee_id
    if (!matches) throw new TeamChatRepositoryError('INVALID_EXCHANGE_RPC_RESPONSE', 502)

    if (result.status === 'created' && result.request.counterparty_employee_id) {
      await recordFailedPushes(result.request, user.user_id, 'shift_exchange_request_push_failed', [result.request.counterparty_employee_id])
    }
    return result.request
  }

  async function respondToShiftExchange(
    user: SessionUser,
    requestId: string,
    decision: 'accepted' | 'declined',
  ): Promise<ExchangeResponse> {
    if (!validRequestId(requestId) || (decision !== 'accepted' && decision !== 'declined')) {
      throw new TeamChatRepositoryError('INVALID_EXCHANGE_REQUEST', 400)
    }
    const exchangeRequest = await dependencies.adapter.findExchangeRequest(requestId)
    if (!exchangeRequest) throw new TeamChatRepositoryError('EXCHANGE_REQUEST_NOT_FOUND', 404)
    if (user.user_id !== exchangeRequest.initiator_user_id && user.user_id !== exchangeRequest.counterparty_user_id) {
      throw new TeamChatRepositoryError('EXCHANGE_PARTY_REQUIRED', 403)
    }
    await dependencies.requireConversationMember(exchangeRequest.conversation_id, user.user_id)

    const result = await dependencies.adapter.respondExchangeAtomic({
      requestId,
      userId: user.user_id,
      employeeId: user.employee_id,
      decision,
    })
    if (result.error_code) throw exchangeError(result.error_code)
    if (!['pending', 'declined', 'completed'].includes(result.status)
      || result.source_shift_id !== exchangeRequest.source_shift_id
      || result.target_shift_id !== exchangeRequest.target_shift_id
      || result.completed !== (result.status === 'completed')) {
      throw new TeamChatRepositoryError('INVALID_EXCHANGE_RPC_RESPONSE', 502)
    }

    if (result.completed) {
      await recordFailedPushes(
        exchangeRequest,
        user.user_id,
        'shift_exchange_completed_push_failed',
        [exchangeRequest.initiator_employee_id, exchangeRequest.counterparty_employee_id]
          .filter((id): id is number => id !== null),
      )
    }
    return { request_id: requestId, ...result, error_code: null }
  }

  return { createShiftExchange, respondToShiftExchange }
}

function databaseError(operation: string, error: unknown): Error {
  return new Error(`Team chat exchange database operation failed: ${operation}`, { cause: error })
}

function createSupabaseExchangeAdapter(client: SupabaseClient = getSupabase()): ExchangeAdapter {
  return {
    async createExchangeAtomic(input) {
      const { data, error } = await client.rpc(T('create_shift_exchange'), {
        p_conversation_id: input.conversationId,
        p_client_nonce: input.clientNonce,
        p_kind: input.kind,
        p_source_shift_id: input.sourceShiftId,
        p_target_shift_id: input.targetShiftId,
        p_user_id: input.userId,
        p_employee_id: input.employeeId,
      })
      if (error) throw databaseError('create exchange', error)
      return data as CreateExchangeAtomicResult
    },

    async findExchangeRequest(requestId) {
      const { data, error } = await client
        .from(T('shift_exchange_requests'))
        .select('*')
        .eq('id', requestId)
        .maybeSingle()
      if (error) throw databaseError('find exchange request', error)
      return data ? data as ShiftExchangeRequest : null
    },

    async respondExchangeAtomic(input) {
      const { data, error } = await client.rpc(T('respond_to_shift_exchange'), {
        p_request_id: input.requestId,
        p_user_id: input.userId,
        p_employee_id: input.employeeId,
        p_decision: input.decision,
      })
      if (error) throw databaseError('respond to exchange', error)
      return data as RespondExchangeAtomicResult
    },

    async recordPushFailure(input) {
      const { error } = await client.from(T('planning_chat_events')).insert({
        correlation_id: input.requestId,
        conversation_id: input.conversationId,
        request_id: input.requestId,
        actor_user_id: input.actorUserId,
        event_type: input.eventType,
        payload: { failed_employee_ids: input.failedEmployeeIds },
      })
      if (error && error.code !== '23505') throw databaseError('record exchange push failure', error)
    },
  }
}

let defaultService: ReturnType<typeof createExchangeService> | null = null

function exchangeService() {
  defaultService ??= createExchangeService({
    adapter: createSupabaseExchangeAdapter(),
    requireConversationMember,
    notifyEmployee: sendPushToEmployee,
  })
  return defaultService
}

export async function createShiftExchange(user: SessionUser, input: CreateShiftExchangeInput): Promise<ShiftExchangeRequest> {
  return exchangeService().createShiftExchange(user, input)
}

export async function respondToShiftExchange(
  user: SessionUser,
  requestId: string,
  decision: 'accepted' | 'declined',
): Promise<ExchangeResponse> {
  return exchangeService().respondToShiftExchange(user, requestId, decision)
}
