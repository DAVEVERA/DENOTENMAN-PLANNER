import type { NextApiRequest, NextApiResponse } from 'next'
import { attemptLogin, ensureDefaultAdmin } from '@/lib/auth'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ success: false })
  await ensureDefaultAdmin()
  const { username, password } = req.body
  if (!username || !password)
    return res.status(400).json({ success: false, message: 'Gebruikersnaam en wachtwoord vereist' })
  const ok = await attemptLogin(req, res, String(username), String(password))
  if (!ok) return res.status(401).json({ success: false, message: 'Onjuiste inloggegevens' })
  res.json({ success: true })
}
