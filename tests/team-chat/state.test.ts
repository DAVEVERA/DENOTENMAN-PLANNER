import assert from 'node:assert/strict'
import test from 'node:test'

import {
  createInitialChatState,
  teamChatReducer,
  shouldAutoScroll,
  type ClientTeamMessage,
} from '../../components/team-chat/state'
import type { TeamMessage } from '../../lib/team-chat/repository'

function message(id: number, nonce = `00000000-0000-4000-8000-${String(id).padStart(12, '0')}`): TeamMessage {
  return {
    id,
    conversation_id: 1,
    message_type: 'text',
    body: `Bericht ${id}`,
    gif: null,
    sender_user_id: 'employee-1',
    sender_employee_id: 1,
    sender_display_name: 'Nora',
    reply_to_message_id: null,
    client_nonce: nonce,
    edited_at: null,
    created_at: `2026-08-01T08:${String(id).padStart(2, '0')}:00.000Z`,
  }
}

test('optimistic acknowledgement replaces the temporary message without a duplicate', () => {
  const nonce = '10000000-0000-4000-8000-000000000001'
  const optimistic: ClientTeamMessage = { ...message(-1, nonce), delivery: 'sending' }
  let state = createInitialChatState(1)
  state = teamChatReducer(state, { type: 'optimistic', message: optimistic })
  assert.equal(state.messages[0].delivery, 'sending')

  state = teamChatReducer(state, { type: 'acknowledged', nonce, message: message(9, nonce) })
  assert.deepEqual(state.messages.map(item => item.id), [9])
  assert.equal(state.messages[0].delivery, 'sent')
})

test('cursor merge is ordered and deduplicates by both ID and nonce', () => {
  const sharedNonce = '20000000-0000-4000-8000-000000000002'
  let state = createInitialChatState(1)
  state = teamChatReducer(state, { type: 'replace', messages: [message(4), message(5, sharedNonce)] })
  state = teamChatReducer(state, { type: 'merge', messages: [message(3), message(5, sharedNonce), message(6)] })
  assert.deepEqual(state.messages.map(item => item.id), [3, 4, 5, 6])
})

test('failed optimistic messages can be marked for retry without losing their payload', () => {
  const nonce = '30000000-0000-4000-8000-000000000003'
  const optimistic: ClientTeamMessage = {
    ...message(-3, nonce),
    delivery: 'sending',
    retry_payload: { conversation_id: 1, client_nonce: nonce, body: 'Bericht 3' },
  }
  let state = teamChatReducer(createInitialChatState(1), { type: 'optimistic', message: optimistic })
  state = teamChatReducer(state, { type: 'failed', nonce })
  assert.equal(state.messages[0].delivery, 'failed')
  assert.equal(state.messages[0].retry_payload?.body, 'Bericht 3')
  state = teamChatReducer(state, { type: 'retrying', nonce })
  assert.equal(state.messages[0].delivery, 'sending')
})

test('new messages only auto-scroll when the reader is already near the bottom', () => {
  assert.equal(shouldAutoScroll({ distanceFromBottom: 40, isOwnMessage: false }), true)
  assert.equal(shouldAutoScroll({ distanceFromBottom: 260, isOwnMessage: false }), false)
  assert.equal(shouldAutoScroll({ distanceFromBottom: 260, isOwnMessage: true }), true)
})
