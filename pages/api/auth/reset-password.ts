import type { NextApiRequest, NextApiResponse } from 'next'
import { resetPasswordWithToken } from '@/lib/auth'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ success: false })

  const token = typeof req.body?.token === 'string' ? req.body.token : ''
  const password = typeof req.body?.password === 'string' ? req.body.password : ''

  if (!token) {
    return res.status(400).json({ success: false, message: 'Herstel-link ontbreekt.' })
  }
  if (password.length < 8) {
    return res.status(400).json({ success: false, message: 'Kies een wachtwoord van minimaal 8 tekens.' })
  }
  if (password.length > 128) {
    return res.status(400).json({ success: false, message: 'Wachtwoord is te lang.' })
  }

  try {
    const ok = await resetPasswordWithToken(token, password)
    if (!ok) {
      return res.status(400).json({
        success: false,
        message: 'Deze herstel-link is ongeldig of verlopen. Vraag een nieuwe link aan.',
      })
    }
    return res.json({ success: true })
  } catch (err) {
    console.error('[/api/auth/reset-password]', err)
    return res.status(500).json({ success: false, message: 'Wachtwoord herstellen is mislukt.' })
  }
}
