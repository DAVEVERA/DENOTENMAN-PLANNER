import type { NextApiRequest, NextApiResponse } from 'next'

export const CSRF_COOKIE_NAME = 'noten_csrf'
export const CSRF_HEADER_NAME = 'x-csrf-token'
const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])

interface HeaderResponse {
  getHeader(name: string): number | string | string[] | undefined
  setHeader(name: string, value: number | string | readonly string[]): unknown
}

export function isMutationMethod(method?: string): boolean {
  return MUTATING_METHODS.has((method ?? '').toUpperCase())
}

export function isBrowserRequest(origin?: string | null, secFetchSite?: string | null): boolean {
  return Boolean(origin || secFetchSite)
}

export function isSameOrigin(origin: string | null | undefined, host: string | null | undefined, protocol: string): boolean {
  if (!origin || !host) return false
  try {
    return new URL(origin).origin === `${protocol}://${host}`
  } catch {
    return false
  }
}

/** Constant-work comparison without depending on Node crypto in Next middleware. */
export function csrfTokensMatch(headerToken?: string | null, cookieToken?: string | null): boolean {
  if (!headerToken || !cookieToken || headerToken.length !== cookieToken.length) return false
  let mismatch = 0
  for (let index = 0; index < headerToken.length; index++) {
    mismatch |= headerToken.charCodeAt(index) ^ cookieToken.charCodeAt(index)
  }
  return mismatch === 0
}

/** Reject cross-site state changes even when a browser happens to attach cookies. */
export function hasSameOrigin(req: NextApiRequest): boolean {
  const origin = req.headers.origin
  const host = req.headers.host
  if (!origin || !host) return false
  const protocol = String(req.headers['x-forwarded-proto'] ?? (process.env.NODE_ENV === 'production' ? 'https' : 'http'))
    .split(',')[0].trim()
  return isSameOrigin(origin, host, protocol)
}

export function setCsrfCookie(res: NextApiResponse | HeaderResponse, token: string): void {
  appendSetCookie(res, [
    `${CSRF_COOKIE_NAME}=${encodeURIComponent(token)}`,
    'Path=/',
    'SameSite=Lax',
    process.env.NODE_ENV === 'production' ? 'Secure' : '',
    'Max-Age=86400',
  ].filter(Boolean).join('; '))
}

export function clearCsrfCookie(res: NextApiResponse | HeaderResponse): void {
  appendSetCookie(res, [
    `${CSRF_COOKIE_NAME}=`,
    'Path=/',
    'SameSite=Lax',
    process.env.NODE_ENV === 'production' ? 'Secure' : '',
    'Max-Age=0',
  ].filter(Boolean).join('; '))
}

function appendSetCookie(res: NextApiResponse | HeaderResponse, cookie: string): void {
  const current = res.getHeader('Set-Cookie')
  const values = Array.isArray(current) ? current : current ? [String(current)] : []
  res.setHeader('Set-Cookie', [...values, cookie])
}

export function getClientIp(req: NextApiRequest): string {
  const forwarded = req.headers['x-forwarded-for']
  if (typeof forwarded === 'string') return forwarded.split(',')[0].trim().slice(0, 64)
  return (req.socket.remoteAddress ?? 'unknown').slice(0, 64)
}
