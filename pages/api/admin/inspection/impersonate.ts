import crypto from 'crypto'
import type { NextApiRequest, NextApiResponse } from 'next'
import { getRawSession, getSession } from '@/lib/auth'
import { hasSameOrigin } from '@/lib/request-security'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ success: false })
  if (!hasSameOrigin(req)) return res.status(403).json({ success: false })
  const authorized = await getSession(req, res)
  if (!authorized.user || authorized.user.role !== 'admin' || authorized.inspection_admin_return) {
    return res.status(403).json({ success: false, message: 'Alleen een beheerder kan de voorbeeldsessie starten' })
  }
  const session = await getRawSession(req, res)
  if (!session.user && process.env.SKIP_AUTH === 'true' && process.env.NODE_ENV !== 'production') {
    session.user = authorized.user
    session.csrf = authorized.csrf
  }

  const admin = session.user
  if (!admin || admin.role !== 'admin') {
    return res.status(403).json({ success: false, message: 'Beheerderssessie kon niet veilig worden bevestigd' })
  }
  session.inspection_admin_return = admin
  session.inspection_admin_csrf = session.csrf
  session.user = {
    user_id: `inspection-preview:${admin.user_id}`,
    display_name: 'Voorbeeld inspectiedienst',
    role: 'inspector',
    employee_id: null,
    location: null,
  }
  session.csrf = crypto.randomBytes(32).toString('hex')
  session.inspection_expires_at = Date.now() + 30 * 60 * 1000
  delete session.inspection_service_number_hash
  delete session.inspection_service_number_suffix
  delete session.inspection_integrity_accepted_at
  await session.save()
  return res.json({ success: true })
}
