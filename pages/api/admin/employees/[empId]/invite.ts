import type { NextApiRequest, NextApiResponse } from 'next'
import { getSession, can, sendInviteForEmployee } from '@/lib/auth'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ success: false })

  const session = await getSession(req, res)
  if (!session.user) return res.status(401).json({ success: false })
  if (!can(session.user, 'manage_employees')) return res.status(403).json({ success: false })

  const empId = parseInt(String(req.query.empId))
  if (!empId) return res.status(400).json({ success: false, message: 'Ongeldig ID' })

  try {
    await sendInviteForEmployee(empId)
    return res.json({ success: true, message: 'Uitnodiging verzonden' })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    return res.status(400).json({ success: false, message: msg })
  }
}
