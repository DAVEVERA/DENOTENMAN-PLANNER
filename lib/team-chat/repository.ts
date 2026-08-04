import type { SupabaseClient } from '@supabase/supabase-js'

import type { SessionUser } from '../../types'
import type {
  CreateMessageInput,
  TeamConversationKind,
  TeamConversationSummary,
  TeamGif,
  TeamMessageType,
} from '../../types/team-chat'
import { getSupabase, T } from '../db'
import { TEAM_CHAT_MAX_MESSAGE_LENGTH, TEAM_CHAT_PAGE_SIZE } from './constants'
import { validateCreateMessage, validateReactionEmoji } from './validation'

export interface TeamConversationMember {
  id: number
  conversation_id: number
  user_id: string
  employee_id: number | null
  member_role: 'member' | 'owner'
  notification_preference: 'all' | 'mentions' | 'muted'
  inactive_at: string | null
}

export interface TeamConversationMemberMetadata extends TeamConversationMember {
  display_name: string
  account_role: SessionUser['role'] | null
}

export interface TeamChatActiveAccount {
  user_id: string
  employee_id: number | null
  role: SessionUser['role']
  employee_is_active: number | null
}

export interface TeamShiftSnapshot {
  shift_id: number
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
  assignment_version: number
}

export interface TeamMessage {
  id: number
  conversation_id: number
  message_type: TeamMessageType
  body: string | null
  gif: TeamGif | null
  sender_user_id: string | null
  sender_employee_id: number | null
  sender_display_name: string
  reply_to_message_id: number | null
  client_nonce: string
  edited_at: string | null
  created_at: string
  shift?: TeamShiftSnapshot | null
}

export interface TeamPlanningWatchSummary {
  open_shift_count: number
  pending_exchange_count: number
  conflict_exchange_count: number
  expiring_exchange_count: number
}

export interface TeamChatBootstrap {
  user: SessionUser
  conversations: TeamConversationSummary[]
  members: TeamConversationMemberMetadata[]
  planning_watch: TeamPlanningWatchSummary
  server_cursor: number
}

export interface TeamConversationRow {
  id: number
  kind: TeamConversationKind
  slug: string | null
  name: string
  description: string
  is_fixed: boolean
  status: 'active' | 'archived'
  archived_at: string | null
}

export interface TeamConversationStat {
  conversation_id: number
  latest_message_id: number | null
  latest_message_at: string | null
  unread_count: number
}

export interface TeamPlanningRequestRow {
  id: string
  conversation_id: number
  status: 'pending' | 'declined' | 'completed' | 'conflict' | 'expired' | 'cancelled'
  initiator_user_id: string
  counterparty_user_id: string
  expires_at: string
}

type TeamChatRpcFailureStatus = 'invalid' | 'forbidden' | 'not_found' | 'conflict'

export interface EnsureFixedChannelMembershipsInput {
  userId: string
  employeeId: number | null
}

export type EnsureFixedChannelMembershipsResult =
  | { status: 'ok'; error_code: null; membership_count: number }
  | { status: TeamChatRpcFailureStatus; error_code: string; membership_count: number }

export interface TeamConversationStatsInput {
  userId: string
  conversationIds: number[]
}

export type TeamConversationStatsResult =
  | { status: 'ok'; error_code: null; stats: TeamConversationStat[] }
  | { status: TeamChatRpcFailureStatus; error_code: string; stats: [] }

export interface CreateAtomicMessageInput {
  userId: string
  employeeId: number | null
  conversationId: number
  clientNonce: string
  body: string | null
  gifProvider: 'giphy' | null
  gifProviderId: string | null
  gifUrl: string | null
  gifWidth: number | null
  gifHeight: number | null
  shiftId: number | null
  replyToMessageId: number | null
}

export type CreateAtomicMessageResult =
  | { status: 'created' | 'duplicate'; error_code: null; message: TeamMessage; shift: TeamShiftSnapshot | null }
  | { status: TeamChatRpcFailureStatus; error_code: string; message: null; shift: null }

export type EditAtomicMessageResult =
  | { status: 'updated' | 'unchanged'; error_code: null; message: TeamMessage }
  | { status: TeamChatRpcFailureStatus; error_code: string; message: null }

export interface TeamReactionState {
  message_id: number
  emoji: string
  active: boolean
  count: number
}

export type ToggleReactionResult =
  | { status: 'activated' | 'deactivated'; error_code: null; reaction: TeamReactionState }
  | { status: TeamChatRpcFailureStatus; error_code: string; reaction: null }

export interface TeamReadState {
  conversation_id: number
  last_read_message_id: number
  advanced: boolean
}

export type MarkReadResult =
  | { status: 'ok'; error_code: null; read: TeamReadState }
  | { status: TeamChatRpcFailureStatus; error_code: string; read: null }

