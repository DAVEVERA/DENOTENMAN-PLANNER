import type { NextApiRequest, NextApiResponse } from 'next'
import { getSession, can } from '@/lib/auth'
import { getOpenShifts, saveShift } from '@/lib/scheduler'
import type { Location } from '@/types'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getSession(req, res)
  if (!session.user) return res.status(401).json({ success: false })

  if (req.method === 'GET') {
    if (!can(session.user, 'read')) return res.status(403).json({ success: false })
    const location = req.query.location as Location | undefined
    const shifts = await getOpenShifts(location)
    return res.json({ success: true, data: shifts })
  }

  if (req.method === 'POST') {
    if (!can(session.user, 'manage_shifts')) return res.status(403).json({ success: false })
    const result = await saveShift({ ...req.body, is_open: 1, employee_id: null }, session.user.user_id)
    if ('error' in result) return res.status(400).json({ success: false, message: result.error })
    return res.status(201).json({ success: true, data: result })
  }

  res.status(405).json({ success: false })
}
