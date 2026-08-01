import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import test from 'node:test'

import { FIXED_TEAM_CHANNELS, TEAM_CHAT_ACTIVE_POLL_MS, TEAM_CHAT_IDLE_POLL_MS, TEAM_CHAT_MAX_MESSAGE_LENGTH, TEAM_CHAT_PAGE_SIZE } from '../../lib/team-chat/constants'
import { createGifSearch, GifProviderError, isAllowedGifUrl } from '../../lib/team-chat/gifs'
import { canManageTeamChat } from '../../lib/team-chat/permissions'
import {
  createTeamChatRepository,
  escapePostgrestLikePattern,
  type TeamChatQueryAdapter,
  type TeamConversationMember,
  type TeamMessage,
} from '../../lib/team-chat/repository'
import { detectPlanningIntent, validateCreateMessage, validateExchangeInput, validateReactionEmoji } from '../../lib/team-chat/validation'
import { createBootstrapHandler } from '../../pages/api/team-chat/bootstrap'
import type { SessionUser } from '../../types'

const employeeSession: SessionUser = {
  user_id: 'employee-1',
  display_name: 'Medewerker',
  role: 'employee',
  employee_id: 1,
  location: 'markt',
}

test('accepts the four exact fixed channel names', () => {
  assert.deepEqual(FIXED_TEAM_CHANNELS.map(item => item.name), [
    'Nootities', 'Nootzakelijk', 'The Nootorious', 'NOOTSCHAP!!',
  ])
})

test('uses the agreed paging and polling constants', () => {
  assert.equal(TEAM_CHAT_MAX_MESSAGE_LENGTH, 2_000)
  assert.equal(TEAM_CHAT_PAGE_SIZE, 50)
  assert.equal(TEAM_CHAT_ACTIVE_POLL_MS, 2_000)
  assert.equal(TEAM_CHAT_IDLE_POLL_MS, 15_000)
})

test('rejects a message without text gif or shift', () => {
  assert.throws(() => validateCreateMessage({ conversation_id: 1, client_nonce: randomUUID() }))
})

test('validates a text message with optional reply', () => {
  const input = validateCreateMessage({
    conversation_id: 1,
    client_nonce: randomUUID(),
    body: '  Hallo team  ',
    reply_to_id: 2,
  })

  assert.deepEqual(input, {
    conversation_id: 1,
    client_nonce: input.client_nonce,
    body: 'Hallo team',
    reply_to_id: 2,
  })
})

test('only accepts GIFs from approved HTTPS GIPHY media hosts', () => {
  const acceptedHosts = ['media.giphy.com', 'media0.giphy.com']
  for (const host of acceptedHosts) {
    const input = validateCreateMessage({
      conversation_id: 1,
      client_nonce: randomUUID(),
      gif: { provider: 'giphy', id: 'gif-1', url: `https://${host}/media/gif-1/giphy.gif`, width: 100, height: 100 },
    })
    assert.equal(input.gif?.url, `https://${host}/media/gif-1/giphy.gif`)
  }

  assert.throws(() => validateCreateMessage({
    conversation_id: 1,
    client_nonce: randomUUID(),
    gif: { provider: 'giphy', id: 'gif-1', url: 'http://media.giphy.com/media/gif-1/giphy.gif', width: 100, height: 100 },
  }))
  assert.throws(() => validateCreateMessage({
    conversation_id: 1,
    client_nonce: randomUUID(),
    gif: { provider: 'giphy', id: 'gif-1', url: 'https://example.com/media/gif-1/giphy.gif', width: 100, height: 100 },
  }))
  assert.throws(() => validateCreateMessage({
    conversation_id: 1,
    client_nonce: randomUUID(),
    gif: { provider: 'giphy', id: 'gif-1', url: 'https://media.giphy.com.evil.example/media/gif-1/giphy.gif', width: 100, height: 100 },
  }))
})

test('rejects invalid message IDs, nonces and mixed content', () => {
  assert.throws(() => validateCreateMessage({ conversation_id: 0, client_nonce: randomUUID(), body: 'Hallo' }))
  assert.throws(() => validateCreateMessage({ conversation_id: 1, client_nonce: 'not-a-uuid', body: 'Hallo' }))
  assert.throws(() => validateCreateMessage({ conversation_id: 1, client_nonce: randomUUID(), body: 'Hallo', shift_id: 2 }))
})

