import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

import { validateManagedConversationInput } from '../../lib/team-chat/admin'

test('admin conversation validation keeps direct and group membership explicit', () => {
  assert.deepEqual(validateManagedConversationInput({
    kind: 'direct',
    name: 'Dave en Fedor',
    member_user_ids: ['dave', 'fedor', 'dave'],
    owner_user_ids: ['fedor'],
    archived: false,
  }), {
    kind: 'direct',
    name: 'Dave en Fedor',
    member_user_ids: ['dave', 'fedor'],
    owner_user_ids: ['fedor'],
    archived: false,
  })

  assert.throws(() => validateManagedConversationInput({
    kind: 'direct', name: 'Te veel', member_user_ids: ['a', 'b', 'c'], owner_user_ids: ['a'],
  }), /INVALID_CONVERSATION_INPUT/)
  assert.throws(() => validateManagedConversationInput({
    kind: 'group', name: 'Geen owner', member_user_ids: ['a', 'b'], owner_user_ids: [],
  }), /INVALID_CONVERSATION_INPUT/)
})

test('conversation management is one service-only soft-membership RPC', () => {
  const migration = readFileSync('supabase/migrations/20260731180503_operational_team_chat.sql', 'utf8')
  const rpc = migration.match(/create or replace function public\.planner20_manage_team_conversation[\s\S]*?grant execute on function public\.planner20_manage_team_conversation[\s\S]*?service_role;/)?.[0] ?? ''
  assert.match(rpc, /on conflict \(conversation_id, user_id\) do update/)
  assert.match(rpc, /inactive_at = coalesce\(inactive_at, now\(\)\)/)
  assert.match(rpc, /FIXED_CHANNEL_IMMUTABLE/)
  assert.doesNotMatch(rpc, /\bdelete\s+from\b/i)
  assert.match(rpc, /revoke execute[\s\S]*anon, authenticated/)
  assert.match(rpc, /grant execute[\s\S]*service_role/)
})
