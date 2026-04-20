import type { NextApiRequest, NextApiResponse } from 'next'
import { getSession, can } from '@/lib/auth'
import { supabase, T } from '@/lib/db'
import { getShift, getEmployee } from '@/lib/scheduler'
import { sendPushToEmployee } from '@/lib/push'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const session = await getSession(req, res)
    if (!session.user) return res.status(401).json({ success: false })
    if (!can(session.user, 'view_own')) return res.status(403).json({ success: false })

    const employeeId = session.user.employee_id
    if (!employeeId) return res.status(400).json({ success: false, message: 'Geen medewerker gekoppeld' })

    // POST: claim an open shift
    if (req.method === 'POST') {
      const { shift_id } = req.body
      if (!shift_id) return res.status(400).json({ success: false, message: 'shift_id verplicht' })

      const shift = await getShift(parseInt(shift_id))
      if (!shift) return res.status(404).json({ success: false, message: 'Dienst niet gevonden' })
      if (!shift.is_open) return res.status(400).json({ success: false, message: 'Dienst is niet open' })
      if (shift.open_invite_status === 'pending')
        return res.status(400).json({ success: false, message: 'Er is al een claim op deze dienst' })

      const { error } = await supabase.from(T('shifts'))
        .update({ open_invite_emp_id: employeeId, open_invite_status: 'pending' })
        .eq('id', parseInt(shift_id))
      if (error) throw error

      // Notify admin (employee_id 1 = Fedor)
      try {
        const emp = await getEmployee(employeeId)
        await sendPushToEmployee(1, {
          title: '📋 Nieuwe claim op open dienst',
          body: `${emp?.name ?? 'Een medewerker'} wil de ${shift.shift_type}-dienst (week ${shift.week_number}) overnemen.`,
          url: '/admin/open-shifts',
        })
      } catch { /* push optional */ }

      return res.json({ success: true })
    }

    // DELETE: withdraw claim
    if (req.method === 'DELETE') {
      const { shift_id } = req.body
      const { error } = await supabase.from(T('shifts'))
        .update({ open_invite_emp_id: null, open_invite_status: null })
        .eq('id', parseInt(shift_id))
        .eq('open_invite_emp_id', employeeId)
      if (error) throw error
      return res.json({ success: true })
    }

    res.status(405).json({ success: false })
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message })
  }
}
