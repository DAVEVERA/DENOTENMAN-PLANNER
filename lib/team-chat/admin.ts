import type { SessionUser, Location } from '../../types'
import type { TeamConversationKind } from '../../types/team-chat'
import { getSupabase, T } from '../db'
import { canManageTeamChat } from './permissions'
import { isTeamChatOwner, TeamChatRepositoryError } from './repository'

export interface ManagedConversationInput {
  id?: number
  kind: 'direct' | 'group'
  name: string
  member_user_ids: string[]
  owner_user_ids: string[]
  archived: boolean
}

export interface TeamChatAccountOption {
  user_id: string
  display_name: string
  role: SessionUser['role']
  employee_id: number | null
  location: Location | null
  is_chat_manager: boolean
}

export interface ManagedConversation {
  id: number
  kind: TeamConversationKind
  name: string
  description: string
  fixed: boolean
  archived: boolean
  members: Array<{ user_id: string; employee_id: number | null; role: 'member' | 'owner'; inactive: boolean }>
}

export interface TeamChatAdminData {
  can_manage_owners: boolean
  conversations: ManagedConversation[]
  accounts: TeamChatAccountOption[]
}

export function validateManagedConversationInput(value: unknown): ManagedConversationInput {
  const raw = (value ?? {}) as Partial<ManagedConversationInput>
  const id = raw.id === undefined ? undefined : Number(raw.id)
  const kind = raw.kind
  const name = String(raw.name ?? '').trim()
  const members = [...new Set(Array.isArray(raw.member_user_ids) ? raw.member_user_ids.map(String).map(item => item.trim()).filter(Boolean) : [])]
  const owners = [...new Set(Array.isArray(raw.owner_user_ids) ? raw.owner_user_ids.map(String).map(item => item.trim()).filter(Boolean) : [])]

  if ((id !== undefined && (!Number.isSafeInteger(id) || id < 1))
    || (kind !== 'direct' && kind !== 'group')
    || name.length < 2 || name.length > 80
    || (kind === 'direct' ? members.length !== 2 : members.length < 2)
    || owners.length < 1
    || owners.some(owner => !members.includes(owner))) {
    throw new TeamChatRepositoryError('INVALID_CONVERSATION_INPUT', 400)
  }
  return {
    ...(id ? { id } : {}),
    kind,
    name,
    member_user_ids: members,
    owner_user_ids: owners,
    archived: Boolean(raw.archived),
  }
}

async function requireManager(user: SessionUser): Promise<boolean> {
  const explicitOwner = user.role === 'admin' ? false : await isTeamChatOwner(user.user_id)
  if (!canManageTeamChat(user, explicitOwner)) throw new TeamChatRepositoryError('TEAM_CHAT_MANAGEMENT_REQUIRED', 403)
  return explicitOwner
}

export async function listTeamChatAdminData(user: SessionUser): Promise<TeamChatAdminData> {
  await requireManager(user)
  const client = getSupabase()
  const [conversationResult, membershipResult, accountResult, employeeResult, managerResult] = await Promise.all([
    client.from(T('team_conversations')).select('id, kind, name, description, is_fixed, status').order('is_fixed', { ascending: false }).order('id'),
    client.from(T('team_conversation_members')).select('conversation_id, user_id, employee_id, member_role, inactive_at').order('id'),
    client.from(T('users')).select('username, display_name, role, employee_id').order('display_name'),
    client.from(T('employees')).select('id, location, is_active'),
    client.from(T('team_chat_managers')).select('user_id, inactive_at'),
  ])
  const error = conversationResult.error || membershipResult.error || accountResult.error || employeeResult.error || managerResult.error
  if (error) throw new Error(error.message)

  const employeeLocation = new Map((employeeResult.data ?? [])
    .filter(employee => Number(employee.is_active) === 1)
    .map(employee => [Number(employee.id), employee.location as Location]))
  const activeManagers = new Set((managerResult.data ?? [])
    .filter(manager => manager.inactive_at === null)
    .map(manager => String(manager.user_id)))
  const members = membershipResult.data ?? []

  return {
    can_manage_owners: user.role === 'admin',
    conversations: (conversationResult.data ?? []).map(conversation => ({
      id: Number(conversation.id),
      kind: conversation.kind as TeamConversationKind,
      name: String(conversation.name),
      description: String(conversation.description ?? ''),
      fixed: Boolean(conversation.is_fixed),
      archived: conversation.status === 'archived',
      members: members.filter(member => Number(member.conversation_id) === Number(conversation.id)).map(member => ({
        user_id: String(member.user_id),
        employee_id: member.employee_id === null ? null : Number(member.employee_id),
        role: member.member_role as 'member' | 'owner',
        inactive: member.inactive_at !== null,
      })),
    })),
    accounts: (accountResult.data ?? []).map(account => ({
      user_id: String(account.username),
      display_name: String(account.display_name || account.username),
      role: account.role as SessionUser['role'],
      employee_id: account.employee_id === null ? null : Number(account.employee_id),
      location: account.employee_id === null ? null : employeeLocation.get(Number(account.employee_id)) ?? null,
      is_chat_manager: activeManagers.has(String(account.username)),
    })),
  }
}

export async function manageTeamConversation(user: SessionUser, value: unknown): Promise<{ conversation_id: number }> {
  await requireManager(user)
  const input = validateManagedConversationInput(value)
  const { data, error } = await getSupabase().rpc('planner20_manage_team_conversation', {
    p_actor_user_id: user.user_id,
    p_conversation_id: input.id ?? null,
    p_kind: input.kind,
    p_name: input.name,
    p_member_user_ids: input.member_user_ids,
    p_owner_user_ids: input.owner_user_ids,
    p_archived: input.archived,
  })
  if (error) throw new Error(error.message)
  const result = data as { status?: string; error_code?: string | null; conversation_id?: number | null }
  if ((result.status !== 'created' && result.status !== 'updated') || !result.conversation_id) {
    const code = result.error_code ?? 'TEAM_CHAT_MANAGEMENT_FAILED'
    throw new TeamChatRepositoryError(code, result.status === 'forbidden' ? 403 : result.status === 'not_found' ? 404 : 400)
  }
  return { conversation_id: Number(result.conversation_id) }
}

export async function setTeamChatManager(user: SessionUser, targetUserId: unknown, active: unknown): Promise<void> {
  if (user.role !== 'admin') throw new TeamChatRepositoryError('ADMIN_REQUIRED', 403)
  const userId = String(targetUserId ?? '').trim()
  if (!userId || userId === user.user_id) throw new TeamChatRepositoryError('INVALID_CHAT_MANAGER', 400)
  const client = getSupabase()
  const { data: account, error: accountError } = await client.from(T('users')).select('username').eq('username', userId).maybeSingle()
  if (accountError) throw new Error(accountError.message)
  if (!account) throw new TeamChatRepositoryError('ACCOUNT_NOT_FOUND', 404)
  const { error } = await client.from(T('team_chat_managers')).upsert({
    user_id: userId,
    granted_by_user_id: user.user_id,
    inactive_at: active === true ? null : new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }, { onConflict: 'user_id' })
  if (error) throw new Error(error.message)
}
