import assert from 'node:assert/strict'
import { test } from 'node:test'

import { isDirectInvocation, verifyHoursSchema } from '../../scripts/verify-hours-schema.mjs'
import { shouldVerifyProductionSchema } from '../../scripts/verify-production-schema.mjs'

test('hours schema gate accepts the complete production column contract', async () => {
  const requestedUrls: string[] = []
  const result = await verifyHoursSchema({
    supabaseUrl: 'https://project.supabase.co',
    serviceRoleKey: 'test-key',
    fetchImpl: async (url: string | URL | Request) => {
      requestedUrls.push(String(url))
      if (String(url).includes('/rpc/')) {
        return new Response(JSON.stringify({
          ready: true,
          required_columns: 6,
          required_constraints: 2,
          required_indexes: 2,
        }), { status: 200, headers: { 'content-type': 'application/json' } })
      }
      return new Response('[]', { status: 200, headers: { 'content-type': 'application/json' } })
    },
  })

  assert.equal(result.ok, true)
  assert.match(requestedUrls[0], /planned_clock_in/)
  assert.match(requestedUrls[0], /planned_clock_out/)
  assert.match(requestedUrls[0], /planned_break_minutes/)
  assert.match(requestedUrls[0], /confirmation_mode/)
  assert.match(requestedUrls[0], /submission_revision/)
  assert.match(requestedUrls[0], /submitted_at/)
  assert.match(requestedUrls[1], /planner20_verify_hours_submission_schema/)
})

test('hours schema gate blocks deployment when PostgREST reports a missing column', async () => {
  const result = await verifyHoursSchema({
    supabaseUrl: 'https://project.supabase.co',
    serviceRoleKey: 'test-key',
    fetchImpl: async () => new Response(JSON.stringify({
      code: 'PGRST204',
      message: "Could not find the 'confirmation_mode' column",
    }), { status: 400, headers: { 'content-type': 'application/json' } }),
  })

  assert.deepEqual(result, {
    ok: false,
    code: 'PGRST204',
    status: 400,
  })
})

test('hours schema gate executes as a CLI on GitHub Actions Linux paths', () => {
  assert.equal(isDirectInvocation(
    '/home/runner/work/planner/scripts/verify-hours-schema.mjs',
    'file:///home/runner/work/planner/scripts/verify-hours-schema.mjs',
  ), true)
  assert.equal(isDirectInvocation(
    '/home/runner/work/planner/tests/importer.mjs',
    'file:///home/runner/work/planner/scripts/verify-hours-schema.mjs',
  ), false)
})

test('hours schema gate rejects a successful non-JSON proxy response', async () => {
  const result = await verifyHoursSchema({
    supabaseUrl: 'https://project.supabase.co',
    serviceRoleKey: 'test-key',
    fetchImpl: async () => new Response('<html>proxy page</html>', {
      status: 200,
      headers: { 'content-type': 'text/html' },
    }),
  })

  assert.deepEqual(result, {
    ok: false,
    code: 'MALFORMED_RESPONSE',
    status: 200,
  })
})

test('hours schema gate follows the configured database prefix', async () => {
  const requestedUrls: string[] = []
  await verifyHoursSchema({
    supabaseUrl: 'https://project.supabase.co',
    serviceRoleKey: 'test-key',
    tablePrefix: 'custom_',
    fetchImpl: async (url: string | URL | Request) => {
      requestedUrls.push(String(url))
      if (String(url).includes('/rpc/')) {
        return new Response(JSON.stringify({
          ready: true,
          required_columns: 6,
          required_constraints: 2,
          required_indexes: 2,
        }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        })
      }
      return new Response('[]', { status: 200, headers: { 'content-type': 'application/json' } })
    },
  })

  assert.match(requestedUrls[0], /custom_time_logs/)
  assert.equal(requestedUrls[0].includes('planner20_time_logs'), false)
})

test('hours schema gate blocks deployment when constraints or indexes are missing', async () => {
  const result = await verifyHoursSchema({
    supabaseUrl: 'https://project.supabase.co',
    serviceRoleKey: 'test-key',
    fetchImpl: async (url: string | URL | Request) => {
      if (String(url).includes('/rpc/')) {
        return new Response(JSON.stringify({
          ready: false,
          required_columns: 6,
          required_constraints: 2,
          required_indexes: 1,
        }), { status: 200, headers: { 'content-type': 'application/json' } })
      }
      return new Response('[]', { status: 200, headers: { 'content-type': 'application/json' } })
    },
  })

  assert.deepEqual(result, {
    ok: false,
    code: 'INCOMPLETE_SCHEMA_CONTRACT',
    status: 200,
  })
})

test('schema preflight runs only inside the real Vercel production build', () => {
  assert.equal(shouldVerifyProductionSchema({ VERCEL: '1', VERCEL_ENV: 'production' }), true)
  assert.equal(shouldVerifyProductionSchema({ VERCEL: '1', VERCEL_ENV: 'preview' }), false)
  assert.equal(shouldVerifyProductionSchema({ CI: 'true', VERCEL_ENV: 'production' }), false)
  assert.equal(shouldVerifyProductionSchema({}), false)
})
