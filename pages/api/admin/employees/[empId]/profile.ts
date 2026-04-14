import type { NextApiRequest, NextApiResponse } from 'next'
import { getSession, can } from '@/lib/auth'
import { getProfile } from '@/lib/profile'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ success: false })

  const session = await getSession(req, res)
  if (!session.user) return res.status(401).json({ success: false })
  if (!can(session.user, 'manage_employees')) return res.status(403).json({ success: false })

  const empId = parseInt(String(req.query.empId))
  if (!empId) return res.status(400).json({ success: false })

  try {
    const profile = await getProfile(empId)
    return res.json({ success: true, data: profile })
  } catch (err: unknown) {
    return res.status(500).json({ success: false, message: String(err) })
  }
}