test('limits message content to 2,000 characters', () => {
  assert.throws(() => validateCreateMessage({
    conversation_id: 1,
    client_nonce: randomUUID(),
    body: 'a'.repeat(2_001),
  }))
})

test('validates exchange input by kind and distinct positive shift IDs', () => {
  assert.deepEqual(validateExchangeInput({ kind: 'takeover', source_shift_id: 1 }), {
    kind: 'takeover',
    source_shift_id: 1,
  })
  assert.deepEqual(validateExchangeInput({ kind: 'swap', source_shift_id: 1, target_shift_id: 2 }), {
    kind: 'swap',
    source_shift_id: 1,
    target_shift_id: 2,
  })
  assert.throws(() => validateExchangeInput({ kind: 'swap', source_shift_id: 1 }))
  assert.throws(() => validateExchangeInput({ kind: 'swap', source_shift_id: 1, target_shift_id: 1 }))
})

test('only accepts complete emoji grapheme sequences up to 16 Unicode code points', () => {
  assert.equal(validateReactionEmoji('\u{1F44B}\u{1F3FD}'), '\u{1F44B}\u{1F3FD}')
  assert.equal(validateReactionEmoji('\u{1F469}\u200D\u{1F4BB}'), '\u{1F469}\u200D\u{1F4BB}')
  assert.equal(validateReactionEmoji('\u{1F1F3}\u{1F1F1}'), '\u{1F1F3}\u{1F1F1}')
  assert.equal(validateReactionEmoji('#\uFE0F\u20E3'), '#\uFE0F\u20E3')
  assert.throws(() => validateReactionEmoji('\u{1F600}'.repeat(17)))
  assert.throws(() => validateReactionEmoji('not an emoji'))
  assert.throws(() => validateReactionEmoji('tekst\u{1F600}'))
  assert.throws(() => validateReactionEmoji('\u{1F600} tekst'))
})

test('recognizes deterministic Dutch planning intents without mutating anything', () => {
  assert.deepEqual(detectPlanningIntent('Wie kan #dienst-123 overnemen?'), [
    { kind: 'takeover_shift', shiftId: 123, confidence: 1 },
  ])
  assert.deepEqual(detectPlanningIntent('Ik wil dienst 123 ruilen'), [
    { kind: 'swap_shift', shiftId: null, confidence: 1 },
  ])
  assert.deepEqual(detectPlanningIntent('kan iemand helpen'), [
    { kind: 'request_help', shiftId: null, confidence: 1 },
  ])
  assert.deepEqual(detectPlanningIntent('Goedemorgen allemaal'), [])
})

test('employees cannot manage conversations', () => {
  assert.equal(canManageTeamChat(employeeSession, false), false)
})

test('explicit owners can manage conversations', () => {
  assert.equal(canManageTeamChat(employeeSession, true), true)
})

test('admins can manage conversations without an explicit owner grant', () => {
  assert.equal(canManageTeamChat({ ...employeeSession, role: 'admin' }, false), true)
})

const activeMembership: TeamConversationMember = {
  id: 10,
  conversation_id: 1,
  user_id: employeeSession.user_id,
  employee_id: employeeSession.employee_id,
  member_role: 'member',
  notification_preference: 'all',
  inactive_at: null,
}

const storedMessage: TeamMessage = {
  id: 21,
  conversation_id: 1,
  message_type: 'text',
  body: 'Hallo team',
  gif: null,
  sender_user_id: employeeSession.user_id,
  sender_employee_id: employeeSession.employee_id,
  sender_display_name: employeeSession.display_name,
  reply_to_message_id: null,
  client_nonce: '00000000-0000-4000-8000-000000000001',
  edited_at: null,
  created_at: '2026-07-31T10:00:00.000Z',
}

