import type { NextApiRequest, NextApiResponse } from 'next'
import { getSession, can } from '@/lib/auth'
import { supabase, T } from '@/lib/db'
import { getShift, getEmployee } from '@/lib/scheduler'
import { sendPushToEmployee } from '@/lib/push'
import { createOpenShiftClaim, withdrawOpenShiftClaim } from '@/lib/open-shift-claims'

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
      if (shift.employee_id === employeeId)
        return res.status(400).json({ success: false, message: 'Je kunt niet op je eigen aangeboden dienst inschrijven' })

      const emp = await getEmployee(employeeId)
      const claim = await createOpenShiftClaim(shift, employeeId, emp?.name ?? session.user.display_name)
      if ('error' in claim) return res.status(400).json({ success: false, message: claim.error })

      // Notify all admins via push
      try {
        const { data: adminUsers } = await supabase
          .from(T('users'))
          .select('employee_id')
          .eq('role', 'admin')
          .not('employee_id', 'is', null)
        for (const u of (adminUsers ?? [])) {
          if (u.employee_id) {
            await sendPushToEmployee(u.employee_id, {
              title: '📋 Nieuwe claim op open dienst',
              body: `${emp?.name ?? 'Een medewerker'} wil de ${shift.shift_type}-dienst (week ${shift.week_number}) overnemen.`,
              url: '/admin/open-shifts',
            })
          }
        }
      } catch { /* push optional */ }

      return res.json({ success: true })
    }

    // DELETE: withdraw claim
    if (req.method === 'DELETE') {
      const { shift_id } = req.body
      const ok = await withdrawOpenShiftClaim(parseInt(shift_id), employeeId)
      return res.json({ success: ok })
    }

    res.status(405).json({ success: false })
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message })
  }
}
