import type { SessionOptions } from 'iron-session'
import type { SessionUser } from '@/types'

export interface PlannerSessionData {
  user?: SessionUser
  csrf?: string
  inspection_expires_at?: number
  inspection_admin_return?: SessionUser
  inspection_admin_csrf?: string
  inspection_service_number_hash?: string
  inspection_service_number_suffix?: string
  inspection_integrity_accepted_at?: number
}

// In production this MUST come from the environment — a hardcoded fallback
// here would mean anyone who has ever seen this source can forge session
// cookies for any account. Local dev gets a fixed (but non-committed-secret)
// value only when NODE_ENV isn't production, so `next dev` still works
// without a .env.local entry.
const SESSION_PASSWORD = process.env.SECRET_KEY
  ?? (process.env.NODE_ENV !== 'production' ? 'dev-only-session-secret-not-for-production-use-32chars' : undefined)

if (!SESSION_PASSWORD) {
  throw new Error(
    '[session] SECRET_KEY environment variable is required in production. ' +
    'Set it to a random string of at least 32 characters before starting the server.'
  )
}

export const sessionOptions: SessionOptions = {
  password: SESSION_PASSWORD,
  cookieName: 'noten_session',
  cookieOptions: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 86400,
  },
}
