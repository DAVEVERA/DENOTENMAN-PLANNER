import type { NextApiRequest, NextApiResponse } from 'next'
import { getSession, can } from '@/lib/auth'
import { supabase, T } from '@/lib/db'
import { getShift, getEmployee, closeRemainingOpenShifts } from '@/lib/scheduler'
import { sendPushToEmployee } from '@/lib/push'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const session = await getSession(req, res)
    if (!session.user) return res.status(401).json({ success: false })
    if (!can(session.user, 'manage_shifts')) return res.status(403).json({ success: false })

    // PATCH: approve or decline a claim/offer
    if (req.method === 'PATCH') {
      const { shift_id, approved } = req.body
      if (!shift_id) return res.status(400).json({ success: false, message: 'shift_id verplicht' })

      const shift = await getShift(parseInt(shift_id))
      if (!shift) return res.status(404).json({ success: false, message: 'Dienst niet gevonden' })

      if (approved) {
        const claimerId = shift.open_invite_emp_id
        if (!claimerId) return res.status(400).json({ success: false, message: 'Geen claimer gevonden' })
        const claimer = await getEmployee(claimerId)

        const { error } = await supabase.from(T('shifts')).update({
          employee_id:        claimerId,
          employee_name:      claimer?.name ?? shift.employee_name,
          is_open:            0,
          open_invite_status: 'accepted',
          shift_category:     'regular',
          open_invite_emp_id: null,
        }).eq('id', parseInt(shift_id))
        if (error) throw error

        // ── Auto-close: sluit overige open diensten voor dezelfde slot ──
        try {
          const closed = await closeRemainingOpenShifts(
            shift.day_of_week,
            shift.week_number,
            shift.year,
            shift.shift_type,
          )
          if (closed > 0) {
            console.log(`[approve] Auto-closed ${closed} remaining open shift(s) for ${shift.day_of_week} week ${shift.week_number}`)
          }
        } catch (err) {
          console.error('[approve] Auto-close error (non-fatal):', err)
        }

        // Notify claimer
        try {
          await sendPushToEmployee(claimerId, {
            title: '✅ Claim goedgekeurd!',
            body:  `Jouw claim op de ${shift.shift_type}-dienst (week ${shift.week_number}, ${shift.day_of_week}) is goedgekeurd.`,
            url:   '/me',
          })
        } catch { /* push optional */ }

        // If offered by employee, notify original employee
        if (shift.employee_id && shift.employee_id !== claimerId) {
          try {
            await sendPushToEmployee(shift.employee_id, {
              title: '✅ Dienst overgenomen',
              body:  `Je ${shift.shift_type}-dienst (week ${shift.week_number}, ${shift.day_of_week}) is overgenomen door ${claimer?.name ?? 'een collega'}.`,
              url:   '/me',
            })
          } catch { /* push optional */ }
        }
      } else {
        // Decline
        const claimerId = shift.open_invite_emp_id
        const { error } = await supabase.from(T('shifts')).update({
          open_invite_emp_id: null,
          open_invite_status: null,
        }).eq('id', parseInt(shift_id))
        if (error) throw error

        // Notify claimer of decline
        if (claimerId) {
          try {
            await sendPushToEmployee(claimerId, {
              title: '❌ Claim afgewezen',
              body:  `Je claim op de ${shift.shift_type}-dienst (week ${shift.week_number}) is afgewezen.`,
              url:   '/me/open-shifts',
            })
          } catch { /* push optional */ }
        }
      }
      return res.json({ success: true })
    }

    res.status(405).json({ success: false })
  } catch (err: any) {
    console.error('[shifts/approve]', err.message)
    res.status(500).json({ success: false, message: err.message })
  }
}