function queryAdapter(overrides: Partial<TeamChatQueryAdapter> = {}): TeamChatQueryAdapter {
  return {
    findActiveAccount: async () => ({
      user_id: employeeSession.user_id,
      employee_id: employeeSession.employee_id,
      role: employeeSession.role,
      employee_is_active: 1,
    }),
    findTeamChatOwner: async () => null,
    findConversationMember: async () => activeMembership,
    findConversationStatus: async () => 'active',
    restoreFixedChannelMemberships: async () => ({ status: 'ok', error_code: null, membership_count: 4 }),
    listConversationMemberships: async () => [activeMembership],
    listConversationsByIds: async () => [],
    listConversationMembers: async () => [],
    getConversationStats: async () => ({ status: 'ok', error_code: null, stats: [] }),
    listPlanningRequests: async () => [],
    countOpenShifts: async () => 0,
    listMessages: async () => [],
    findMessageById: async () => null,
    createMessageAtomic: async input => ({
      status: 'created',
      error_code: null,
      message: {
        ...storedMessage,
        conversation_id: input.conversationId,
        sender_user_id: input.userId,
        sender_employee_id: input.employeeId,
        client_nonce: input.clientNonce,
      },
      shift: null,
    }),
    editMessageAtomic: async input => ({
      status: 'updated',
      error_code: null,
      message: { ...storedMessage, id: input.messageId, body: input.body, edited_at: '2026-08-01T08:00:00.000Z' },
    }),
    toggleReactionAtomic: async input => ({
      status: 'activated',
      error_code: null,
      reaction: { message_id: input.messageId, emoji: input.emoji, active: true, count: 1 },
    }),
    markConversationReadAtomic: async input => ({
      status: 'ok',
      error_code: null,
      read: { conversation_id: input.conversationId, last_read_message_id: input.messageId, advanced: true },
    }),
    searchMessages: async () => [],
    ...overrides,
  }
}

test('fresh account status gates every public repository entrypoint before protected adapter work', async () => {
  const protectedCalls: string[] = []
  const repository = createTeamChatRepository(queryAdapter({
    findActiveAccount: async () => null,
    findTeamChatOwner: async () => {
      protectedCalls.push('owner')
      return null
    },
    findConversationMember: async () => {
      protectedCalls.push('membership')
      return activeMembership
    },
    restoreFixedChannelMemberships: async () => {
      protectedCalls.push('fixed-memberships')
      return { status: 'ok', error_code: null, membership_count: 4 }
    },
    listConversationMemberships: async () => {
      protectedCalls.push('bootstrap')
      return []
    },
    listMessages: async () => {
      protectedCalls.push('messages')
      return []
    },
    createMessageAtomic: async () => {
      protectedCalls.push('insert')
      return { status: 'created', error_code: null, message: storedMessage, shift: null }
    },
  }))

  const operations = [
    () => repository.isTeamChatOwner(employeeSession.user_id),
    () => repository.requireConversationMember(1, employeeSession.user_id),
    () => repository.ensureFixedChannelMemberships(employeeSession),
    () => repository.getChatBootstrap(employeeSession),
    () => repository.listMessages({ conversationId: 1, userId: employeeSession.user_id }),
    () => repository.createMessage(employeeSession, {
      conversation_id: 1,
      client_nonce: randomUUID(),
      body: 'Hallo',
    }),
  ]

  for (const operation of operations) {
    await assert.rejects(operation, (error: unknown) => (
      error instanceof Error && error.message === 'ACTIVE_TEAM_CHAT_ACCOUNT_REQUIRED'
    ))
  }
  assert.deepEqual(protectedCalls, [])
})

