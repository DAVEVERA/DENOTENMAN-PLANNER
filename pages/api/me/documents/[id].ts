import type { NextApiRequest, NextApiResponse } from 'next'
import { getSession } from '@/lib/auth'
import { deleteDocument, getDownloadUrl } from '@/lib/documents'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getSession(req, res)
  if (!session.user) return res.status(401).json({ success: false })

  const { employee_id } = session.user
  if (!employee_id) return res.status(403).json({ success: false, message: 'Geen medewerker gekoppeld' })

  const id = parseInt(String(req.query.id))
  if (!id) return res.status(400).json({ success: false })

  // ── GET: haal signed download URL op ──────────────────────────────────────
  if (req.method === 'GET') {
    try {
      const url = await getDownloadUrl(id, employee_id)
      return res.json({ success: true, data: { url } })
    } catch (err: unknown) {
      return res.status(404).json({ success: false, message: String(err) })
    }
  }

  // ── DELETE: verwijder document ─────────────────────────────────────────────
  if (req.method === 'DELETE') {
    try {
      await deleteDocument(id, employee_id)
      return res.json({ success: true })
    } catch (err: unknown) {
      return res.status(500).json({ success: false, message: String(err) })
    }
  }

  res.status(405).json({ success: false })
}