export interface TeamMessageSearchQuery {
  conversationIds: number[]
  escapedQuery: string
  limit: number
}

export interface TeamMessageListQuery {
  conversationId: number
  afterId?: number
  beforeId?: number
  limit: number
  order: 'ascending' | 'descending'
}

export interface TeamChatQueryAdapter {
  findActiveAccount(userId: string): Promise<TeamChatActiveAccount | null>
  findTeamChatOwner(userId: string): Promise<{ user_id: string } | null>
  findConversationMember(conversationId: number, userId: string): Promise<TeamConversationMember | null>
  findConversationStatus(conversationId: number): Promise<'active' | 'archived' | null>
  restoreFixedChannelMemberships(input: EnsureFixedChannelMembershipsInput): Promise<EnsureFixedChannelMembershipsResult>
  listConversationMemberships(userId: string): Promise<TeamConversationMember[]>
  listConversationsByIds(conversationIds: number[]): Promise<TeamConversationRow[]>
  listConversationMembers(conversationIds: number[]): Promise<TeamConversationMemberMetadata[]>
  getConversationStats(input: TeamConversationStatsInput): Promise<TeamConversationStatsResult>
  listPlanningRequests(conversationIds: number[]): Promise<TeamPlanningRequestRow[]>
  countOpenShifts(): Promise<number>
  listMessages(query: TeamMessageListQuery): Promise<TeamMessage[]>
  findMessageById(messageId: number): Promise<TeamMessage | null>
  createMessageAtomic(input: CreateAtomicMessageInput): Promise<CreateAtomicMessageResult>
  editMessageAtomic(input: { userId: string; employeeId: number | null; messageId: number; body: string }): Promise<EditAtomicMessageResult>
  toggleReactionAtomic(input: { userId: string; employeeId: number | null; messageId: number; emoji: string }): Promise<ToggleReactionResult>
  markConversationReadAtomic(input: { userId: string; employeeId: number | null; conversationId: number; messageId: number }): Promise<MarkReadResult>
  searchMessages(input: TeamMessageSearchQuery): Promise<TeamMessage[]>
}

export class TeamChatRepositoryError extends Error {
  constructor(
    public readonly code: string,
    public readonly status: number,
    options?: ErrorOptions,
  ) {
    super(code, options)
    this.name = 'TeamChatRepositoryError'
  }
}

class TeamChatDatabaseError extends Error {
  readonly code = 'TEAM_CHAT_DATABASE_ERROR'

  constructor(
    operation: string,
    public readonly databaseCode: string | undefined,
    cause: unknown,
  ) {
    super(`Team chat database operation failed: ${operation}`, { cause })
    this.name = 'TeamChatDatabaseError'
  }
}

type SupabaseError = { code?: string; message?: string }
type MessageDatabaseRow = {
  id: number
  conversation_id: number
  message_type: TeamMessageType
  body: string | null
  gif_provider: 'giphy' | null
  gif_provider_id: string | null
  gif_url: string | null
  gif_width: number | null
  gif_height: number | null
  sender_user_id: string | null
  sender_employee_id: number | null
  sender_display_name: string
  reply_to_message_id: number | null
  client_nonce: string
  edited_at: string | null
  created_at: string
}

type ShiftLinkDatabaseRow = {
  message_id: number
  shift_id: number
  snapshot_employee_id: number | null
  snapshot_employee_name: string
  snapshot_week_number: number
  snapshot_year: number
  snapshot_day_of_week: string
  snapshot_shift_type: string
  snapshot_start_time: string | null
  snapshot_end_time: string | null
  snapshot_full_day: number
  snapshot_break_minutes: number
  snapshot_location: string
  snapshot_assignment_version: number
}

function databaseError(operation: string, error: unknown): TeamChatDatabaseError {
  return new TeamChatDatabaseError(operation, (error as SupabaseError | null)?.code, error)
}

function assertNoDatabaseError(operation: string, error: unknown): void {
  if (error) throw databaseError(operation, error)
}

function shiftLinkToSnapshot(row: ShiftLinkDatabaseRow): TeamShiftSnapshot {
  return {
    shift_id: row.shift_id,
    employee_id: row.snapshot_employee_id,
    employee_name: row.snapshot_employee_name,
    week_number: row.snapshot_week_number,
    year: row.snapshot_year,
    day_of_week: row.snapshot_day_of_week,
    shift_type: row.snapshot_shift_type,
    start_time: row.snapshot_start_time,
    end_time: row.snapshot_end_time,
    full_day: row.snapshot_full_day,
    break_minutes: row.snapshot_break_minutes,
    location: row.snapshot_location,
    assignment_version: row.snapshot_assignment_version,
  }
}

