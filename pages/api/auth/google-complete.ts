import type { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth/next'
import { authOptions } from './[...nextauth]'
import { getIronSession } from 'iron-session'
import { sessionOptions } from '@/lib/session'
import type { SessionUser } from '@/types'

/**
 * POST /api/auth/google-complete
 * Wordt aangeroepen vanuit de login-pagina nadat NextAuth de Google
 * OAuth-flow heeft afgerond.  Zet de NextAuth-sessie om naar een
 * iron-session zodat de rest van de back-end gelijk blijft.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end()

  const nextSession = await getServerSession(req, res, authOptions)
  if (!nextSession?.user) {
    return res.status(401).json({ success: false, message: 'Geen Google-sessie gevonden' })
  }

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

  return res.status(200).json({ success: true })
}
