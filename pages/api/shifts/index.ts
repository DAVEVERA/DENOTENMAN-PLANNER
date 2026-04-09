import type { NextApiRequest, NextApiResponse } from 'next'
import { getSession, can } from '@/lib/auth'
import { getWeekShifts, getEmployeeShifts, saveShift } from '@/lib/scheduler'
import { currentWeekYear } from '@/lib/dateUtils'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getSession(req, res)
  if (!session.user) return res.status(401).json({ success: false, message: 'Niet ingelogd' })

  if (req.method === 'GET') {
    if (!can(session.user, 'read'))
      return res.status(403).json({ success: false, message: 'Toegang geweigerd' })
    const week = parseInt(String(req.query.week || 0))
    const year = parseInt(String(req.query.year || new Date().getFullYear()))
    const empId    = req.query.employee_id ? parseInt(String(req.query.employee_id)) : undefined
    const location = req.query.location as any ?? undefined
    const shifts   = empId
      ? await getEmployeeShifts(empId, week || undefined, year)
      : await getWeekShifts(week || currentWeekYear().week, year, location)
    return res.json({ success: true, data: shifts })
  }

  if (req.method === 'POST') {
    if (!can(session.user, 'manage_shifts'))
      return res.status(403).json({ success: false, message: 'Toegang geweigerd' })
    const result = await saveShift(req.body, session.user.user_id)
    if ('error' in result) return res.status(400).json({ success: false, message: result.error })
    return res.status(201).json({ success: true, data: result })
  }

  res.status(405).json({ success: false })
}
