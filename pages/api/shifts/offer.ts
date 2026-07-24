import type { NextApiRequest, NextApiResponse } from 'next'
import { getSession, can } from '@/lib/auth'
import { supabase, T } from '@/lib/db'
import { getShift, getEmployees } from '@/lib/scheduler'
import { sendPushToAll } from '@/lib/push'
import { sendOpenShiftSubmissionEmails } from '@/lib/email'
import { formatShiftDate } from '@/lib/shiftDate'
import { parseOpenShiftNote } from '@/lib/open-shift-note'
import type { Day } from '@/types'

const DAY_NL: Record<string, string> = {
  maandag: 'Maandag', dinsdag: 'Dinsdag', woensdag: 'Woensdag',
  donderdag: 'Donderdag', vrijdag: 'Vrijdag', zaterdag: 'Zaterdag', zondag: 'Zondag',
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const session = await getSession(req, res)
    if (!session.user) return res.status(401).json({ success: false })
    if (!can(session.user, 'view_own')) return res.status(403).json({ success: false })

    const employeeId = session.user.employee_id
    if (!employeeId) return res.status(400).json({ success: false, message: 'Geen medewerker gekoppeld' })

    // POST: offer own shift
    if (req.method === 'POST') {
      const { shift_id, open_note } = req.body
      if (!shift_id) return res.status(400).json({ success: false, message: 'shift_id verplicht' })

      const parsedNote = parseOpenShiftNote(open_note)
      if (parsedNote.error) return res.status(400).json({ success: false, message: parsedNote.error })

      const shift = await getShift(parseInt(shift_id))
      if (!shift) return res.status(404).json({ success: false, message: 'Dienst niet gevonden' })
      if (shift.employee_id !== employeeId)
        return res.status(403).json({ success: false, message: 'Dit is niet jouw dienst' })

      const { error } = await supabase.from(T('shifts'))
        .update({
          is_open: 1,
          shift_category: 'offered',
          open_invite_emp_id: null,
          open_invite_status: null,
          open_note: parsedNote.value,
          open_note_author_employee_id: employeeId,
          opened_at: new Date().toISOString(),
        })
        .eq('id', parseInt(shift_id))
      if (error) throw error

      // Notifications are best-effort; the offer itself should not fail on SMTP/push issues.
      try {
        const employees = await getEmployees(true)
        const submitter = employees.find(e => e.id === employeeId)
        const adminEmail = process.env.ADMIN_EMAIL ?? 'info@denotenman.com'
        const day = DAY_NL[shift.day_of_week] ?? shift.day_of_week
        const date = formatShiftDate(shift.day_of_week as Day, shift.week_number, shift.year)
        const shiftLabel = `${shift.shift_type}-dienst op ${day} ${date} (week ${shift.week_number})`
        const emails = employees
          .map(e => {
            if (e.id === employeeId) return null
            if (!e.email) return null
            if (e.email.toLowerCase() === adminEmail.toLowerCase()) return null
            return e.email
          })
          .filter(Boolean) as string[]

        await sendOpenShiftSubmissionEmails({
          adminEmail,
          submitterEmail: submitter?.email ?? null,
          submitterName: shift.employee_name,
          otherEmployeeEmails: emails,
          shiftLabel,
          adminBody: `${shift.employee_name} heeft een open dienst ingezonden.\n\nDienst: ${shiftLabel}\n\nBekijk deze in de admin planner.`,
          submitterBody: `Hallo ${shift.employee_name},\n\nJe open dienst is succesvol ingezonden.\n\nDienst: ${shiftLabel}\n\nJe ontvangt bericht zodra iemand zich inschrijft en de dienst is verwerkt.`,
          employeeBody: `Er is een open dienst ingezonden waarop je kunt inschrijven.\n\nDienst: ${shiftLabel}\nAangeboden door: ${shift.employee_name}\n\nLog in via de app om deze dienst te bekijken en je in te schrijven.`,
        })

        await sendPushToAll({
          title: 'Dienst aangeboden',
          body: `${shift.employee_name} biedt een ${shift.shift_type}-dienst aan (week ${shift.week_number}, ${shift.day_of_week}). Klik om over te nemen!`,
          url: '/me/open-shifts',
        })
      } catch (err) {
        console.error('Error sending offer shift alert:', err)
      }

      return res.json({ success: true })
    }

    // DELETE: withdraw offer
    if (req.method === 'DELETE') {
      const { shift_id } = req.body
      const { error } = await supabase.from(T('shifts'))
        .update({
          is_open: 0,
          shift_category: 'regular',
          open_invite_emp_id: null,
          open_invite_status: null,
          open_note: null,
          open_note_author_employee_id: null,
          opened_at: null,
        })
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
