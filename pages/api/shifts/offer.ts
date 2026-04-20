import type { NextApiRequest, NextApiResponse } from 'next'
import { getSession, can } from '@/lib/auth'
import { supabase, T } from '@/lib/db'
import { getShift } from '@/lib/scheduler'
import { sendPushToAll } from '@/lib/push'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const session = await getSession(req, res)
    if (!session.user) return res.status(401).json({ success: false })
    if (!can(session.user, 'view_own')) return res.status(403).json({ success: false })

    const employeeId = session.user.employee_id
    if (!employeeId) return res.status(400).json({ success: false, message: 'Geen medewerker gekoppeld' })

    // POST: offer own shift
    if (req.method === 'POST') {
      const { shift_id } = req.body
      if (!shift_id) return res.status(400).json({ success: false, message: 'shift_id verplicht' })

      const shift = await getShift(parseInt(shift_id))
      if (!shift) return res.status(404).json({ success: false, message: 'Dienst niet gevonden' })
      if (shift.employee_id !== employeeId)
        return res.status(403).json({ success: false, message: 'Dit is niet jouw dienst' })

      const { error } = await supabase.from(T('shifts'))
        .update({ is_open: 1, shift_category: 'offered', open_invite_emp_id: null, open_invite_status: null })
        .eq('id', parseInt(shift_id))
      if (error) throw error

      // Notify all employees
      try {
        await sendPushToAll({
          title: '🔄 Dienst aangeboden',
          body: `${shift.employee_name} biedt een ${shift.shift_type}-dienst aan (week ${shift.week_number}, ${shift.day_of_week}). Klik om over te nemen!`,
          url: '/me/open-shifts',
        })
      } catch { /* push optional */ }

      return res.json({ success: true })
    }

    // DELETE: withdraw offer
    if (req.method === 'DELETE') {
      const { shift_id } = req.body
      const { error } = await supabase.from(T('shifts'))
        .update({ is_open: 0, shift_category: 'regular', open_invite_emp_id: null, open_invite_status: null })
        .eq('id', parseInt(shift_id))
        .eq('employee_id', employeeId)
      if (error) throw error
      return res.json({ success: true })
    }

    res.status(405).json({ success: false })
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message })
  }
}
