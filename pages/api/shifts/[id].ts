import type { NextApiRequest, NextApiResponse } from 'next'
import { getSession, can } from '@/lib/auth'
import { getShift, saveShift, deleteShift, bulkUpdateShift } from '@/lib/scheduler'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getSession(req, res)
  if (!session.user) return res.status(401).json({ success: false, message: 'Niet ingelogd' })
  if (!can(session.user, 'manage_shifts'))
    return res.status(403).json({ success: false, message: 'Toegang geweigerd' })

  const id = parseInt(String(req.query.id))

  if (req.method === 'GET') {
    const shift = await getShift(id)
    if (!shift) return res.status(404).json({ success: false, message: 'Dienst niet gevonden' })
    return res.json({ success: true, data: shift })
  }

  if (req.method === 'PUT') {
    const result = await saveShift({ ...req.body, id })
    if ('error' in result) return res.status(400).json({ success: false, message: result.error })
    return res.json({ success: true, data: result })
  }

  if (req.method === 'PATCH') {
    const ok = await bulkUpdateShift(id, req.body)
    return res.json({ success: ok })
  }

  if (req.method === 'DELETE') {
    const ok = await deleteShift(id)
    return res.json({ success: true, data: { deleted: ok } })
  }

  res.status(405).json({ success: false })
}
