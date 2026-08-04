import type { NextApiRequest, NextApiResponse } from 'next'
import { attemptLogin } from '@/lib/auth'
import { getClientIp, hasSameOrigin } from '@/lib/request-security'
import {
  hashInspectionValue,
  isInspectionLoginRateLimited,
  recordInspectionLoginAttempt,
} from '@/lib/inspection'

const MIN_DELAY_MS = 400

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const started = Date.now()
  try {
    if (req.method !== 'POST') return res.status(405).json({ success: false })
    if (!hasSameOrigin(req)) return res.status(403).json({ success: false, message: 'Ongeldige aanvraag' })

    const username = typeof req.body?.username === 'string' ? req.body.username.trim().toLocaleLowerCase('nl-BE').slice(0, 80) : ''
    const password = typeof req.body?.password === 'string' ? req.body.password.slice(0, 128) : ''
    if (!username || !password) {
      await delay(started)
      return res.status(400).json({ success: false, message: 'Gebruikersnaam en wachtwoord zijn verplicht' })
    }

    const attemptKey = hashInspectionValue(`${getClientIp(req)}:${username.toLocaleLowerCase('nl-BE')}`)
    if (await isInspectionLoginRateLimited(attemptKey)) {
      await delay(started)
      return res.status(429).json({ success: false, message: 'Te veel aanmeldpogingen. Probeer het over 15 minuten opnieuw.' })
    }

    const ok = await attemptLogin(req, res, username, password, 'inspector')
    await recordInspectionLoginAttempt(attemptKey, ok)
    await delay(started)
    if (!ok) return res.status(401).json({ success: false, message: 'Aanmelden is niet gelukt. Controleer uw gegevens.' })
    return res.json({ success: true })
  } catch (error) {
    console.error('[/api/inspectie/login]', error)
    await delay(started)
    return res.status(500).json({ success: false, message: 'Veilig aanmelden is tijdelijk niet mogelijk.' })
  }
}

async function delay(started: number) {
  const remaining = MIN_DELAY_MS - (Date.now() - started)
  if (remaining > 0) await new Promise(resolve => setTimeout(resolve, remaining))
}
