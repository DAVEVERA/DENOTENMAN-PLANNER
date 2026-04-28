/**
 * pages/api/session.ts
 * Retourneert de huidige sessie-gebruiker (zonder gevoelige data)
 */
import type { NextApiRequest, NextApiResponse } from 'next'
import { getSession } from '@/lib/auth'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ success: false })
  const session = await getSession(req, res)
  if (!session.user) return res.json({ user: null })
  const { user_id, display_name, role, employee_id } = session.user
  return res.json({ user: { user_id, display_name, role, employee_id } })
}
