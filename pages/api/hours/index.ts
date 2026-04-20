import type { NextApiRequest, NextApiResponse } from 'next'
import { getSession, can } from '@/lib/auth'
import { logHours, getTimeLogs } from '@/lib/hours'
import type { Location } from '@/types'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const session = await getSession(req, res)
    if (!session.user) return res.status(401).json({ success: false, message: 'Niet ingelogd' })

    if (req.method === 'GET') {
      if (!can(session.user, 'manage_hours') && !can(session.user, 'view_own'))
        return res.status(403).json({ success: false })
      const employee_id = can(session.user, 'manage_hours')
        ? req.query.employee_id ? parseInt(String(req.query.employee_id)) : undefined
        : session.user.employee_id ?? undefined
      const logs = await getTimeLogs({
        employee_id,
        from:         String(req.query.from     || ''),
        to:           String(req.query.to       || ''),
        location:     (req.query.location as Location) || undefined,
        is_processed: req.query.is_processed !== undefined ? parseInt(String(req.query.is_processed)) : undefined,
      })
      return res.json({ success: true, data: logs })
    }

    if (req.method === 'POST') {
      if (!can(session.user, 'manage_hours')) return res.status(403).json({ success: false })
      const { employee_id, employee_name, log_date, location, clock_in, clock_out, break_minutes, overtime_hours, note } = req.body
      const log = await logHours({
        employee_id, employee_name, log_date,
        location:       location      ?? 'markt',
        clock_in:       clock_in      ?? null,
        clock_out:      clock_out     ?? null,
        break_minutes:  break_minutes ?? 0,
        overtime_hours: overtime_hours ?? 0,
        shift_id:       null,
        note:           note          ?? null,
        is_processed:   0,
        processed_at:   null,
        created_by:     session.user.user_id,
      }, session.user.user_id)
      return res.status(201).json({ success: true, data: log })
    }

    res.status(405).json({ success: false })
  } catch (err: any) {
    console.error('[/api/hours]', err)
    res.status(500).json({ success: false, message: err?.message ?? 'Server error' })
  }
}

