import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { getPublicPushConfiguration } from '../../lib/push-config'

test('missing VAPID configuration disables push without exposing a partial key', () => {
  assert.deepEqual(getPublicPushConfiguration(undefined, undefined), {
    configured: false,
    publicKey: null,
  })
  assert.deepEqual(getPublicPushConfiguration('public-key', undefined), {
    configured: false,
    publicKey: null,
  })
})

test('complete VAPID configuration exposes only the normalized public key', () => {
  assert.deepEqual(getPublicPushConfiguration('  public-key  ', 'private-key'), {
    configured: true,
    publicKey: 'public-key',
  })
})

test('optional push configuration never produces a service-unavailable response or retry loop', () => {
  const route = readFileSync('pages/api/notifications/subscribe.ts', 'utf8')
  const client = readFileSync('components/ui/AutomaticPushNotifications.tsx', 'utf8')

  assert.doesNotMatch(route, /status\(503\)/)
  assert.match(route, /configured: false/)
  assert.match(client, /keyData\.configured === false/)
  assert.match(client, /pushUnavailable\.current = true/)
})