function databaseRowToMessage(row: MessageDatabaseRow, shift?: TeamShiftSnapshot | null): TeamMessage {
  const gif = row.message_type === 'gif' && row.gif_provider === 'giphy' && row.gif_provider_id && row.gif_url
    && row.gif_width && row.gif_height
    ? {
        provider: row.gif_provider,
        id: row.gif_provider_id,
        url: row.gif_url,
        width: row.gif_width,
        height: row.gif_height,
      } satisfies TeamGif
    : null

  return {
    id: Number(row.id),
    conversation_id: Number(row.conversation_id),
    message_type: row.message_type,
    body: row.body,
    gif,
    sender_user_id: row.sender_user_id,
    sender_employee_id: row.sender_employee_id,
    sender_display_name: row.sender_display_name,
    reply_to_message_id: row.reply_to_message_id === null ? null : Number(row.reply_to_message_id),
    client_nonce: row.client_nonce,
    edited_at: row.edited_at,
    created_at: row.created_at,
    ...(shift === undefined ? {} : { shift }),
  }
}

async function hydrateMessages(client: SupabaseClient, rows: MessageDatabaseRow[]): Promise<TeamMessage[]> {
  if (rows.length === 0) return []

  const shiftMessageIds = rows.filter(row => row.message_type === 'shift').map(row => row.id)
  if (shiftMessageIds.length === 0) return rows.map(row => databaseRowToMessage(row))

  const { data, error } = await client
    .from(T('team_message_shift_links'))
    .select('*')
    .in('message_id', shiftMessageIds)
  assertNoDatabaseError('hydrate message shift links', error)

  const links = new Map<number, TeamShiftSnapshot>()
  for (const rawLink of (data ?? []) as ShiftLinkDatabaseRow[]) {
    links.set(Number(rawLink.message_id), shiftLinkToSnapshot(rawLink))
  }

  return rows.map(row => databaseRowToMessage(row, row.message_type === 'shift' ? links.get(Number(row.id)) ?? null : undefined))
}

/**
 * The only production boundary between the domain repository and Supabase.
 * Tests inject the same adapter contract and never instantiate a live client.
 */