test('fresh account guard rejects stale employee sessions and inactive linked employees but allows admin without employee', async () => {
  const staleSessionRepository = createTeamChatRepository(queryAdapter({
    findActiveAccount: async () => ({
      user_id: employeeSession.user_id,
      employee_id: 2,
      role: 'employee',
      employee_is_active: 1,
    }),
  }))
  await assert.rejects(
    staleSessionRepository.ensureFixedChannelMemberships(employeeSession),
    (error: unknown) => error instanceof Error && error.message === 'ACTIVE_TEAM_CHAT_ACCOUNT_REQUIRED',
  )

  const inactiveRepository = createTeamChatRepository(queryAdapter({
    findActiveAccount: async () => ({
      user_id: employeeSession.user_id,
      employee_id: employeeSession.employee_id,
      role: 'employee',
      employee_is_active: 0,
    }),
  }))
  await assert.rejects(
    inactiveRepository.listMessages({ conversationId: 1, userId: employeeSession.user_id }),
    (error: unknown) => error instanceof Error && error.message === 'ACTIVE_TEAM_CHAT_ACCOUNT_REQUIRED',
  )

  const staleRoleRepository = createTeamChatRepository(queryAdapter({
    findActiveAccount: async () => ({
      user_id: employeeSession.user_id,
      employee_id: employeeSession.employee_id,
      role: 'admin',
      employee_is_active: 1,
    }),
  }))
  await assert.rejects(
    staleRoleRepository.getChatBootstrap(employeeSession),
    (error: unknown) => error instanceof Error && error.message === 'ACTIVE_TEAM_CHAT_ACCOUNT_REQUIRED',
  )

  const linkedInactiveAdmin = { ...employeeSession, role: 'admin' as const }
  const linkedInactiveAdminRepository = createTeamChatRepository(queryAdapter({
    findActiveAccount: async () => ({
      user_id: linkedInactiveAdmin.user_id,
      employee_id: linkedInactiveAdmin.employee_id,
      role: 'admin',
      employee_is_active: 0,
    }),
  }))
  await assert.rejects(
    linkedInactiveAdminRepository.ensureFixedChannelMemberships(linkedInactiveAdmin),
    (error: unknown) => error instanceof Error && error.message === 'ACTIVE_TEAM_CHAT_ACCOUNT_REQUIRED',
  )

  let fixedMembershipCall = 0
  const admin = { ...employeeSession, user_id: 'admin', role: 'admin' as const, employee_id: null }
  const adminRepository = createTeamChatRepository(queryAdapter({
    findActiveAccount: async () => ({
      user_id: admin.user_id,
      employee_id: null,
      role: 'admin',
      employee_is_active: null,
    }),
    restoreFixedChannelMemberships: async () => {
      fixedMembershipCall += 1
      return { status: 'ok', error_code: null, membership_count: 4 }
    },
  }))
  await adminRepository.ensureFixedChannelMemberships(admin)
  assert.equal(fixedMembershipCall, 1)
})

test('composed repository operations perform one fresh account check', async () => {
  let accountChecks = 0
  const repository = createTeamChatRepository(queryAdapter({
    findActiveAccount: async () => {
      accountChecks += 1
      return {
        user_id: employeeSession.user_id,
        employee_id: employeeSession.employee_id,
        role: employeeSession.role,
        employee_is_active: 1,
      }
    },
  }))

  await repository.getChatBootstrap(employeeSession)
  assert.equal(accountChecks, 1)
  await repository.listMessages({ conversationId: 1, userId: employeeSession.user_id })
  assert.equal(accountChecks, 2)
  await repository.createMessage(employeeSession, {
    conversation_id: 1,
    client_nonce: randomUUID(),
    body: 'Een bericht',
  })
  assert.equal(accountChecks, 3)
})

test('checks active membership before reading messages', async () => {
  const calls: string[] = []
  const repository = createTeamChatRepository(queryAdapter({
    findConversationMember: async () => {
      calls.push('membership')
      return activeMembership
    },
    listMessages: async () => {
      calls.push('messages')
      return [storedMessage]
    },
  }))

  assert.deepEqual(await repository.listMessages({ conversationId: 1, userId: employeeSession.user_id }), [storedMessage])
  assert.deepEqual(calls, ['membership', 'messages'])

  let messageRead = false
  const deniedRepository = createTeamChatRepository(queryAdapter({
    findConversationMember: async () => null,
    listMessages: async () => {
      messageRead = true
      return []
    },
  }))
  await assert.rejects(
    deniedRepository.listMessages({ conversationId: 1, userId: employeeSession.user_id }),
    (error: unknown) => error instanceof Error && error.message === 'CONVERSATION_MEMBERSHIP_REQUIRED',
  )
  assert.equal(messageRead, false)
})

test('rejects reads and writes for archived conversations before message access', async () => {
  const calls: string[] = []
  const repository = createTeamChatRepository(queryAdapter({
    findActiveAccount: async () => {
      calls.push('account')
      return {
        user_id: employeeSession.user_id,
        employee_id: employeeSession.employee_id,
        role: employeeSession.role,
        employee_is_active: 1,
      }
    },
    findConversationMember: async () => {
      calls.push('membership')
      return activeMembership
    },
    findConversationStatus: async () => {
      calls.push('conversation')
      return 'archived'
    },
    listMessages: async () => {
      calls.push('messages')
      return []
    },
    createMessageAtomic: async () => {
      calls.push('create')
      return { status: 'created', error_code: null, message: storedMessage, shift: null }
    },
  }))

  await assert.rejects(
    repository.listMessages({ conversationId: 1, userId: employeeSession.user_id }),
    (error: unknown) => error instanceof Error && error.message === 'ACTIVE_CONVERSATION_REQUIRED',
  )
  assert.deepEqual(calls, ['account', 'membership', 'conversation'])

  calls.length = 0
  await assert.rejects(
    repository.createMessage(employeeSession, {
      conversation_id: 1,
      client_nonce: randomUUID(),
      body: 'Niet schrijven',
    }),
    (error: unknown) => error instanceof Error && error.message === 'ACTIVE_CONVERSATION_REQUIRED',
  )
  assert.deepEqual(calls, ['account', 'membership', 'conversation'])
})

