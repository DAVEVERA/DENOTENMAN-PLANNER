import type { NextApiRequest, NextApiResponse } from 'next'
import { getSession } from '@/lib/auth'
import { listDocuments, uploadDocument } from '@/lib/documents'
import type { DocType } from '@/types'

// Grotere body-limit voor base64-gecodeerde bestanden (max 10MB → ~13.3MB base64)
export const config = { api: { bodyParser: { sizeLimit: '14mb' } } }

const ALLOWED_MIME: string[] = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
]
const ALLOWED_DOC_TYPES: DocType[] = ['legitimatie', 'arbeidsovereenkomst', 'overig']

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getSession(req, res)
  if (!session.user) return res.status(401).json({ success: false })

  const { employee_id, user_id } = session.user
  if (!employee_id) return res.status(403).json({ success: false, message: 'Geen medewerker gekoppeld' })

  // ── GET: lijst met documenten ──────────────────────────────────────────────
  if (req.method === 'GET') {
    try {
      const docs = await listDocuments(employee_id)
      return res.json({ success: true, data: docs })
    } catch (err: unknown) {
      return res.status(500).json({ success: false, message: String(err) })
    }
  }

  // ── POST: upload nieuw document ────────────────────────────────────────────
  if (req.method === 'POST') {
    try {
      const { doc_type, filename, mime_type, base64, notes } = req.body as {
        doc_type:  string
        filename:  string
        mime_type: string
        base64:    string
        notes?:    string
      }

      // Validatie
      if (!ALLOWED_DOC_TYPES.includes(doc_type as DocType)) {
        return res.status(400).json({ success: false, message: 'Ongeldig documenttype' })
      }
      if (!ALLOWED_MIME.includes(mime_type)) {
        return res.status(400).json({ success: false, message: 'Bestandstype niet toegestaan. Gebruik PDF, JPEG of PNG.' })
      }
      if (!filename || !base64) {
        return res.status(400).json({ success: false, message: 'Bestandsnaam en inhoud zijn verplicht' })
      }

      const buffer = Buffer.from(base64, 'base64')

      if (buffer.byteLength > 10 * 1024 * 1024) {
        return res.status(400).json({ success: false, message: 'Bestand mag maximaal 10 MB zijn' })
      }

      const doc = await uploadDocument({
        employee_id,
        doc_type: doc_type as DocType,
        filename,
        mime_type,
        buffer,
        uploaded_by: user_id,
        notes,
      })

      return res.status(201).json({ success: true, data: doc })
    } catch (err: unknown) {
      return res.status(500).json({ success: false, message: String(err) })
    }
  }

  res.status(405).json({ success: false })
}
