import assert from 'node:assert/strict'
import test from 'node:test'

import { GifProviderError } from '../../lib/team-chat/gifs'
import { TeamChatRepositoryError, type TeamMessage, type TeamReactionState, type TeamReadState } from '../../lib/team-chat/repository'
import { createGifsHandler } from '../../pages/api/team-chat/gifs'
import { createMessageHandler } from '../../pages/api/team-chat/messages/[id]'
import { createMessagesHandler } from '../../pages/api/team-chat/messages'
import { createReactionHandler } from '../../pages/api/team-chat/reactions'
import { createReadHandler } from '../../pages/api/team-chat/read'
import { createSearchHandler } from '../../pages/api/team-chat/search'
import type { SessionUser } from '../../types'

const employeeSession: SessionUser = {
  user_id: 'employee-1',
  display_name: 'Medewerker',
  role: 'employee',
  employee_id: 1,
  location: 'markt',
}

const message: TeamMessage = {
  id: 7,
  conversation_id: 2,
  message_type: 'text',
  body: 'Wie kan deze dienst overnemen?',
  gif: null,
  sender_user_id: employeeSession.user_id,
  sender_employee_id: employeeSession.employee_id,
  sender_display_name: employeeSession.display_name,
  reply_to_message_id: null,
  client_nonce: 'a0000000-0000-4000-8000-000000000007',
  edited_at: null,
  created_at: '2026-08-01T08:00:00.000Z',
}

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

function authenticatedSession() {
  return Promise.resolve({ user: employeeSession })
}

test('messages GET parses one cursor and POST creates a message', async () => {
  let listInput: unknown
  let createInput: unknown
  const handler = createMessagesHandler({
    getSession: authenticatedSession,
    listMessages: async input => {
      listInput = input
      return [message]
    },
    createMessage: async (_user, input) => {
      createInput = input
      return message
    },
  })

  const getResponse = mockResponse()
  await handler({ method: 'GET', query: { conversation_id: '2', after_id: '6' } } as never, getResponse as never)
  assert.equal(getResponse.statusCode, 200)
  assert.deepEqual(getResponse.body, { success: true, data: [message] })
  assert.deepEqual(listInput, { conversationId: 2, userId: employeeSession.user_id, afterId: 6 })
  assert.equal(getResponse.headers['cache-control'], 'private, no-store')

  const postResponse = mockResponse()
  const body = { conversation_id: 2, client_nonce: message.client_nonce, body: message.body }
  await handler({ method: 'POST', body, query: {} } as never, postResponse as never)
  assert.equal(postResponse.statusCode, 201)
  assert.deepEqual(postResponse.body, { success: true, data: message })
  assert.deepEqual(createInput, body)
})

test('messages route rejects anonymous, ambiguous and unsupported requests', async () => {
  const anonymous = createMessagesHandler({
    getSession: async () => ({}),
    listMessages: async () => assert.fail('must not list'),
    createMessage: async () => assert.fail('must not create'),
  })
  const anonymousResponse = mockResponse()
  await anonymous({ method: 'GET', query: { conversation_id: '2' } } as never, anonymousResponse as never)
  assert.equal(anonymousResponse.statusCode, 401)

  const handler = createMessagesHandler({
    getSession: authenticatedSession,
    listMessages: async () => assert.fail('must reject invalid cursors'),
    createMessage: async () => assert.fail('must not create'),
  })
  const ambiguousResponse = mockResponse()
  await handler({ method: 'GET', query: { conversation_id: '2', after_id: '3', before_id: '4' } } as never, ambiguousResponse as never)
  assert.equal(ambiguousResponse.statusCode, 400)
  assert.deepEqual(ambiguousResponse.body, { success: false, code: 'INVALID_MESSAGE_QUERY' })

  const deleteResponse = mockResponse()
  await handler({ method: 'DELETE', query: {} } as never, deleteResponse as never)
  assert.equal(deleteResponse.statusCode, 405)
  assert.equal(deleteResponse.headers.allow, 'GET, POST')
})