test('uses the exact fixed-membership RPC adapter contract', async () => {
  let captured: Parameters<TeamChatQueryAdapter['restoreFixedChannelMemberships']> | undefined
  const repository = createTeamChatRepository(queryAdapter({
    restoreFixedChannelMemberships: async (...args) => {
      captured = args
      return { status: 'ok', error_code: null, membership_count: 4 }
    },
  }))

  await repository.ensureFixedChannelMemberships(employeeSession)

  assert.deepEqual(captured, [{
    userId: employeeSession.user_id,
    employeeId: employeeSession.employee_id,
  }])
})

test('delegates fixed membership restoration to one RPC contract without overwriting preferences', async () => {
  const membership = {
    ...activeMembership,
    member_role: 'owner' as const,
    notification_preference: 'muted' as const,
    inactive_at: '2026-07-30T10:00:00.000Z',
  }
  let captured: Parameters<TeamChatQueryAdapter['restoreFixedChannelMemberships']> | undefined
  const repository = createTeamChatRepository(queryAdapter({
    restoreFixedChannelMemberships: async (...args) => {
      captured = args
      membership.inactive_at = null as never
      return { status: 'ok', error_code: null, membership_count: 4 }
    },
  }))

  await repository.ensureFixedChannelMemberships(employeeSession)

  assert.deepEqual(captured, [{
    userId: employeeSession.user_id,
    employeeId: employeeSession.employee_id,
  }])
  assert.equal(membership.inactive_at, null)
  assert.equal(membership.member_role, 'owner')
  assert.equal(membership.notification_preference, 'muted')
})

test('returns the hydrated duplicate from the single atomic message RPC call', async () => {
  const duplicateShift = {
    shift_id: 42,
    employee_id: 1,
    employee_name: 'Medewerker',
    week_number: 31,
    year: 2026,
    day_of_week: 'Vrijdag',
    shift_type: 'Ochtend',
    start_time: '09:00:00',
    end_time: '17:00:00',
    full_day: 0,
    break_minutes: 30,
    location: 'markt',
    assignment_version: 2,
  }
  const duplicateMessage = { ...storedMessage, message_type: 'shift' as const, body: null }
  let calls = 0
  const repository = createTeamChatRepository(queryAdapter({
    createMessageAtomic: async input => {
      calls += 1
      assert.deepEqual(input, {
        userId: employeeSession.user_id,
        employeeId: employeeSession.employee_id,
        conversationId: 1,
        clientNonce: storedMessage.client_nonce,
        body: null,
        gifProvider: null,
        gifProviderId: null,
        gifUrl: null,
        gifWidth: null,
        gifHeight: null,
        shiftId: 42,
        replyToMessageId: null,
      })
      return {
        status: 'duplicate',
        error_code: null,
        message: duplicateMessage,
        shift: duplicateShift,
      }
    },
  }))

  const message = await repository.createMessage(employeeSession, {
    conversation_id: 1,
    client_nonce: storedMessage.client_nonce,
    shift_id: 42,
  })

  assert.deepEqual(message, { ...duplicateMessage, shift: duplicateShift })
  assert.equal(calls, 1)
})

test('uses one atomic write adapter and never attempts a compensating or half write', async () => {
  let atomicCalls = 0
  const repository = createTeamChatRepository(queryAdapter({
    createMessageAtomic: async () => {
      atomicCalls += 1
      throw new Error('atomic RPC rolled back')
    },
  }))

  await assert.rejects(repository.createMessage(employeeSession, {
    conversation_id: 1,
    client_nonce: randomUUID(),
    body: 'Atomair bericht',
  }), /atomic RPC rolled back/)
  assert.equal(atomicCalls, 1)
})

