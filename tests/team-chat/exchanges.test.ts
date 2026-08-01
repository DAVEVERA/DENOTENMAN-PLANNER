import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import test from 'node:test'

import {
  createExchangeService,
  type ExchangeAdapter,
  type ShiftExchangeRequest,
} from '../../lib/team-chat/exchanges'
import { TeamChatRepositoryError } from '../../lib/team-chat/repository'
import { createExchangeHandler } from '../../pages/api/team-chat/exchanges'
import { createExchangeResponseHandler } from '../../pages/api/team-chat/exchanges/[id]/respond'
import type { SessionUser } from '../../types'

const user: SessionUser = {
  user_id: 'employee-10',
  display_name: 'Nora',
  role: 'employee',
  employee_id: 10,
  location: 'markt',
}

const request: ShiftExchangeRequest = {
  id: '10000000-0000-4000-8000-000000000001',
  conversation_id: 2,
  client_nonce: '20000000-0000-4000-8000-000000000002',
  kind: 'takeover',
  status: 'pending',
  source_shift_id: 101,
  target_shift_id: null,
  initiator_user_id: user.user_id,
  initiator_employee_id: 10,
  counterparty_user_id: 'employee-20',
  counterparty_employee_id: 20,
  source_employee_id: 20,
  target_employee_id: null,
  source_assignment_version: 3,
  target_assignment_version: null,
  source_shift_snapshot: {
    week_number: 33,
    year: 2026,
    day_of_week: 'maandag',
    shift_type: 'Ochtend',
    start_time: '08:00:00',
    end_time: '13:00:00',
    full_day: 0,
    break_minutes: 15,
    location: 'markt',
  },
  target_shift_snapshot: null,
  conflict_code: null,
  expires_at: '2026-08-03T08:00:00.000Z',
  completed_at: null,
  created_at: '2026-08-01T08:00:00.000Z',
  updated_at: '2026-08-01T08:00:00.000Z',
}

function adapter(overrides: Partial<ExchangeAdapter> = {}): ExchangeAdapter {
  return {
    createExchangeAtomic: async () => ({ status: 'created', error_code: null, request }),
    findExchangeRequest: async () => request,
    respondExchangeAtomic: async () => ({
      status: 'completed',
      completed: true,
      source_shift_id: request.source_shift_id,
      target_shift_id: null,
      error_code: null,
    }),
    recordPushFailure: async () => undefined,
    ...overrides,
  }
}

function service(
  overrides: Partial<ExchangeAdapter> = {},
  membership: (conversationId: number, userId: string) => Promise<unknown> = async () => undefined,
) {
  return createExchangeService({
    adapter: adapter(overrides),
    requireConversationMember: membership,
    notifyEmployee: async () => undefined,
  })
}

test('creates a takeover atomically with a client nonce and active membership', async () => {
  let captured: unknown
  let membership: unknown
  const exchange = service({
    createExchangeAtomic: async input => {
      captured = input
      return { status: 'created', error_code: null, request }
    },
  }, async (conversationId, userId) => { membership = { conversationId, userId } })

  const result = await exchange.createShiftExchange(user, {
    conversation_id: 2,
    client_nonce: request.client_nonce,
    kind: 'takeover',
    source_shift_id: 101,
  })

  assert.equal(result.id, request.id)
  assert.deepEqual(membership, { conversationId: 2, userId: user.user_id })
  assert.deepEqual(captured, {
    conversationId: 2,
    clientNonce: request.client_nonce,
    kind: 'takeover',
    sourceShiftId: 101,
    targetShiftId: null,
    userId: user.user_id,
    employeeId: 10,
  })
})

test('rejects exchange creation without an employee, malformed envelope or invalid swap', async () => {
  const exchange = service({
    createExchangeAtomic: async () => assert.fail('invalid input must not reach the database'),
  })
  await assert.rejects(exchange.createShiftExchange({ ...user, employee_id: null }, {
    conversation_id: 2,
    client_nonce: randomUUID(),
    kind: 'takeover',
    source_shift_id: 101,
  }), /ACTIVE_EMPLOYEE_REQUIRED/)
  await assert.rejects(exchange.createShiftExchange(user, {
    conversation_id: 0,
    client_nonce: 'not-a-uuid',
    kind: 'swap',
    source_shift_id: 101,
  }), /INVALID_EXCHANGE_REQUEST/)
  await assert.rejects(exchange.createShiftExchange(user, {
    conversation_id: 2,
    client_nonce: randomUUID(),
    kind: 'swap',
    source_shift_id: 101,
    target_shift_id: 101,
  }), /INVALID_EXCHANGE_REQUEST/)
})

