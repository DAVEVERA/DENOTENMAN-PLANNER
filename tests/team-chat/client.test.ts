import assert from 'node:assert/strict'
import { test } from 'node:test'

import { createClientNonce } from '../../lib/team-chat/client'

test('client nonces remain valid UUIDs for idempotent chat writes', () => {
  assert.match(createClientNonce(), /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i)
})
