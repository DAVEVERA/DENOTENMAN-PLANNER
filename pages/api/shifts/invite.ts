import type { NextApiRequest, NextApiResponse } from 'next'
import { getSession, can } from '@/lib/auth'
import { inviteEmployeeToShift, respondToInvitation, getShift } from '@/lib/scheduler'
import { sendPushToEmployee } from '@/lib/push'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getSession(req, res)
  if (!session.user) return res.status(401).json({ success: false })

  // POST /api/shifts/invite — admin sends invite
  if (req.method === 'POST') {
    if (!can(session.user, 'send_notifications')) return res.status(403).json({ success: false })
    const { shift_id, employee_id } = req.body
    if (!shift_id || !employee_id) return res.status(400).json({ success: false, message: 'shift_id en employee_id zijn verplicht' })

    const ok = await inviteEmployeeToShift(parseInt(shift_id), parseInt(employee_id))
    if (!ok) return res.status(500).json({ success: false })

    // Push notification
    try {
      const shift = await getShift(parseInt(shift_id))
      if (shift) {
        await sendPushToEmployee(parseInt(employee_id), {
          title: 'Uitnodiging voor open dienst',
          body:  `Je bent uitgenodigd voor een ${shift.shift_type}-dienst op ${shift.day_of_week} (week ${shift.week_number})`,
          url:   '/me',
        })
      }
    } catch { /* push optional */ }

    return res.json({ success: true })
  }

  // PATCH /api/shifts/invite — employee responds
  if (req.method === 'PATCH') {
    if (!can(session.user, 'view_own')) return res.status(403).json({ success: false })
    const { shift_id, response } = req.body
    if (!shift_id || (response !== 'accepted' && response !== 'declined'))
      return res.status(400).json({ success: false, message: 'Ongeldige invoer' })
    const ok = await respondToInvitation(parseInt(shift_id), response)
    return res.json({ success: ok })
  }

  res.status(405).json({ success: false })
}