test('maps atomic message RPC business codes to stable repository errors', async () => {
  const cases = [
    ['conversation_not_active', 'ACTIVE_CONVERSATION_REQUIRED', 403],
    ['conversation_membership_required', 'CONVERSATION_MEMBERSHIP_REQUIRED', 403],
    ['client_nonce_conversation_conflict', 'CLIENT_NONCE_CONVERSATION_CONFLICT', 409],
    ['shift_not_found', 'SHIFT_NOT_FOUND', 404],
    ['invalid_giphy', 'INVALID_GIPHY', 400],
    ['employee_inactive', 'ACTIVE_TEAM_CHAT_ACCOUNT_REQUIRED', 403],
  ] as const

  for (const [errorCode, expectedCode, expectedStatus] of cases) {
    const repository = createTeamChatRepository(queryAdapter({
      createMessageAtomic: async () => ({
        status: errorCode === 'shift_not_found' ? 'not_found' : errorCode.includes('conflict') ? 'conflict' : 'forbidden',
        error_code: errorCode,
        message: null,
        shift: null,
      }),
    }))
    await assert.rejects(
      repository.createMessage(employeeSession, {
        conversation_id: 1,
        client_nonce: randomUUID(),
        body: 'Bericht',
      }),
      (error: unknown) => (
        typeof error === 'object'
        && error !== null
        && 'message' in error
        && error.message === expectedCode
        && 'status' in error
        && error.status === expectedStatus
      ),
    )
  }
})

test('applies cursor filters and the default message page limit', async () => {
  const queries: Parameters<TeamChatQueryAdapter['listMessages']>[0][] = []
  const repository = createTeamChatRepository(queryAdapter({
    listMessages: async query => {
      queries.push(query)
      return []
    },
  }))

  await repository.listMessages({ conversationId: 1, userId: employeeSession.user_id })
  await repository.listMessages({ conversationId: 1, userId: employeeSession.user_id, afterId: 20 })
  await repository.listMessages({ conversationId: 1, userId: employeeSession.user_id, beforeId: 40 })

  assert.deepEqual(queries, [
    { conversationId: 1, limit: TEAM_CHAT_PAGE_SIZE, order: 'descending' },
    { conversationId: 1, afterId: 20, limit: TEAM_CHAT_PAGE_SIZE, order: 'ascending' },
    { conversationId: 1, beforeId: 40, limit: TEAM_CHAT_PAGE_SIZE, order: 'descending' },
  ])
})

test('bootstrap batches stats once for member conversations and forwards user ID for own-message exclusion', async () => {
  let statsCalls = 0
  const repository = createTeamChatRepository(queryAdapter({
    listConversationMemberships: async () => [
      activeMembership,
      { ...activeMembership, id: 11, conversation_id: 2 },
    ],
    listConversationsByIds: async ids => {
      assert.deepEqual(ids, [1, 2])
      return [
        {
          id: 1,
          kind: 'channel',
          slug: 'nootities',
          name: 'Nootities',
          description: 'Algemene teamnotities.',
          is_fixed: true,
          status: 'active',
          archived_at: null,
        },
        {
          id: 2,
          kind: 'group',
          slug: null,
          name: 'Vrijdagteam',
          description: 'Vrijdagteam.',
          is_fixed: false,
          status: 'active',
          archived_at: null,
        },
      ]
    },
    listConversationMembers: async ids => {
      assert.deepEqual(ids, [1, 2])
      return [
        { ...activeMembership, display_name: 'Medewerker', account_role: 'employee' },
        { ...activeMembership, id: 11, conversation_id: 2, display_name: 'Medewerker', account_role: 'employee' },
      ]
    },
    getConversationStats: async input => {
      statsCalls += 1
      assert.deepEqual(input, {
        userId: employeeSession.user_id,
        conversationIds: [1, 2],
      })
      return {
        status: 'ok',
        error_code: null,
        stats: [
          { conversation_id: 1, latest_message_id: 22, latest_message_at: '2026-07-31T10:01:00.000Z', unread_count: 2 },
          { conversation_id: 2, latest_message_id: 50, latest_message_at: '2026-07-31T10:05:00.000Z', unread_count: 0 },
        ],
      }
    },
    countOpenShifts: async () => 3,
    listPlanningRequests: async ids => {
      assert.deepEqual(ids, [1, 2])
      return [
        { id: 'pending', conversation_id: 1, status: 'pending', initiator_user_id: 'employee-1', counterparty_user_id: 'employee-2', expires_at: '2099-01-01T00:00:00.000Z' },
        { id: 'conflict', conversation_id: 1, status: 'conflict', initiator_user_id: 'employee-2', counterparty_user_id: 'employee-1', expires_at: '2099-01-01T00:00:00.000Z' },
      ]
    },
  }))

  const bootstrap = await repository.getChatBootstrap(employeeSession)

  assert.equal(bootstrap.user.user_id, employeeSession.user_id)
  assert.deepEqual(bootstrap.conversations.map(item => item.id), [1, 2])
  assert.equal(bootstrap.conversations[0].unread_count, 2)
  assert.equal(bootstrap.conversations[1].unread_count, 0)
  assert.equal(bootstrap.conversations[0].member_count, 1)
  assert.equal(bootstrap.members[0].display_name, 'Medewerker')
  assert.deepEqual(bootstrap.planning_watch, {
    open_shift_count: 3,
    pending_exchange_count: 1,
    conflict_exchange_count: 1,
    expiring_exchange_count: 0,
  })
  assert.equal(bootstrap.server_cursor, 50)
  assert.equal(statsCalls, 1)
})