export function createSupabaseTeamChatQueryAdapter(): TeamChatQueryAdapter {
  const client = getSupabase()

  return {
    async findActiveAccount(userId) {
      const { data: account, error: accountError } = await client
        .from(T('users'))
        .select('username, employee_id, role')
        .eq('username', userId)
        .maybeSingle()
      assertNoDatabaseError('find active team chat account', accountError)
      if (!account) return null

      let employeeIsActive: number | null = null
      if (account.employee_id !== null) {
        const { data: employee, error: employeeError } = await client
          .from(T('employees'))
          .select('is_active')
          .eq('id', account.employee_id)
          .maybeSingle()
        assertNoDatabaseError('find linked team chat employee', employeeError)
        employeeIsActive = employee?.is_active === undefined ? null : Number(employee.is_active)
      }

      return {
        user_id: String(account.username),
        employee_id: account.employee_id === null ? null : Number(account.employee_id),
        role: account.role as SessionUser['role'],
        employee_is_active: employeeIsActive,
      }
    },

    async findTeamChatOwner(userId) {
      const { data, error } = await client
        .from(T('team_chat_managers'))
        .select('user_id')
        .eq('user_id', userId)
        .is('inactive_at', null)
        .maybeSingle()
      assertNoDatabaseError('find team chat owner', error)
      return data ? { user_id: String(data.user_id) } : null
    },

    async findConversationMember(conversationId, userId) {
      const { data, error } = await client
        .from(T('team_conversation_members'))
        .select('id, conversation_id, user_id, employee_id, member_role, notification_preference, inactive_at')
        .eq('conversation_id', conversationId)
        .eq('user_id', userId)
        .is('inactive_at', null)
        .maybeSingle()
      assertNoDatabaseError('find conversation member', error)
      return data ? data as TeamConversationMember : null
    },

    async findConversationStatus(conversationId) {
      const { data, error } = await client
        .from(T('team_conversations'))
        .select('status')
        .eq('id', conversationId)
        .maybeSingle()
      assertNoDatabaseError('find conversation status', error)
      if (!data) return null
      return data.status === 'active' ? 'active' : 'archived'
    },

    async restoreFixedChannelMemberships(input) {
      const { data, error } = await client.rpc(T('ensure_fixed_channel_memberships'), {
        p_user_id: input.userId,
        p_employee_id: input.employeeId,
      })
      assertNoDatabaseError('restore fixed conversation memberships', error)
      return data as EnsureFixedChannelMembershipsResult
    },

    async listConversationMemberships(userId) {
      const { data, error } = await client
        .from(T('team_conversation_members'))
        .select('id, conversation_id, user_id, employee_id, member_role, notification_preference, inactive_at')
        .eq('user_id', userId)
        .is('inactive_at', null)
        .order('conversation_id', { ascending: true })
      assertNoDatabaseError('list conversation memberships', error)
      return (data ?? []) as TeamConversationMember[]
    },

    async listConversationsByIds(conversationIds) {
      if (conversationIds.length === 0) return []
      const { data, error } = await client
        .from(T('team_conversations'))
        .select('id, kind, slug, name, description, is_fixed, status, archived_at')
        .in('id', conversationIds)
        .eq('status', 'active')
        .order('is_fixed', { ascending: false })
        .order('name', { ascending: true })
      assertNoDatabaseError('list member conversations', error)
      return (data ?? []) as TeamConversationRow[]
    },

    async listConversationMembers(conversationIds) {
      if (conversationIds.length === 0) return []
      const { data: memberData, error: memberError } = await client
        .from(T('team_conversation_members'))
        .select('id, conversation_id, user_id, employee_id, member_role, notification_preference, inactive_at')
        .in('conversation_id', conversationIds)
        .is('inactive_at', null)
        .order('conversation_id', { ascending: true })
        .order('id', { ascending: true })
      assertNoDatabaseError('list conversation member metadata', memberError)

      const members = (memberData ?? []) as TeamConversationMember[]
      const userIds = [...new Set(members.map(member => member.user_id))]
      if (userIds.length === 0) return []

      const { data: accountData, error: accountError } = await client
        .from(T('users'))
        .select('username, display_name, role')
        .in('username', userIds)
      assertNoDatabaseError('list conversation member accounts', accountError)

      const accounts = new Map<string, { display_name: string; role: SessionUser['role'] }>()
      for (const account of accountData ?? []) {
        accounts.set(String(account.username), {
          display_name: String(account.display_name || account.username),
          role: account.role as SessionUser['role'],
        })
      }

      return members.map(member => ({
        ...member,
        display_name: accounts.get(member.user_id)?.display_name ?? member.user_id,
        account_role: accounts.get(member.user_id)?.role ?? null,
      }))
    },

    async getConversationStats(input) {
      const { data, error } = await client.rpc(T('team_chat_bootstrap_stats'), {
        p_user_id: input.userId,
        p_conversation_ids: input.conversationIds,
      })
      assertNoDatabaseError('get batched conversation stats', error)
      return data as TeamConversationStatsResult
    },

    async listPlanningRequests(conversationIds) {
      if (conversationIds.length === 0) return []
      const { data, error } = await client
        .from(T('shift_exchange_requests'))
        .select('id, conversation_id, status, initiator_user_id, counterparty_user_id, expires_at')
        .in('conversation_id', conversationIds)
        .in('status', ['pending', 'conflict'])
      assertNoDatabaseError('list planning watch requests', error)
      return (data ?? []) as TeamPlanningRequestRow[]
    },

    async countOpenShifts() {
      const { count, error } = await client
        .from(T('shifts'))
        .select('id', { count: 'exact', head: true })
        .is('archived_at', null)
        .eq('is_open', 1)
      assertNoDatabaseError('count open shifts', error)
      return count ?? 0
    },

    async listMessages(input) {
      let query = client
        .from(T('team_messages'))
        .select('*')
        .eq('conversation_id', input.conversationId)
      if (input.afterId !== undefined) query = query.gt('id', input.afterId)
      if (input.beforeId !== undefined) query = query.lt('id', input.beforeId)
      const { data, error } = await query
        .order('id', { ascending: input.order === 'ascending' })
        .limit(input.limit)
      assertNoDatabaseError('list chat messages', error)
      return hydrateMessages(client, (data ?? []) as MessageDatabaseRow[])
    },

    async findMessageById(messageId) {
      const { data, error } = await client
        .from(T('team_messages'))
        .select('*')
        .eq('id', messageId)
        .maybeSingle()
      assertNoDatabaseError('find message by id', error)
      if (!data) return null
      return (await hydrateMessages(client, [data as MessageDatabaseRow]))[0]
    },

    async createMessageAtomic(input) {
      const { data, error } = await client.rpc(T('create_team_message'), {
        p_user_id: input.userId,
        p_employee_id: input.employeeId,
        p_conversation_id: input.conversationId,
        p_client_nonce: input.clientNonce,
        p_body: input.body,
        p_gif_provider: input.gifProvider,
        p_gif_provider_id: input.gifProviderId,
        p_gif_url: input.gifUrl,
        p_gif_width: input.gifWidth,
        p_gif_height: input.gifHeight,
        p_shift_id: input.shiftId,
        p_reply_to_message_id: input.replyToMessageId,
      })
      assertNoDatabaseError('create atomic team chat message', error)
      return data as CreateAtomicMessageResult
    },

    async editMessageAtomic(input) {
      const { data, error } = await client.rpc(T('edit_team_message'), {
        p_user_id: input.userId,
        p_employee_id: input.employeeId,
        p_message_id: input.messageId,
        p_body: input.body,
      })
      assertNoDatabaseError('edit team chat message', error)
      return data as EditAtomicMessageResult
    },

    async toggleReactionAtomic(input) {
      const { data, error } = await client.rpc(T('toggle_team_message_reaction'), {
        p_user_id: input.userId,
        p_employee_id: input.employeeId,
        p_message_id: input.messageId,
        p_emoji: input.emoji,
      })
      assertNoDatabaseError('toggle team chat reaction', error)
      return data as ToggleReactionResult
    },

    async markConversationReadAtomic(input) {
      const { data, error } = await client.rpc(T('mark_team_conversation_read'), {
        p_user_id: input.userId,
        p_employee_id: input.employeeId,
        p_conversation_id: input.conversationId,
        p_message_id: input.messageId,
      })
      assertNoDatabaseError('mark team chat conversation read', error)
      return data as MarkReadResult
    },

    async searchMessages(input) {
      if (input.conversationIds.length === 0) return []
      const { data, error } = await client
        .from(T('team_messages'))
        .select('*')
        .in('conversation_id', input.conversationIds)
        .not('body', 'is', null)
        .ilike('body', `%${input.escapedQuery}%`)
        .order('id', { ascending: false })
        .limit(input.limit)
      assertNoDatabaseError('search team chat messages', error)
      return hydrateMessages(client, (data ?? []) as MessageDatabaseRow[])
    },
  }
}

