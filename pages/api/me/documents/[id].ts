import type { NextApiRequest, NextApiResponse } from 'next'
import { getSession } from '@/lib/auth'
import { deleteDocument, getDownloadUrl } from '@/lib/documents'
import { hasSameOrigin } from '@/lib/request-security'

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
      console.error('[/api/me/documents/:id GET]', err)
      return res.status(404).json({ success: false, message: 'Document niet gevonden of niet beschikbaar' })
    }
  }

  // ── DELETE: verwijder document ─────────────────────────────────────────────
  if (req.method === 'DELETE') {
    if (!hasSameOrigin(req)) return res.status(403).json({ success: false })
    try {
      await deleteDocument(id, employee_id, session.user.user_id)
      return res.json({ success: true })
    } catch (err: unknown) {
      console.error('[/api/me/documents/:id DELETE]', err)
      return res.status(500).json({ success: false, message: 'Document kon niet veilig worden gearchiveerd' })
    }
  }

  res.status(405).json({ success: false })
}