test('editing delegates one atomic revision-and-update operation', async () => {
  let captured: Parameters<TeamChatQueryAdapter['editMessageAtomic']>[0] | undefined
  const repository = createTeamChatRepository(queryAdapter({
    editMessageAtomic: async input => {
      captured = input
      return {
        status: 'updated',
        error_code: null,
        message: { ...storedMessage, id: input.messageId, body: input.body, edited_at: '2026-08-01T09:00:00.000Z' },
      }
    },
  }))

  const message = await repository.editMessage(employeeSession, 21, '  Aangepast bericht  ')
  assert.deepEqual(captured, { userId: 'employee-1', employeeId: 1, messageId: 21, body: 'Aangepast bericht' })
  assert.equal(message.body, 'Aangepast bericht')
  assert.ok(message.edited_at)
})

test('reaction toggle validates a complete emoji and never exposes a delete path', async () => {
  const calls: Parameters<TeamChatQueryAdapter['toggleReactionAtomic']>[0][] = []
  const repository = createTeamChatRepository(queryAdapter({
    toggleReactionAtomic: async input => {
      calls.push(input)
      return {
        status: calls.length === 1 ? 'activated' : 'deactivated',
        error_code: null,
        reaction: { message_id: input.messageId, emoji: input.emoji, active: calls.length === 1, count: calls.length === 1 ? 1 : 0 },
      }
    },
  }))

  assert.equal((await repository.toggleReaction(employeeSession, 21, '👍')).active, true)
  assert.equal((await repository.toggleReaction(employeeSession, 21, '👍')).active, false)
  await assert.rejects(repository.toggleReaction(employeeSession, 21, 'tekst 👍'), /INVALID_REACTION_EMOJI/)
  assert.equal(calls.length, 2)
})

test('read state uses one forward-only RPC after active membership validation', async () => {
  const calls: string[] = []
  const repository = createTeamChatRepository(queryAdapter({
    findConversationMember: async () => {
      calls.push('membership')
      return activeMembership
    },
    findConversationStatus: async () => {
      calls.push('conversation')
      return 'active'
    },
    markConversationReadAtomic: async input => {
      calls.push('read-rpc')
      return { status: 'ok', error_code: null, read: { conversation_id: input.conversationId, last_read_message_id: input.messageId, advanced: true } }
    },
  }))

  assert.deepEqual(await repository.markConversationRead(employeeSession, 1, 21), {
    conversation_id: 1,
    last_read_message_id: 21,
    advanced: true,
  })
  assert.deepEqual(calls, ['membership', 'conversation', 'read-rpc'])
})

test('search is membership-scoped, bounded and escapes PostgREST wildcard input', async () => {
  let captured: Parameters<TeamChatQueryAdapter['searchMessages']>[0] | undefined
  const repository = createTeamChatRepository(queryAdapter({
    listConversationMemberships: async () => [activeMembership, { ...activeMembership, id: 11, conversation_id: 2 }],
    listConversationsByIds: async () => [{
      id: 1,
      kind: 'channel',
      slug: 'nootities',
      name: 'Nootities',
      description: '',
      is_fixed: true,
      status: 'active',
      archived_at: null,
    }],
    searchMessages: async input => {
      captured = input
      return [storedMessage]
    },
  }))

  assert.deepEqual(await repository.searchTeamMessages(employeeSession, '  100%_noten\\  '), [storedMessage])
  assert.deepEqual(captured, { conversationIds: [1], escapedQuery: '100\\%\\_noten\\\\', limit: 50 })
  assert.equal(escapePostgrestLikePattern('a%b_c\\d'), 'a\\%b\\_c\\\\d')
  await assert.rejects(repository.searchTeamMessages(employeeSession, 'x'), /INVALID_SEARCH_QUERY/)
})

