import type { NextApiRequest, NextApiResponse } from 'next'
import { getSession, can } from '@/lib/auth'
import { listDocuments, deleteDocument, setDocumentInspectionRelease } from '@/lib/documents'
import { hasSameOrigin } from '@/lib/request-security'

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
      console.error('[/api/admin/employees/:id/documents GET]', err)
      return res.status(500).json({ success: false, message: 'Documenten konden niet veilig worden geladen' })
    }
  }

  // ── PATCH: expliciete inspectievrijgave beheren ───────────────────────────
  if (req.method === 'PATCH') {
    if (!hasSameOrigin(req)) return res.status(403).json({ success: false })
    const docId = parseInt(String(req.query.docId))
    const inspectionReleased = req.body?.inspectionReleased
    if (!docId || typeof inspectionReleased !== 'boolean') {
      return res.status(400).json({ success: false, message: 'Ongeldige inspectievrijgave' })
    }
    try {
      await setDocumentInspectionRelease(docId, empId, inspectionReleased, session.user.user_id)
      return res.json({ success: true })
    } catch (err: unknown) {
      console.error('[/api/admin/employees/:id/documents PATCH]', err)
      return res.status(500).json({ success: false, message: 'Inspectievrijgave kon niet veilig worden bijgewerkt' })
    }
  }

  // ── DELETE: verwijder een document als admin ───────────────────────────────
  if (req.method === 'DELETE') {
    if (!hasSameOrigin(req)) return res.status(403).json({ success: false })
    const docId = parseInt(String(req.query.docId))
    if (!docId) return res.status(400).json({ success: false })
    try {
      await deleteDocument(docId, empId, session.user.user_id)
      return res.json({ success: true })
    } catch (err: unknown) {
      console.error('[/api/admin/employees/:id/documents DELETE]', err)
      return res.status(500).json({ success: false, message: 'Document kon niet veilig worden gearchiveerd' })
    }
  }

  res.status(405).json({ success: false })
}
