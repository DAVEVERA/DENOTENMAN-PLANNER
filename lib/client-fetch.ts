import { CSRF_HEADER_NAME } from './request-security'

const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])
const PUBLIC_MUTATION_PATHS = new Set([
  '/api/auth/login',
  '/api/auth/forgot-password',
  '/api/auth/reset-password',
  '/api/inspectie/login',
])

let csrfTokenPromise: Promise<string | null> | null = null

function requestUrl(input: RequestInfo | URL): URL | null {
  if (typeof window === 'undefined') return null
  try {
    if (input instanceof Request) return new URL(input.url, window.location.origin)
    return new URL(String(input), window.location.origin)
  } catch {
    return null
  }
}

async function loadCsrfToken(nativeFetch: typeof fetch): Promise<string | null> {
  if (!csrfTokenPromise) {
    csrfTokenPromise = nativeFetch('/api/session', {
      cache: 'no-store',
      credentials: 'same-origin',
    }).then(async response => {
      if (!response.ok) return null
      const payload = await response.json().catch(() => null)
      return typeof payload?.csrf === 'string' ? payload.csrf : null
    }).catch(() => null)
  }
  return csrfTokenPromise
}

function resetCsrfToken(): void {
  csrfTokenPromise = null
}

export async function securedFetch(nativeFetch: typeof fetch, input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const url = requestUrl(input)
  const method = String(init?.method ?? (input instanceof Request ? input.method : 'GET')).toUpperCase()
  const isSameOriginApi = url?.origin === window.location.origin && url.pathname.startsWith('/api/')
  const needsCsrf = isSameOriginApi && MUTATING_METHODS.has(method) && !PUBLIC_MUTATION_PATHS.has(url.pathname)
  const retryInput = needsCsrf && input instanceof Request ? input.clone() : input

  let requestInit = init
  if (needsCsrf) {
    const token = await loadCsrfToken(nativeFetch)
    const headers = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined))
    if (token) headers.set(CSRF_HEADER_NAME, token)
    requestInit = { ...init, headers }
  }

  let response = await nativeFetch(input, requestInit)
  if (needsCsrf && response.status === 403 && response.headers.get('x-csrf-error') === '1') {
    resetCsrfToken()
    const token = await loadCsrfToken(nativeFetch)
    if (token) {
      const headers = new Headers(requestInit?.headers ?? (input instanceof Request ? input.headers : undefined))
      headers.set(CSRF_HEADER_NAME, token)
      response = await nativeFetch(retryInput, { ...requestInit, headers })
    }
  }

  if (url?.pathname === '/api/auth/login' || url?.pathname === '/api/auth/logout') resetCsrfToken()
  return response
}

/** Installs one same-origin API fetch guard without changing existing call sites. */
export function installCsrfFetch(): void {
  if (typeof window === 'undefined') return
  const target = window as typeof window & { __notenCsrfFetchInstalled?: boolean }
  if (target.__notenCsrfFetchInstalled) return
  const nativeFetch = window.fetch.bind(window)
  window.fetch = ((input: RequestInfo | URL, init?: RequestInit) => securedFetch(nativeFetch, input, init)) as typeof fetch
  target.__notenCsrfFetchInstalled = true
}
