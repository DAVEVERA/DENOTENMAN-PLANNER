import type { NextApiRequest, NextApiResponse } from 'next'
import { getRawSession } from '@/lib/auth'
import { hasSameOrigin } from '@/lib/request-security'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ success: false })
  if (!hasSameOrigin(req)) return res.status(403).json({ success: false })
  const session = await getRawSession(req, res)
  if (!session.user || session.user.role !== 'inspector' || !session.inspection_admin_return) {
    session.destroy()
    return res.status(401).json({ success: false, message: 'Voorbeeldsessie niet gevonden; u bent afgemeld' })
  }
  session.user = session.inspection_admin_return
  session.csrf = session.inspection_admin_csrf
  delete session.inspection_admin_return
  delete session.inspection_admin_csrf
  delete session.inspection_expires_at
  delete session.inspection_service_number_hash
  delete session.inspection_service_number_suffix
  delete session.inspection_integrity_accepted_at
  await session.save()
  return res.json({ success: true })
}