export function escapePostgrestLikePattern(value: string): string {
  return value.replace(/[\\%_]/g, character => `\\${character}`)
}

function requirePositiveCursor(value: number | undefined, field: string): void {
  if (value !== undefined && (!Number.isSafeInteger(value) || value < 1)) {
    throw new TeamChatRepositoryError(`INVALID_${field.toUpperCase()}`, 400)
  }
}

const RPC_ERROR_CONTRACT: Record<string, { code: string; status: number }> = {
  invalid_actor: { code: 'ACTIVE_TEAM_CHAT_ACCOUNT_REQUIRED', status: 403 },
  account_not_found: { code: 'ACTIVE_TEAM_CHAT_ACCOUNT_REQUIRED', status: 403 },
  employee_mismatch: { code: 'ACTIVE_TEAM_CHAT_ACCOUNT_REQUIRED', status: 403 },
  employee_inactive: { code: 'ACTIVE_TEAM_CHAT_ACCOUNT_REQUIRED', status: 403 },
  conversation_not_active: { code: 'ACTIVE_CONVERSATION_REQUIRED', status: 403 },
  conversation_membership_required: { code: 'CONVERSATION_MEMBERSHIP_REQUIRED', status: 403 },
  client_nonce_conversation_conflict: { code: 'CLIENT_NONCE_CONVERSATION_CONFLICT', status: 409 },
  invalid_request: { code: 'INVALID_MESSAGE_REQUEST', status: 400 },
  invalid_content: { code: 'INVALID_MESSAGE_CONTENT', status: 400 },
  invalid_giphy: { code: 'INVALID_GIPHY', status: 400 },
  reply_message_not_in_conversation: { code: 'REPLY_MESSAGE_NOT_IN_CONVERSATION', status: 400 },
  shift_not_found: { code: 'SHIFT_NOT_FOUND', status: 404 },
  message_not_found: { code: 'MESSAGE_NOT_FOUND', status: 404 },
  message_not_editable: { code: 'MESSAGE_NOT_EDITABLE', status: 403 },
  invalid_emoji: { code: 'INVALID_REACTION_EMOJI', status: 400 },
  read_message_not_in_conversation: { code: 'READ_MESSAGE_NOT_IN_CONVERSATION', status: 400 },
  fixed_channels_unavailable: { code: 'FIXED_CHANNELS_UNAVAILABLE', status: 409 },
  invalid_conversation_ids: { code: 'INVALID_CONVERSATION_IDS', status: 400 },
}

function rpcBusinessError(errorCode: string | null | undefined): TeamChatRepositoryError {
  const mapped = errorCode ? RPC_ERROR_CONTRACT[errorCode] : undefined
  if (!mapped) return new TeamChatRepositoryError('INVALID_TEAM_CHAT_RPC_RESPONSE', 502)
  return new TeamChatRepositoryError(mapped.code, mapped.status)
}

