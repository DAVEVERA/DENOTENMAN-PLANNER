import type { NextApiRequest, NextApiResponse } from 'next'
import { getSession, can } from '@/lib/auth'
import { getOpenShifts, saveShift } from '@/lib/scheduler'
import { sendPushToAll } from '@/lib/push'
import type { Location } from '@/types'

const DAY_NL: Record<string, string> = {
  maandag: 'Maandag', dinsdag: 'Dinsdag', woensdag: 'Woensdag',
  donderdag: 'Donderdag', vrijdag: 'Vrijdag', zaterdag: 'Zaterdag', zondag: 'Zondag',
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getSession(req, res)
  if (!session.user) return res.status(401).json({ success: false })

  if (req.method === 'GET') {
    if (!can(session.user, 'read')) return res.status(403).json({ success: false })
    try {
      const location = req.query.location as Location | undefined
      const shifts = await getOpenShifts(location)
      return res.json({ success: true, data: shifts })
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error('[shifts/open GET]', msg)
      return res.status(500).json({ success: false, message: msg })
    }
  }

  if (req.method === 'POST') {
    if (!can(session.user, 'manage_shifts')) return res.status(403).json({ success: false })
    const result = await saveShift({ ...req.body, is_open: 1, employee_id: null }, session.user.user_id)
    if ('error' in result) return res.status(400).json({ success: false, message: result.error })

    // Notify all employees
    try {
      const body = req.body
      const day  = DAY_NL[body.day_of_week] ?? body.day_of_week
      await sendPushToAll({
        title: '📢 Nieuwe open dienst!',
        body:  `Een ${body.shift_type}-dienst op ${day} (week ${body.week_number}) is beschikbaar. Klik om te claimen!`,
        url:   '/me/open-shifts',
      })
    } catch { /* push is optional */ }

    return res.status(201).json({ success: true, data: result })
  }

  res.status(405).json({ success: false })
}
