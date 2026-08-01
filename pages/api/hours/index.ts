import type { NextApiRequest, NextApiResponse } from 'next'
import { getSession, can } from '@/lib/auth'
import { logHours, getTimeLogs, submitEmployeeHours, getPendingSubmissions } from '@/lib/hours'
import { getEmployee } from '@/lib/scheduler'
import { sendHourSubmissionAlertEmail } from '@/lib/email'
import type { Location, SubmissionStatus } from '@/types'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const session = await getSession(req, res)
    if (!session.user) return res.status(401).json({ success: false, message: 'Niet ingelogd' })

    if (req.method === 'GET') {
      if (!can(session.user, 'manage_hours') && !can(session.user, 'view_own'))
        return res.status(403).json({ success: false })

      if (req.query.pending === '1' && can(session.user, 'manage_hours')) {
        const pending = await getPendingSubmissions()
        return res.json({ success: true, data: pending })
      }

      const employee_id = can(session.user, 'manage_hours')
        ? req.query.employee_id ? parseInt(String(req.query.employee_id)) : undefined
        : session.user.employee_id ?? undefined
      const logs = await getTimeLogs({
        employee_id,
        from:              String(req.query.from     || ''),
        to:                String(req.query.to       || ''),
        location:          (req.query.location as Location) || undefined,
        is_processed:      req.query.is_processed !== undefined ? parseInt(String(req.query.is_processed)) : undefined,
        submission_status: (req.query.submission_status as SubmissionStatus) || undefined,
        // De medewerker moet een afwijzing en reden kunnen terugzien om via
        // het rooster een nieuwe, bewaarde correctierevisie in te dienen.
        exclude_rejected:  false,
      })
      return res.json({ success: true, data: logs })
    }

    if (req.method === 'POST') {
      const { employee_id, employee_name, log_date, location, clock_in, clock_out, break_minutes, overtime_hours, note } = req.body

      // Employee self-submission
      if (!can(session.user, 'manage_hours')) {
        if (!can(session.user, 'view_own'))
          return res.status(403).json({ success: false })

        const empId = session.user.employee_id
        if (!empId)
          return res.status(400).json({ success: false, message: 'Geen medewerker gekoppeld aan dit account' })
        if (!log_date || !clock_in || !clock_out)
          return res.status(400).json({ success: false, message: 'Datum, inklok- en uitkloktijd zijn verplicht' })

        const emp = await getEmployee(empId)
        const log = await submitEmployeeHours({
          employee_id:   empId,
          employee_name: emp?.name ?? session.user.display_name ?? '',
          log_date,
          location:      location ?? emp?.location ?? 'markt',
          clock_in,
          clock_out,
          break_minutes: parseInt(String(break_minutes)) || 0,
          note:          note ?? null,
          created_by:    session.user.user_id,
        })

        try {
          await sendHourSubmissionAlertEmail({
            employeeName: log.employee_name,
            logDate: log.log_date,
            clockIn: log.clock_in ?? '',
            clockOut: log.clock_out ?? '',
          })
        } catch (emailErr) {
          console.error('[api/hours] Email failed:', emailErr)
        }

        return res.status(201).json({ success: true, data: log })
      }

      // Admin direct entry
      const log = await logHours({
        employee_id, employee_name, log_date,
        location:          location      ?? 'markt',
        clock_in:          clock_in      ?? null,
        clock_out:         clock_out     ?? null,
        break_minutes:     break_minutes ?? 0,
        overtime_hours:    overtime_hours ?? 0,
        shift_id:          null,
        note:              note          ?? null,
        is_processed:      0,
        processed_at:      null,
        submission_status: 'direct',
        reviewed_by:       null,
        reviewed_at:       null,
        review_note:       null,
        created_by:        session.user.user_id,
      }, session.user.user_id)
      return res.status(201).json({ success: true, data: log })
    }

    res.status(405).json({ success: false })
  } catch (err: any) {
    console.error('[/api/hours]', err)
    res.status(500).json({ success: false, message: err?.message ?? 'Server error' })
  }
}
