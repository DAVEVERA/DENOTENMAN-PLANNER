import type { NextApiRequest, NextApiResponse } from 'next'
import { getSession, can } from '@/lib/auth'
import { listDocuments, deleteDocument } from '@/lib/documents'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getSession(req, res)
  if (!session.user) return res.status(401).json({ success: false })
  if (!can(session.user, 'manage_employees')) return res.status(403).json({ success: false })

  const empId = parseInt(String(req.query.empId))
  if (!empId) return res.status(400).json({ success: false })

  // ── GET: documenten van een medewerker bekijken als admin ─────────────────
  if (req.method === 'GET') {
    try {
      const docs = await listDocuments(empId)
      return res.json({ success: true, data: docs })
    } catch (err: unknown) {
      return res.status(500).json({ success: false, message: String(err) })
    }
  }

  // ── DELETE: verwijder een document als admin ───────────────────────────────
  if (req.method === 'DELETE') {
    const docId = parseInt(String(req.query.docId))
    if (!docId) return res.status(400).json({ success: false })
    try {
      await deleteDocument(docId, empId)
      return res.json({ success: true })
    } catch (err: unknown) {
      return res.status(500).json({ success: false, message: String(err) })
    }
  }

  res.status(405).json({ success: false })
}