test('maps own-takeover, non-owned swap source and missing counterparty to stable errors', async () => {
  const cases = [
    ['takeover_source_owned_by_initiator', 'TAKEOVER_OWN_SHIFT_NOT_ALLOWED', 400],
    ['swap_source_not_owned_by_initiator', 'SWAP_SOURCE_NOT_OWNED', 403],
    ['counterparty_account_not_found', 'EXCHANGE_COUNTERPARTY_NOT_FOUND', 409],
  ] as const
  for (const [databaseCode, expectedCode, expectedStatus] of cases) {
    const exchange = service({
      createExchangeAtomic: async () => ({ status: 'conflict', error_code: databaseCode, request: null }),
    })
    await assert.rejects(exchange.createShiftExchange(user, {
      conversation_id: 2,
      client_nonce: randomUUID(),
      kind: 'takeover',
      source_shift_id: 101,
    }), (error: unknown) => {
      assert.ok(error instanceof TeamChatRepositoryError)
      assert.equal(error.code, expectedCode)
      assert.equal(error.status, expectedStatus)
      return true
    })
  }
})

test('duplicate creation returns the immutable existing request', async () => {
  const exchange = service({
    createExchangeAtomic: async () => ({ status: 'duplicate', error_code: null, request }),
  })
  const result = await exchange.createShiftExchange(user, {
    conversation_id: 2,
    client_nonce: request.client_nonce,
    kind: 'takeover',
    source_shift_id: 101,
  })
  assert.deepEqual(result, request)
})

test('response checks party and membership before invoking the roster RPC', async () => {
  let called = false
  const exchange = service({
    respondExchangeAtomic: async () => {
      called = true
      return { status: 'pending', completed: false, source_shift_id: 101, target_shift_id: null, error_code: null }
    },
  }, async (conversationId, userId) => {
    assert.equal(conversationId, request.conversation_id)
    assert.equal(userId, user.user_id)
  })
  const result = await exchange.respondToShiftExchange(user, request.id, 'accepted')
  assert.equal(called, true)
  assert.equal(result.status, 'pending')

  const outsider = service({ findExchangeRequest: async () => ({ ...request, initiator_user_id: 'other' }) })
  await assert.rejects(outsider.respondToShiftExchange(user, request.id, 'accepted'), /EXCHANGE_PARTY_REQUIRED/)
})

test('response maps expiry and roster conflicts to HTTP 409 domain errors', async () => {
  for (const databaseCode of ['request_expired', 'source_assignment_changed', 'source_overlap']) {
    const exchange = service({
      respondExchangeAtomic: async () => ({
        status: databaseCode === 'request_expired' ? 'expired' : 'conflict',
        completed: false,
        source_shift_id: 101,
        target_shift_id: null,
        error_code: databaseCode,
      }),
    })
    await assert.rejects(exchange.respondToShiftExchange(user, request.id, 'accepted'), (error: unknown) => {
      assert.ok(error instanceof TeamChatRepositoryError)
      assert.equal(error.status, 409)
      return true
    })
  }
})

function mockResponse() {
  const response = {
    statusCode: 200,
    headers: {} as Record<string, string>,
    body: undefined as unknown,
    setHeader(name: string, value: string) { response.headers[name.toLowerCase()] = value },
    status(code: number) { response.statusCode = code; return response },
    json(body: unknown) { response.body = body; return response },
  }
  return response
}

test('exchange API exposes POST only for create and response', async () => {
  const create = createExchangeHandler({
    getSession: async () => ({ user }),
    createShiftExchange: async () => request,
  })
  const createResponse = mockResponse()
  await create({ method: 'POST', body: { marker: true } } as never, createResponse as never)
  assert.equal(createResponse.statusCode, 201)
  assert.equal(createResponse.headers['cache-control'], 'private, no-store')

  const respond = createExchangeResponseHandler({
    getSession: async () => ({ user }),
    respondToShiftExchange: async (_user, id, decision) => ({
      request_id: id,
      status: decision === 'declined' ? 'declined' : 'completed',
      completed: decision === 'accepted',
      source_shift_id: 101,
      target_shift_id: null,
      error_code: null,
    }),
  })
  const respondResponse = mockResponse()
  await respond({ method: 'POST', query: { id: request.id }, body: { decision: 'accepted' } } as never, respondResponse as never)
  assert.equal(respondResponse.statusCode, 200)

  const deleteResponse = mockResponse()
  await respond({ method: 'DELETE', query: { id: request.id } } as never, deleteResponse as never)
  assert.equal(deleteResponse.statusCode, 405)
  assert.equal(deleteResponse.headers.allow, 'POST')
})
