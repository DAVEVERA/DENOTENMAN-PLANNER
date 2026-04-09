import type { NextApiRequest, NextApiResponse } from 'next'
import { getSession, can } from '@/lib/auth'
import { submitLeaveRequest, getLeaveRequests } from '@/lib/leave'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getSession(req, res)
  if (!session.user) return res.status(401).json({ success: false })

  if (req.method === 'GET') {
    if (!can(session.user, 'approve_leave') && !can(session.user, 'view_own'))
      return res.status(403).json({ success: false })
    const employee_id = can(session.user, 'approve_leave')
      ? req.query.employee_id ? parseInt(String(req.query.employee_id)) : undefined
      : session.user.employee_id ?? undefined
    const data = await getLeaveRequests({
      status:      String(req.query.status || ''),
      employee_id,
      from:        String(req.query.from  || ''),
      to:          String(req.query.to    || ''),
    })
    return res.json({ success: true, data })
  }

  if (req.method === 'POST') {
    if (!can(session.user, 'view_own')) return res.status(403).json({ success: false })
    const { leave_type, start_date, end_date, note } = req.body
    if (!leave_type || !start_date || !end_date)
      return res.status(400).json({ success: false, message: 'Verplichte velden ontbreken' })
    if (!session.user.employee_id)
      return res.status(400).json({ success: false, message: 'Geen medewerker gekoppeld aan dit account' })

    const emp = await import('@/lib/scheduler').then(m => m.getEmployee(session.user!.employee_id!))
    if (!emp) return res.status(400).json({ success: false, message: 'Medewerker niet gevonden' })

    const row = await submitLeaveRequest({
      employee_id:   emp.id,
      employee_name: emp.name,
      leave_type, start_date, end_date,
      note: note || null,
    })
    return res.status(201).json({ success: true, data: row })
  }

  res.status(405).json({ success: false })
}