function mockResponse() {
  const response = {
    statusCode: 200,
    headers: {} as Record<string, string>,
    body: undefined as unknown,
    setHeader(name: string, value: string) {
      response.headers[name.toLowerCase()] = value
    },
    status(code: number) {
      response.statusCode = code
      return response
    },
    json(body: unknown) {
      response.body = body
      return response
    },
  }
  return response
}

test('bootstrap route rejects anonymous sessions', async () => {
  const handler = createBootstrapHandler({
    getSession: async () => ({}),
    getChatBootstrap: async () => assert.fail('bootstrap must not run without a user'),
  })
  const response = mockResponse()

  await handler({ method: 'GET' } as never, response as never)

  assert.equal(response.statusCode, 401)
  assert.deepEqual(response.body, { success: false, code: 'UNAUTHENTICATED' })
  assert.equal(response.headers['cache-control'], 'private, no-store')
})

test('bootstrap route authenticates, disables caching and returns repository data', async () => {
  const data = { marker: 'bootstrap' }
  const handler = createBootstrapHandler({
    getSession: async () => ({ user: employeeSession }),
    getChatBootstrap: async user => {
      assert.equal(user.user_id, employeeSession.user_id)
      return data as never
    },
  })
  const response = mockResponse()

  await handler({ method: 'GET' } as never, response as never)

  assert.equal(response.statusCode, 200)
  assert.deepEqual(response.body, { success: true, data })
  assert.equal(response.headers['cache-control'], 'private, no-store')
})

test('GIF provider accepts only the approved HTTPS media hosts', () => {
  assert.equal(isAllowedGifUrl('https://media.giphy.com/media/abc/giphy.gif'), true)
  assert.equal(isAllowedGifUrl('https://media0.giphy.com/media/abc/giphy.gif'), true)
  assert.equal(isAllowedGifUrl('http://media.giphy.com/media/abc/giphy.gif'), false)
  assert.equal(isAllowedGifUrl('https://media1.giphy.com/media/abc/giphy.gif'), false)
  assert.equal(isAllowedGifUrl('https://media.giphy.com.evil.example/giphy.gif'), false)
})

test('GIF search uses the safe Dutch PG contract and returns a sanitized result', async () => {
  let requestedUrl = ''
  const search = createGifSearch({
    apiKey: 'test-secret',
    fetch: async input => {
      requestedUrl = String(input)
      return new Response(JSON.stringify({
        data: [
          { id: 'gif-1', images: { fixed_height: { url: 'https://media0.giphy.com/media/gif-1/giphy.gif', width: '320', height: '180' } } },
          { id: 'blocked', images: { fixed_height: { url: 'https://media2.giphy.com/media/blocked/giphy.gif', width: '320', height: '180' } } },
        ],
      }), { status: 200, headers: { 'content-type': 'application/json' } })
    },
  })

  const result = await search('  blije noot  ')

  const url = new URL(requestedUrl)
  assert.equal(url.origin + url.pathname, 'https://api.giphy.com/v1/gifs/search')
  assert.equal(url.searchParams.get('q'), 'blije noot')
  assert.equal(url.searchParams.get('limit'), '24')
  assert.equal(url.searchParams.get('rating'), 'pg')
  assert.equal(url.searchParams.get('lang'), 'nl')
  assert.equal(url.searchParams.get('api_key'), 'test-secret')
  assert.deepEqual(result, [{ provider: 'giphy', id: 'gif-1', url: 'https://media0.giphy.com/media/gif-1/giphy.gif', width: 320, height: 180 }])
})

test('GIF search fails closed when the provider key is unavailable', async () => {
  const search = createGifSearch({ apiKey: undefined, fetch: async () => assert.fail('provider must not be called') })
  await assert.rejects(search('noten'), (error: unknown) => (
    error instanceof GifProviderError
    && error.code === 'GIF_PROVIDER_UNCONFIGURED'
    && error.status === 503
  ))
})
