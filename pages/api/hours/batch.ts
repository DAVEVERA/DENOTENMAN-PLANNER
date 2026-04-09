import type { NextApiRequest, NextApiResponse } from 'next'
import { getSession, can } from '@/lib/auth'
import { markLogsProcessed } from '@/lib/hours'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getSession(req, res)
  if (!session.user) return res.status(401).json({ success: false })
  if (!can(session.user, 'manage_hours')) return res.status(403).json({ success: false })

  if (req.method === 'PATCH') {
    const { ids } = req.body
    if (!Array.isArray(ids) || !ids.length) return res.status(400).json({ success: false })
    await markLogsProcessed(ids.map(Number))
    return res.json({ success: true })
  }

  res.status(405).json({ success: false })
}
