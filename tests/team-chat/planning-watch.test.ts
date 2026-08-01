import assert from 'node:assert/strict'
import test from 'node:test'

import {
  createPlanningWatchService,
  planningTriggerUuid,
  type PlanningWatchAdapter,
} from '../../lib/team-chat/planning-watch'
import { TeamChatRepositoryError, type TeamChatBootstrap } from '../../lib/team-chat/repository'
import { createPlanningWatchHandler } from '../../pages/api/team-chat/planning-watch'
import type { SessionUser } from '../../types'

const now = new Date('2026-08-01T10:00:00.000Z')
const employee: SessionUser = {
  user_id: 'employee-1', display_name: 'Nora', role: 'employee', employee_id: 1, location: 'markt',
}
const bootstrap: TeamChatBootstrap = {
  user: employee,
  conversations: [
    { id: 1, kind: 'channel', slug: 'nootschap', name: 'NOOTSCHAP!!', description: '', fixed: true, member_count: 4, unread_count: 0, last_message_at: null, archived_at: null },
    { id: 2, kind: 'channel', slug: 'nootzakelijk', name: 'Nootzakelijk', description: '', fixed: true, member_count: 4, unread_count: 0, last_message_at: null, archived_at: null },
  ],
  members: [],
  planning_watch: { open_shift_count: 1, pending_exchange_count: 1, conflict_exchange_count: 1, expiring_exchange_count: 1 },
  server_cursor: 0,
}

function adapter(overrides: Partial<PlanningWatchAdapter> = {}): PlanningWatchAdapter {
  return {
    listOpenShifts: async () => [{
      id: 101,
      employee_id: null,
      employee_name: 'Open dienst',
      week_number: 32,
      year: 2026,
      day_of_week: 'zondag',
      shift_type: 'Ochtend',
      start_time: '08:00:00',
      end_time: '13:00:00',
      full_day: 0,
      break_minutes: 15,
      location: 'markt',
      is_open: 1,
      opened_at: '2026-07-28T08:00:00.000Z',
      assignment_version: 2,
    }],
    listUserExchanges: async () => [{
      id: '10000000-0000-4000-8000-000000000001',
      conversation_id: 2,
      kind: 'takeover',
      status: 'pending',
      source_shift_id: 101,
      target_shift_id: null,
      initiator_user_id: 'employee-2',
      counterparty_user_id: employee.user_id,
      expires_at: '2026-08-01T18:00:00.000Z',
      conflict_code: null,
    }],
    publishTrigger: async () => ({ status: 'published', message_id: 9 }),
    ...overrides,
  }
}

function service(options: {
  user?: SessionUser
  bootstrap?: TeamChatBootstrap
  adapter?: PlanningWatchAdapter
  owner?: boolean
} = {}) {
  return createPlanningWatchService({
    adapter: options.adapter ?? adapter(),
    getChatBootstrap: async () => options.bootstrap ?? bootstrap,
    isTeamChatOwner: async () => options.owner ?? false,
    getWeeklyInsights: async () => [],
    now: () => now,
  })
}

test('Planningwacht combines old open shifts and actionable expiring exchanges', async () => {
  const items = await service().getPlanningWatch(employee)
  assert.equal(items[0].kind, 'exchange_response')
  assert.equal(items[0].severity, 'urgent')
  assert.equal(items[0].action?.label, 'Reageer nu')
  const open = items.find(item => item.kind === 'open_shift')
  assert.equal(open?.shift_id, 101)
  assert.equal(open?.severity, 'attention')
  assert.equal(open?.action?.href, '/me/open-shifts?shift=101')
})

test('Planningwacht filters shifts outside the employee location and never publishes while reading', async () => {
  let published = false
  const watchAdapter = adapter({
    listOpenShifts: async () => [{ ...(await adapter().listOpenShifts())[0], location: 'nootmagazijn' }],
    publishTrigger: async () => { published = true; return { status: 'published', message_id: 9 } },
  })
  const items = await service({ adapter: watchAdapter }).getPlanningWatch(employee)
  assert.equal(items.some(item => item.kind === 'open_shift'), false)
  assert.equal(published, false)
})

test('Planningwacht maps conflict requests to a safe recovery action', async () => {
  const watchAdapter = adapter({
    listOpenShifts: async () => [],
    listUserExchanges: async () => [{
      ...(await adapter().listUserExchanges([2], employee.user_id))[0],
      status: 'conflict',
      conflict_code: 'source_assignment_changed',
    }],
  })
  const items = await service({ adapter: watchAdapter }).getPlanningWatch(employee)
  assert.deepEqual(items.map(item => item.kind), ['exchange_conflict'])
  assert.equal(items[0].action?.label, 'Bekijk actuele dienst')
})

test('trigger sync is owner-only, deterministic and targets NOOTSCHAP', async () => {
  const calls: unknown[] = []
  const watchAdapter = adapter({
    publishTrigger: async input => { calls.push(input); return { status: 'published', message_id: 9 } },
  })
  const ownerService = service({ adapter: watchAdapter, owner: true })
  const result = await ownerService.syncPlanningTriggers(employee)
  assert.equal(result.published, 1)
  assert.equal(calls.length, 1)
  assert.equal((calls[0] as { conversationId: number }).conversationId, 1)
  assert.match((calls[0] as { eventKey: string }).eventKey, /^[0-9a-f-]{36}$/)
  assert.equal(planningTriggerUuid('open-shift:101:2'), planningTriggerUuid('open-shift:101:2'))

  await assert.rejects(service().syncPlanningTriggers(employee), (error: unknown) => {
    assert.ok(error instanceof TeamChatRepositoryError)
    assert.equal(error.status, 403)
    return true
  })
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

test('Planningwacht API supports read and authorized trigger sync only', async () => {
  const handler = createPlanningWatchHandler({
    getSession: async () => ({ user: employee }),
    getPlanningWatch: async () => [{ id: 'one' }] as never,
    syncPlanningTriggers: async () => ({ published: 1, duplicates: 0 }),
  })
  const getResponse = mockResponse()
  await handler({ method: 'GET' } as never, getResponse as never)
  assert.equal(getResponse.statusCode, 200)
  assert.equal(getResponse.headers['cache-control'], 'private, no-store')

  const postResponse = mockResponse()
  await handler({ method: 'POST' } as never, postResponse as never)
  assert.deepEqual(postResponse.body, { success: true, data: { published: 1, duplicates: 0 } })

  const deleteResponse = mockResponse()
  await handler({ method: 'DELETE' } as never, deleteResponse as never)
  assert.equal(deleteResponse.statusCode, 405)
  assert.equal(deleteResponse.headers.allow, 'GET, POST')
})
