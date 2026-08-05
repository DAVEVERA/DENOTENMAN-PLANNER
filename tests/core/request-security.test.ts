import assert from 'node:assert/strict'
import { test } from 'node:test'
import { NextRequest } from 'next/server'
import { sealData } from 'iron-session'
import { middleware } from '../../middleware'
import { sessionOptions } from '../../lib/session'
import { securedFetch } from '../../lib/client-fetch'
import { shouldVerifyProductionSchema } from '../../scripts/verify-production-schema.mjs'
import {
  csrfTokensMatch,
  isBrowserRequest,
  isMutationMethod,
  isSameOrigin,
} from '../../lib/request-security'

test('recognizes every mutating HTTP method', () => {
  for (const method of ['POST', 'PUT', 'PATCH', 'DELETE']) assert.equal(isMutationMethod(method), true)
  for (const method of ['GET', 'HEAD', 'OPTIONS']) assert.equal(isMutationMethod(method), false)
})

test('compares origins and CSRF tokens without accepting malformed values', () => {
  assert.equal(isSameOrigin('https://planner.example', 'planner.example', 'https'), true)
  assert.equal(isSameOrigin('https://evil.example', 'planner.example', 'https'), false)
  assert.equal(isSameOrigin('not a url', 'planner.example', 'https'), false)
  assert.equal(csrfTokensMatch('same-token', 'same-token'), true)
  assert.equal(csrfTokensMatch('same-token', 'other-token'), false)
  assert.equal(csrfTokensMatch('', ''), false)
})

test('distinguishes browser requests from server-to-server requests', () => {
  assert.equal(isBrowserRequest('https://planner.example', null), true)
  assert.equal(isBrowserRequest(null, 'same-origin'), true)
  assert.equal(isBrowserRequest(null, null), false)
})

test('rejects cross-site browser mutations before API handlers run', async () => {
  const request = mutationRequest('/api/shifts', {
    origin: 'https://evil.example',
    cookie: 'noten_csrf=valid-token',
    'x-csrf-token': 'valid-token',
  })
  const response = await middleware(request)
  assert.equal(response.status, 403)
  assert.equal(response.headers.get('x-csrf-error'), '1')
})

test('requires matching CSRF tokens for authenticated browser mutation paths', async () => {
  const sessionCookie = await authenticatedSessionCookie('session-token')
  const missing = await middleware(mutationRequest('/api/hours', {
    origin: 'https://planner.example',
    cookie: sessionCookie,
  }))
  assert.equal(missing.status, 403)

  const forged = await middleware(mutationRequest('/api/hours', {
    origin: 'https://planner.example',
    cookie: `${sessionCookie}; noten_csrf=forged-token`,
    'x-csrf-token': 'forged-token',
  }))
  assert.equal(forged.status, 403)

  const valid = await middleware(mutationRequest('/api/hours', {
    origin: 'https://planner.example',
    cookie: `${sessionCookie}; noten_csrf=session-token`,
    'x-csrf-token': 'session-token',
  }))
  assert.equal(valid.status, 200)

  const rotatedSessionCookie = await authenticatedSessionCookie('rotated-token')
  const staleAfterRotation = await middleware(mutationRequest('/api/hours', {
    origin: 'https://planner.example',
    cookie: `${rotatedSessionCookie}; noten_csrf=session-token`,
    'x-csrf-token': 'session-token',
  }))
  assert.equal(staleAfterRotation.status, 403)

  const validAfterRotation = await middleware(mutationRequest('/api/hours', {
    origin: 'https://planner.example',
    cookie: `${rotatedSessionCookie}; noten_csrf=rotated-token`,
    'x-csrf-token': 'rotated-token',
  }))
  assert.equal(validAfterRotation.status, 200)
})

test('lets malformed session cookies reach route authorization without throwing at the edge', async () => {
  const response = await middleware(mutationRequest('/api/hours', {
    origin: 'https://planner.example',
    cookie: 'noten_session=malformed; noten_csrf=forged-token',
    'x-csrf-token': 'forged-token',
  }))
  assert.equal(response.status, 200)
})

test('refreshes a rotated token once and preserves a Request body for the retry', async () => {
  const originalWindow = Object.getOwnPropertyDescriptor(globalThis, 'window')
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: { location: { origin: 'https://planner.example' } },
  })

  const tokens: Array<string | null> = []
  const bodies: string[] = []
  let sessionCalls = 0
  let mutationCalls = 0
  const nativeFetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = input instanceof Request ? input.url : String(input)
    if (new URL(url, 'https://planner.example').pathname === '/api/session') {
      sessionCalls += 1
      return Response.json({ csrf: sessionCalls === 1 ? 'initial-token' : 'rotated-token' })
    }

    mutationCalls += 1
    tokens.push(new Headers(init?.headers).get('x-csrf-token'))
    bodies.push(input instanceof Request ? await input.text() : String(init?.body ?? ''))
    if (mutationCalls === 1) {
      return new Response(null, { status: 403, headers: { 'x-csrf-error': '1' } })
    }
    return new Response(null, { status: 200 })
  }) as typeof fetch

  try {
    const request = new Request('https://planner.example/api/hours', {
      method: 'POST',
      body: JSON.stringify({ hours: 8 }),
      headers: { 'content-type': 'application/json' },
    })
    const response = await securedFetch(nativeFetch, request)

    assert.equal(response.status, 200)
    assert.equal(sessionCalls, 2)
    assert.deepEqual(tokens, ['initial-token', 'rotated-token'])
    assert.deepEqual(bodies, ['{"hours":8}', '{"hours":8}'])
  } finally {
    if (originalWindow) Object.defineProperty(globalThis, 'window', originalWindow)
    else Reflect.deleteProperty(globalThis, 'window')
  }
})

test('keeps public login and legitimate server-to-server mutations compatible', async () => {
  const login = await middleware(mutationRequest('/api/auth/login', { origin: 'https://planner.example' }))
  assert.equal(login.status, 200)

  const serverRequest = await middleware(new NextRequest('https://planner.example/api/internal-task', { method: 'POST' }))
  assert.equal(serverRequest.status, 200)
})

test('supports an explicit production schema preflight on every deploy platform', () => {
  assert.equal(shouldVerifyProductionSchema({ PRODUCTION_SCHEMA_PREFLIGHT: '1' }), true)
  assert.equal(shouldVerifyProductionSchema({ PRODUCTION_SCHEMA_PREFLIGHT: '0' }), false)
  assert.equal(shouldVerifyProductionSchema({}), false)
})

function mutationRequest(path: string, headers: Record<string, string>): NextRequest {
  return new NextRequest(`https://planner.example${path}`, {
    method: 'POST',
    headers: { host: 'planner.example', 'sec-fetch-site': 'same-origin', ...headers },
  })
}

async function authenticatedSessionCookie(csrf: string): Promise<string> {
  const sealed = await sealData({
    user: {
      user_id: 'admin-test',
      display_name: 'Admin Test',
      role: 'admin',
      employee_id: null,
      location: null,
    },
    csrf,
  }, { password: sessionOptions.password, ttl: 3600 })
  return `${sessionOptions.cookieName}=${encodeURIComponent(sealed)}`
}