export function createTeamChatRepository(adapter: TeamChatQueryAdapter) {
  async function requireActiveAccount(identity: string | SessionUser): Promise<TeamChatActiveAccount> {
    const userId = typeof identity === 'string' ? identity : identity.user_id
    const account = await adapter.findActiveAccount(userId)
    const sessionEmployeeMatches = typeof identity === 'string'
      || account?.employee_id === identity.employee_id
    const sessionRoleMatches = typeof identity === 'string'
      || account?.role === identity.role
    const activeIdentity = account?.employee_id === null
      ? account.role === 'admin'
      : account?.employee_is_active === 1

    if (!account || account.user_id !== userId || !sessionEmployeeMatches || !sessionRoleMatches || !activeIdentity) {
      throw new TeamChatRepositoryError('ACTIVE_TEAM_CHAT_ACCOUNT_REQUIRED', 403)
    }
    return account
  }

  async function requireConversationMemberAfterAccountCheck(
    conversationId: number,
    userId: string,
  ): Promise<TeamConversationMember> {
    if (!Number.isSafeInteger(conversationId) || conversationId < 1 || !userId) {
      throw new TeamChatRepositoryError('CONVERSATION_MEMBERSHIP_REQUIRED', 403)
    }

    const member = await adapter.findConversationMember(conversationId, userId)
    if (!member || member.inactive_at !== null) {
      throw new TeamChatRepositoryError('CONVERSATION_MEMBERSHIP_REQUIRED', 403)
    }
    const conversationStatus = await adapter.findConversationStatus(conversationId)
    if (conversationStatus !== 'active') {
      throw new TeamChatRepositoryError('ACTIVE_CONVERSATION_REQUIRED', 403)
    }
    return member
  }

  async function isTeamChatOwner(userId: string): Promise<boolean> {
    await requireActiveAccount(userId)
    return (await adapter.findTeamChatOwner(userId)) !== null
  }

  async function requireConversationMember(conversationId: number, userId: string): Promise<TeamConversationMember> {
    await requireActiveAccount(userId)
    return requireConversationMemberAfterAccountCheck(conversationId, userId)
  }

  async function ensureFixedChannelMembershipsAfterAccountCheck(user: SessionUser): Promise<void> {
    const result = await adapter.restoreFixedChannelMemberships({
      userId: user.user_id,
      employeeId: user.employee_id,
    })
    if (result.status !== 'ok') throw rpcBusinessError(result.error_code)
    if (result.error_code !== null || result.membership_count !== 4) {
      throw new TeamChatRepositoryError('INVALID_TEAM_CHAT_RPC_RESPONSE', 502)
    }
  }

  async function ensureFixedChannelMemberships(user: SessionUser): Promise<void> {
    await requireActiveAccount(user)
    return ensureFixedChannelMembershipsAfterAccountCheck(user)
  }

  async function getChatBootstrap(user: SessionUser): Promise<TeamChatBootstrap> {
    await requireActiveAccount(user)
    await ensureFixedChannelMembershipsAfterAccountCheck(user)
    const memberships = await adapter.listConversationMemberships(user.user_id)
    const membershipIds = [...new Set(memberships.map(member => member.conversation_id))]
    const conversations = await adapter.listConversationsByIds(membershipIds)
    const accessibleIds = conversations.map(conversation => conversation.id)

    const [members, planningRequests, openShiftCount, statsResult] = await Promise.all([
      adapter.listConversationMembers(accessibleIds),
      adapter.listPlanningRequests(accessibleIds),
      adapter.countOpenShifts(),
      adapter.getConversationStats({ userId: user.user_id, conversationIds: accessibleIds }),
    ])

    if (statsResult.status !== 'ok') throw rpcBusinessError(statsResult.error_code)
    if (statsResult.error_code !== null || !Array.isArray(statsResult.stats)) {
      throw new TeamChatRepositoryError('INVALID_TEAM_CHAT_RPC_RESPONSE', 502)
    }
    const accessibleIdSet = new Set(accessibleIds)
    if (statsResult.stats.some(stat => !accessibleIdSet.has(stat.conversation_id))) {
      throw new TeamChatRepositoryError('INVALID_TEAM_CHAT_RPC_RESPONSE', 502)
    }

    const memberCounts = new Map<number, number>()
    for (const member of members) {
      memberCounts.set(member.conversation_id, (memberCounts.get(member.conversation_id) ?? 0) + 1)
    }
    const statsByConversation = new Map(statsResult.stats.map(stat => [stat.conversation_id, stat]))

    const userPlanningRequests = planningRequests.filter(request => (
      request.initiator_user_id === user.user_id || request.counterparty_user_id === user.user_id
    ))
    const now = Date.now()
    const expiringCutoff = now + (24 * 60 * 60 * 1000)
    const serverCursor = statsResult.stats.reduce((maximum, stat) => Math.max(maximum, stat.latest_message_id ?? 0), 0)

    return {
      user: { ...user },
      conversations: conversations.map(conversation => ({
        id: conversation.id,
        kind: conversation.kind,
        slug: conversation.slug,
        name: conversation.name,
        description: conversation.description,
        fixed: conversation.is_fixed,
        member_count: memberCounts.get(conversation.id) ?? 0,
        unread_count: statsByConversation.get(conversation.id)?.unread_count ?? 0,
        last_message_at: statsByConversation.get(conversation.id)?.latest_message_at ?? null,
        archived_at: conversation.archived_at,
      })),
      members,
      planning_watch: {
        open_shift_count: openShiftCount,
        pending_exchange_count: userPlanningRequests.filter(request => request.status === 'pending').length,
        conflict_exchange_count: userPlanningRequests.filter(request => request.status === 'conflict').length,
        expiring_exchange_count: userPlanningRequests.filter(request => {
          const expiresAt = Date.parse(request.expires_at)
          return request.status === 'pending' && expiresAt > now && expiresAt <= expiringCutoff
        }).length,
      },
      server_cursor: serverCursor,
    }
  }

  async function listMessages(input: {
    conversationId: number
    userId: string
    afterId?: number
    beforeId?: number
  }): Promise<TeamMessage[]> {
    await requireActiveAccount(input.userId)
    requirePositiveCursor(input.afterId, 'after_id')
    requirePositiveCursor(input.beforeId, 'before_id')
    if (input.afterId !== undefined && input.beforeId !== undefined) {
      throw new TeamChatRepositoryError('AMBIGUOUS_MESSAGE_CURSOR', 400)
    }

    await requireConversationMemberAfterAccountCheck(input.conversationId, input.userId)
    const descending = input.afterId === undefined
    const messages = await adapter.listMessages({
      conversationId: input.conversationId,
      ...(input.afterId === undefined ? {} : { afterId: input.afterId }),
      ...(input.beforeId === undefined ? {} : { beforeId: input.beforeId }),
      limit: TEAM_CHAT_PAGE_SIZE,
      order: descending ? 'descending' : 'ascending',
    })
    return descending ? [...messages].reverse() : messages
  }

  async function createMessage(user: SessionUser, rawInput: CreateMessageInput): Promise<TeamMessage> {
    await requireActiveAccount(user)
    let input: CreateMessageInput
    try {
      input = validateCreateMessage(rawInput)
    } catch (error) {
      throw new TeamChatRepositoryError('INVALID_MESSAGE_CONTENT', 400, { cause: error })
    }
    await requireConversationMemberAfterAccountCheck(input.conversation_id, user.user_id)

    if (input.reply_to_id !== undefined) {
      const reply = await adapter.findMessageById(input.reply_to_id)
      if (!reply || reply.conversation_id !== input.conversation_id) {
        throw new TeamChatRepositoryError('REPLY_MESSAGE_NOT_IN_CONVERSATION', 400)
      }
    }

    const result = await adapter.createMessageAtomic({
      userId: user.user_id,
      employeeId: user.employee_id,
      conversationId: input.conversation_id,
      clientNonce: input.client_nonce,
      body: input.body ?? null,
      gifProvider: input.gif?.provider ?? null,
      gifProviderId: input.gif?.id ?? null,
      gifUrl: input.gif?.url ?? null,
      gifWidth: input.gif?.width ?? null,
      gifHeight: input.gif?.height ?? null,
      shiftId: input.shift_id ?? null,
      replyToMessageId: input.reply_to_id ?? null,
    })

    if (result.status !== 'created' && result.status !== 'duplicate') {
      throw rpcBusinessError(result.error_code)
    }
    const responseMatchesRequest = result.error_code === null
      && result.message !== null
      && result.message.conversation_id === input.conversation_id
      && result.message.sender_user_id === user.user_id
      && result.message.client_nonce === input.client_nonce
      && (input.shift_id === undefined ? result.shift === null : result.shift?.shift_id === input.shift_id)
    if (!responseMatchesRequest) {
      throw new TeamChatRepositoryError('INVALID_TEAM_CHAT_RPC_RESPONSE', 502)
    }
    return result.shift ? { ...result.message, shift: result.shift } : result.message
  }

  async function editMessage(user: SessionUser, messageId: number, bodyInput: string): Promise<TeamMessage> {
    await requireActiveAccount(user)
    if (!Number.isSafeInteger(messageId) || messageId < 1) {
      throw new TeamChatRepositoryError('INVALID_MESSAGE_ID', 400)
    }
    const body = typeof bodyInput === 'string' ? bodyInput.trim() : ''
    if (!body || body.length > TEAM_CHAT_MAX_MESSAGE_LENGTH) {
      throw new TeamChatRepositoryError('INVALID_MESSAGE_CONTENT', 400)
    }

    const result = await adapter.editMessageAtomic({
      userId: user.user_id,
      employeeId: user.employee_id,
      messageId,
      body,
    })
    if (result.status !== 'updated' && result.status !== 'unchanged') {
      throw rpcBusinessError(result.error_code)
    }
    if (result.error_code !== null || !result.message || result.message.id !== messageId || result.message.body !== body) {
      throw new TeamChatRepositoryError('INVALID_TEAM_CHAT_RPC_RESPONSE', 502)
    }
    return result.message
  }

  async function toggleReaction(user: SessionUser, messageId: number, emojiInput: unknown): Promise<TeamReactionState> {
    await requireActiveAccount(user)
    if (!Number.isSafeInteger(messageId) || messageId < 1) {
      throw new TeamChatRepositoryError('INVALID_MESSAGE_ID', 400)
    }
    let emoji: string
    try {
      emoji = validateReactionEmoji(emojiInput)
    } catch (error) {
      throw new TeamChatRepositoryError('INVALID_REACTION_EMOJI', 400, { cause: error })
    }

    const result = await adapter.toggleReactionAtomic({
      userId: user.user_id,
      employeeId: user.employee_id,
      messageId,
      emoji,
    })
    if (result.status !== 'activated' && result.status !== 'deactivated') {
      throw rpcBusinessError(result.error_code)
    }
    if (result.error_code !== null || !result.reaction || result.reaction.message_id !== messageId || result.reaction.emoji !== emoji) {
      throw new TeamChatRepositoryError('INVALID_TEAM_CHAT_RPC_RESPONSE', 502)
    }
    return result.reaction
  }

  async function markConversationRead(
    user: SessionUser,
    conversationId: number,
    messageId: number,
  ): Promise<TeamReadState> {
    await requireActiveAccount(user)
    if (!Number.isSafeInteger(messageId) || messageId < 1) {
      throw new TeamChatRepositoryError('INVALID_MESSAGE_ID', 400)
    }
    await requireConversationMemberAfterAccountCheck(conversationId, user.user_id)
    const result = await adapter.markConversationReadAtomic({
      userId: user.user_id,
      employeeId: user.employee_id,
      conversationId,
      messageId,
    })
    if (result.status !== 'ok') throw rpcBusinessError(result.error_code)
    if (result.error_code !== null || !result.read || result.read.conversation_id !== conversationId || result.read.last_read_message_id < 1) {
      throw new TeamChatRepositoryError('INVALID_TEAM_CHAT_RPC_RESPONSE', 502)
    }
    return result.read
  }

  async function searchTeamMessages(user: SessionUser, queryInput: string): Promise<TeamMessage[]> {
    await requireActiveAccount(user)
    const query = typeof queryInput === 'string' ? queryInput.trim() : ''
    if (query.length < 2 || query.length > 80) {
      throw new TeamChatRepositoryError('INVALID_SEARCH_QUERY', 400)
    }
    const memberships = await adapter.listConversationMemberships(user.user_id)
    const memberConversationIds = [...new Set(memberships.map(membership => membership.conversation_id))]
    const activeConversations = await adapter.listConversationsByIds(memberConversationIds)
    return adapter.searchMessages({
      conversationIds: activeConversations.map(conversation => conversation.id),
      escapedQuery: escapePostgrestLikePattern(query),
      limit: TEAM_CHAT_PAGE_SIZE,
    })
  }

  return {
    isTeamChatOwner,
    requireConversationMember,
    ensureFixedChannelMemberships,
    getChatBootstrap,
    listMessages,
    createMessage,
    editMessage,
    toggleReaction,
    markConversationRead,
    searchTeamMessages,
  }
}

