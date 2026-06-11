import type { NextApiRequest, NextApiResponse } from 'next'
import { changeOwnPassword, getSession } from '@/lib/auth'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ success: false })

  const session = await getSession(req, res)
  if (!session.user) return res.status(401).json({ success: false, message: 'Niet ingelogd.' })

  const currentPassword = typeof req.body?.currentPassword === 'string' ? req.body.currentPassword : ''
  const newPassword = typeof req.body?.newPassword === 'string' ? req.body.newPassword : ''

  if (!currentPassword) {
    return res.status(400).json({ success: false, message: 'Vul je huidige wachtwoord in.' })
  }
  if (newPassword.length < 8) {
    return res.status(400).json({ success: false, message: 'Kies een wachtwoord van minimaal 8 tekens.' })
  }
  if (newPassword.length > 128) {
    return res.status(400).json({ success: false, message: 'Wachtwoord is te lang.' })
  }

  try {
    const ok = await changeOwnPassword(session.user.user_id, currentPassword, newPassword)
    if (!ok) {
      return res.status(400).json({ success: false, message: 'Huidig wachtwoord klopt niet.' })
    }
    return res.json({ success: true })
  } catch (err) {
    console.error('[/api/auth/change-password]', err)
    return res.status(500).json({ success: false, message: 'Wachtwoord wijzigen is mislukt.' })
  }
}
