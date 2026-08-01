import type { NextApiRequest, NextApiResponse } from 'next'
import { getSession, can } from '@/lib/auth'
import { updateTimeLog, archiveTimeLog, markLogsProcessed, reviewHourSubmission, withdrawEmployeeSubmission, getEmployeeTimeLog } from '@/lib/hours'
import { getEmployee } from '@/lib/scheduler'
import { sendHourReviewEmail } from '@/lib/email'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const session = await getSession(req, res)
    if (!session.user) return res.status(401).json({ success: false })

    const id = parseInt(String(req.query.id))
    if (!id || isNaN(id)) return res.status(400).json({ success: false, message: 'Ongeldig ID' })

    // Admin operations
    if (can(session.user, 'manage_hours')) {
      if (req.method === 'PUT') {
        const existing = await getEmployeeTimeLog(id)
        if (!existing) return res.status(404).json({ success: false, message: 'Registratie niet gevonden' })
        if (existing.submission_status !== 'direct') {
          return res.status(409).json({
            success: false,
            message: 'Ingediende uren kunnen alleen worden goed- of afgekeurd; aanpassen doet de medewerker zelf.',
          })
        }
        const { log_date, location, clock_in, clock_out, break_minutes, overtime_hours, note } = req.body ?? {}
        const log = await updateTimeLog(id, { log_date, location, clock_in, clock_out, break_minutes, overtime_hours, note })
        return res.json({ success: true, data: log })
      }

      if (req.method === 'DELETE') {
        await archiveTimeLog(id, session.user.display_name ?? session.user.user_id)
        return res.json({ success: true })
      }

      // PATCH: review submission or mark processed
      if (req.method === 'PATCH') {
        const { status, review_note, action } = req.body ?? {}

        if (status === 'approved' || status === 'rejected') {
          const updated = await reviewHourSubmission(
            id,
            status,
            session.user.display_name ?? session.user.user_id,
            review_note,
          )

          if (updated?.employee_id) {
            try {
              const emp = await getEmployee(updated.employee_id)
              if (emp?.email) {
                await sendHourReviewEmail({
                  to: emp.email,
                  employeeName: emp.name,
                  logDate: updated.log_date,
                  decision: status,
                  note: review_note,
                })
              }
            } catch (mailErr) {
              console.error('[api/hours] Review mail failed:', mailErr)
            }
          }

          return res.json({ success: true, data: updated })
        }

        if (action === 'process') {
          await markLogsProcessed([id])
          return res.json({ success: true })
        }

        return res.status(400).json({ success: false, message: 'Ongeldige actie' })
      }

      return res.status(405).json({ success: false })
    }

    // Employee: can only delete own pending submissions
    if (can(session.user, 'view_own') && req.method === 'DELETE') {
      if (!session.user.employee_id)
        return res.status(400).json({ success: false, message: 'Geen medewerker gekoppeld' })

      await withdrawEmployeeSubmission(id, session.user.employee_id)
      return res.json({ success: true })
    }

    res.status(403).json({ success: false })
  } catch (err: any) {
    console.error('[api/hours/[id]]', err)
    res.status(500).json({ success: false, message: err?.message ?? 'Server error' })
  }
}
