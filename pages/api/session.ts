/**
 * pages/api/session.ts
 * Retourneert de huidige sessie-gebruiker (zonder gevoelige data)
 */
import type { NextApiRequest, NextApiResponse } from 'next'
import { getSession } from '@/lib/auth'
import crypto from 'crypto'
import { setCsrfCookie } from '@/lib/request-security'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ success: false })
  res.setHeader('Cache-Control', 'private, no-store')
  const session = await getSession(req, res)
  if (!session.user) return res.json({ user: null })
  if (!session.csrf) {
    session.csrf = crypto.randomBytes(32).toString('hex')
    if ('save' in session && typeof session.save === 'function') await session.save()
  }
  setCsrfCookie(res, session.csrf)
  const { user_id, display_name, role, employee_id } = session.user
  return res.json({ user: { user_id, display_name, role, employee_id }, csrf: session.csrf })
}
