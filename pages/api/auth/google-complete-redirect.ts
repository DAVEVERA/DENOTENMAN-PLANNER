import type { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth/next'
import { authOptions } from './[...nextauth]'
import { getIronSession } from 'iron-session'
import { sessionOptions } from '@/lib/session'
import type { SessionUser } from '@/types'

/**
 * GET /api/auth/google-complete-redirect
 * NextAuth callbackUrl na Google-OAuth.
 * Zet de NextAuth-sessie om naar iron-session en stuurt door naar /.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const nextSession = await getServerSession(req, res, authOptions)

  if (nextSession?.user) {
    const session = await getIronSession<{ user?: SessionUser; csrf?: string }>(req, res, sessionOptions)
    session.user = {
      user_id:      nextSession.user.email ?? nextSession.user.name ?? 'google-user',
      display_name: nextSession.user.name  ?? nextSession.user.email ?? 'Google User',
      role:         'admin',
      employee_id:  null,
      location:     null,
    }
    session.csrf = Math.random().toString(36).slice(2)
    await session.save()
  }

  res.redirect(302, '/')
}