test('message edit route accepts PATCH only and preserves repository errors', async () => {
  let captured: unknown
  const handler = createMessageHandler({
    getSession: authenticatedSession,
    editMessage: async (user, messageId, body) => {
      captured = { user, messageId, body }
      return { ...message, body, edited_at: '2026-08-01T08:05:00.000Z' }
    },
  })
  const response = mockResponse()
  await handler({ method: 'PATCH', query: { id: '7' }, body: { body: 'Aangepast' } } as never, response as never)
  assert.equal(response.statusCode, 200)
  assert.deepEqual(captured, { user: employeeSession, messageId: 7, body: 'Aangepast' })

  const forbidden = createMessageHandler({
    getSession: authenticatedSession,
    editMessage: async () => { throw new TeamChatRepositoryError('MESSAGE_NOT_EDITABLE', 403) },
  })
  const forbiddenResponse = mockResponse()
  await forbidden({ method: 'PATCH', query: { id: '7' }, body: { body: 'Nee' } } as never, forbiddenResponse as never)
  assert.equal(forbiddenResponse.statusCode, 403)
  assert.deepEqual(forbiddenResponse.body, { success: false, code: 'MESSAGE_NOT_EDITABLE' })

  const deleteResponse = mockResponse()
  await handler({ method: 'DELETE', query: { id: '7' } } as never, deleteResponse as never)
  assert.equal(deleteResponse.statusCode, 405)
  assert.equal(deleteResponse.headers.allow, 'PATCH')
})

test('reaction and read routes return their atomic state', async () => {
  const reaction: TeamReactionState = { message_id: 7, emoji: '👍', active: true, count: 3 }
  const reactionHandler = createReactionHandler({
    getSession: authenticatedSession,
    toggleReaction: async (_user, messageId, emoji) => {
      assert.equal(messageId, 7)
      assert.equal(emoji, '👍')
      return reaction
    },
  })
  const reactionResponse = mockResponse()
  await reactionHandler({ method: 'POST', body: { message_id: 7, emoji: '👍' } } as never, reactionResponse as never)
  assert.deepEqual(reactionResponse.body, { success: true, data: reaction })

  const read: TeamReadState = { conversation_id: 2, last_read_message_id: 7, advanced: true }
  const readHandler = createReadHandler({
    getSession: authenticatedSession,
    markConversationRead: async (_user, conversationId, messageId) => {
      assert.equal(conversationId, 2)
      assert.equal(messageId, 7)
      return read
    },
  })
  const readResponse = mockResponse()
  await readHandler({ method: 'POST', body: { conversation_id: 2, message_id: 7 } } as never, readResponse as never)
  assert.deepEqual(readResponse.body, { success: true, data: read })
})

test('search and GIF routes validate query values and keep provider failures stable', async () => {
  const searchHandler = createSearchHandler({
    getSession: authenticatedSession,
    searchTeamMessages: async (_user, query) => {
      assert.equal(query, 'dienst ruilen')
      return [message]
    },
  })
  const searchResponse = mockResponse()
  await searchHandler({ method: 'GET', query: { q: 'dienst ruilen' } } as never, searchResponse as never)
  assert.deepEqual(searchResponse.body, { success: true, data: [message] })

  const gifsHandler = createGifsHandler({
    getSession: authenticatedSession,
    searchGifs: async () => { throw new GifProviderError('GIF_PROVIDER_UNCONFIGURED', 503) },
  })
  const gifsResponse = mockResponse()
  await gifsHandler({ method: 'GET', query: { q: 'noten' } } as never, gifsResponse as never)
  assert.equal(gifsResponse.statusCode, 503)
  assert.deepEqual(gifsResponse.body, { success: false, code: 'GIF_PROVIDER_UNCONFIGURED' })
})
