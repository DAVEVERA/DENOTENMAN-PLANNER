import type { NextApiRequest, NextApiResponse } from 'next'
import { getSession } from '@/lib/auth'
import { consumeDocumentView } from '@/lib/inspection'
import { hasSameOrigin } from '@/lib/request-security'

export const config = { api: { responseLimit: '12mb' } }

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end()
  if (!hasSameOrigin(req)) return res.status(403).end()
  const session = await getSession(req, res)
  if (!session.user || session.user.role !== 'inspector') return res.status(401).end()
  const token = typeof req.body?.token === 'string' ? req.body.token : ''
  if (!/^[A-Za-z0-9_-]{43}$/.test(token)) return res.status(400).end()

  try {
    const document = await consumeDocumentView(session, token)
    if (!document) return res.status(410).end()
    res.setHeader('Cache-Control', 'private, no-store, max-age=0')
    res.setHeader('Content-Type', document.mimeType)
    res.setHeader('Content-Disposition', 'inline')
    res.setHeader('X-Inspection-Expires-At', document.expiresAt)
    res.setHeader('Content-Security-Policy', "default-src 'none'; sandbox")
    res.setHeader('X-Content-Type-Options', 'nosniff')
    res.setHeader('Referrer-Policy', 'no-referrer')
    return res.status(200).send(document.buffer)
  } catch (error) {
    console.error('[/api/inspectie/documenten/inhoud]', error)
    return res.status(500).end()
  }
}