let defaultRepository: ReturnType<typeof createTeamChatRepository> | null = null

function repository() {
  defaultRepository ??= createTeamChatRepository(createSupabaseTeamChatQueryAdapter())
  return defaultRepository
}

export async function isTeamChatOwner(userId: string): Promise<boolean> {
  return repository().isTeamChatOwner(userId)
}

export async function requireConversationMember(
  conversationId: number,
  userId: string,
): Promise<TeamConversationMember> {
  return repository().requireConversationMember(conversationId, userId)
}

export async function ensureFixedChannelMemberships(user: SessionUser): Promise<void> {
  return repository().ensureFixedChannelMemberships(user)
}

export async function getChatBootstrap(user: SessionUser): Promise<TeamChatBootstrap> {
  return repository().getChatBootstrap(user)
}

export async function listMessages(input: {
  conversationId: number
  userId: string
  afterId?: number
  beforeId?: number
}): Promise<TeamMessage[]> {
  return repository().listMessages(input)
}

export async function createMessage(user: SessionUser, input: CreateMessageInput): Promise<TeamMessage> {
  return repository().createMessage(user, input)
}

export async function editMessage(user: SessionUser, messageId: number, body: string): Promise<TeamMessage> {
  return repository().editMessage(user, messageId, body)
}

export async function toggleReaction(user: SessionUser, messageId: number, emoji: unknown): Promise<TeamReactionState> {
  return repository().toggleReaction(user, messageId, emoji)
}

export async function markConversationRead(
  user: SessionUser,
  conversationId: number,
  messageId: number,
): Promise<TeamReadState> {
  return repository().markConversationRead(user, conversationId, messageId)
}

export async function searchTeamMessages(user: SessionUser, query: string): Promise<TeamMessage[]> {
  return repository().searchTeamMessages(user, query)
}
