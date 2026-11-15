import { NextRequest, NextResponse } from 'next/server'
import { unsealData } from 'iron-session'
import { sessionOptions, type PlannerSessionData } from './lib/session'
import {
  CSRF_COOKIE_NAME,
  CSRF_HEADER_NAME,
  csrfTokensMatch,
  isBrowserRequest,
  isMutationMethod,
  isSameOrigin,
} from './lib/request-security'

const PUBLIC_MUTATION_PATHS = new Set([
  '/api/auth/login',
  '/api/auth/forgot-password',
  '/api/auth/reset-password',
  '/api/inspectie/login',
])

export async function middleware(request: NextRequest) {
  if (!isMutationMethod(request.method)) return NextResponse.next()

  const origin = request.headers.get('origin')
  const secFetchSite = request.headers.get('sec-fetch-site')
  if (!isBrowserRequest(origin, secFetchSite)) {
    // Cron and server-to-server callers authenticate separately and do not carry browser metadata.
    return NextResponse.next()
  }

  const host = request.headers.get('host')
  const protocol = (request.headers.get('x-forwarded-proto') ?? request.nextUrl.protocol.replace(':', ''))
    .split(',')[0].trim()
  if (!isSameOrigin(origin, host, protocol)) return csrfError()

  if (PUBLIC_MUTATION_PATHS.has(request.nextUrl.pathname)) return NextResponse.next()

  const sealedSession = request.cookies.get(sessionOptions.cookieName)?.value
  const session = sealedSession
    ? await unsealData<PlannerSessionData>(sealedSession, {
        password: sessionOptions.password,
        ttl: sessionOptions.ttl,
      })
    : {}
  if (!session.user) return NextResponse.next()

  const headerToken = request.headers.get(CSRF_HEADER_NAME)
  const cookieToken = request.cookies.get(CSRF_COOKIE_NAME)?.value
  if (!csrfTokensMatch(headerToken, cookieToken) || !csrfTokensMatch(headerToken, session.csrf)) {
    return csrfError()
  }

  return NextResponse.next()
}

function csrfError() {
  return NextResponse.json(
    { success: false, code: 'CSRF_INVALID' },
    { status: 403, headers: { 'x-csrf-error': '1' } },
  )
}

export const config = {
  matcher: '/api/:path*',
}
