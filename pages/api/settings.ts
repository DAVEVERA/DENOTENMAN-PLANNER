import type { NextApiRequest, NextApiResponse } from 'next'
import { getSession, can } from '@/lib/auth'
import { getSettings, saveSettings } from '@/lib/settings'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getSession(req, res)
  if (!session.user) return res.status(401).json({ success: false })

  if (req.method === 'GET') {
    if (!can(session.user, 'read')) return res.status(403).json({ success: false })
    return res.json({ success: true, data: getSettings() })
  }

  if (req.method === 'POST') {
    if (!can(session.user, 'manage_settings')) return res.status(403).json({ success: false })
    saveSettings(req.body)
    return res.json({ success: true })
  }

  res.status(405).json({ success: false })
}
