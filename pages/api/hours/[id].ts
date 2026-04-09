import type { NextApiRequest, NextApiResponse } from 'next'
import { getSession, can } from '@/lib/auth'
import { updateTimeLog, deleteTimeLog, markLogsProcessed } from '@/lib/hours'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getSession(req, res)
  if (!session.user) return res.status(401).json({ success: false })
  if (!can(session.user, 'manage_hours')) return res.status(403).json({ success: false })

  const id = parseInt(String(req.query.id))

  if (req.method === 'PUT') {
    const log = await updateTimeLog(id, req.body)
    return res.json({ success: true, data: log })
  }

  if (req.method === 'DELETE') {
    await deleteTimeLog(id)
    return res.json({ success: true })
  }

  if (req.method === 'PATCH') {
    // Mark as processed
    await markLogsProcessed([id])
    return res.json({ success: true })
  }

  res.status(405).json({ success: false })
}
