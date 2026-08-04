import type { NextApiRequest, NextApiResponse } from 'next'
import { getSession } from '@/lib/auth'
import { requestDocumentView } from '@/lib/inspection'
import { hasSameOrigin } from '@/lib/request-security'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ success: false })
  if (!hasSameOrigin(req)) return res.status(403).json({ success: false, message: 'Ongeldige aanvraag' })
  const session = await getSession(req, res)
  if (!session.user) return res.status(401).json({ success: false, message: 'Inspectiesessie verlopen' })
  if (session.user.role !== 'inspector') return res.status(403).json({ success: false })
  const documentId = Number(req.query.id)
  if (!Number.isSafeInteger(documentId) || documentId <= 0) {
    return res.status(400).json({ success: false, message: 'Ongeldig document' })
  }

  try {
    const result = await requestDocumentView(session, documentId)
    if (result.status === 'allowed') return res.status(201).json({ success: true, data: result })
    if (result.status === 'integrity_required') return res.status(403).json({ success: false, status: result.status })
    if (result.status === 'cooldown' || result.status === 'locked') {
      return res.status(429).json({ success: false, data: result })
    }
    return res.status(403).json({ success: false, status: 'denied' })
  } catch (error) {
    console.error('[/api/inspectie/documenten/:id]', error)
    return res.status(500).json({ success: false, message: 'De inzage kon niet veilig worden gestart' })
  }
}
