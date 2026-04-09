import type { SessionOptions } from 'iron-session'
import type { SessionUser } from '@/types'

declare module 'iron-session' {
  interface IronSessionData {
    user?: SessionUser
    csrf?: string
  }
}

export const sessionOptions: SessionOptions = {
  password: process.env.SECRET_KEY ?? 'fallback-secret-change-in-production-xx',
  cookieName: 'noten_session',
  cookieOptions: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 86400,
  },
}
