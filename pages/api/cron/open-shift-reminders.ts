import type { NextApiRequest, NextApiResponse } from 'next'
import { processOpenShiftReminders } from '@/lib/open-shift-reminders'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ success: false })

  const cronSecret = process.env.CRON_SECRET
  const authorized = Boolean(
    cronSecret && req.headers.authorization === `Bearer ${cronSecret}`,
  )
  if (!authorized) return res.status(401).json({ success: false, message: 'Niet geautoriseerd' })

  try {
    const result = await processOpenShiftReminders()
    return res.json({ success: true, ...result })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error('[cron/open-shift-reminders]', message)
    return res.status(500).json({ success: false, message })
  }
}
