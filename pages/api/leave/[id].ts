import type { NextApiRequest, NextApiResponse } from 'next'
import { getSession, can } from '@/lib/auth'
import { reviewLeaveRequest } from '@/lib/leave'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getSession(req, res)
  if (!session.user) return res.status(401).json({ success: false })
  if (!can(session.user, 'approve_leave')) return res.status(403).json({ success: false })

  const id = parseInt(String(req.query.id))

  if (req.method === 'PUT') {
    const { decision } = req.body
    if (decision !== 'approved' && decision !== 'rejected')
      return res.status(400).json({ success: false, message: 'Ongeldige beslissing' })
    const row = await reviewLeaveRequest(id, decision, session.user.user_id)
    return res.json({ success: true, data: row })
  }

  res.status(405).json({ success: false })
}
