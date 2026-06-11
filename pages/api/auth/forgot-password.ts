import type { NextApiRequest, NextApiResponse } from 'next'
import { requestPasswordReset } from '@/lib/auth'

const requestMap = new Map<string, { count: number; resetAt: number }>()
const MAX_ATTEMPTS = 5
const WINDOW_MS = 15 * 60 * 1000

function getClientIp(req: NextApiRequest): string {
  const forwarded = req.headers['x-forwarded-for']
  if (typeof forwarded === 'string') return forwarded.split(',')[0].trim()
  return req.socket?.remoteAddress ?? 'unknown'
}

function isRateLimited(key: string): boolean {
  const now = Date.now()
  const entry = requestMap.get(key)
  if (!entry || now > entry.resetAt) return false
  return entry.count >= MAX_ATTEMPTS
}

function recordAttempt(key: string): void {
  const now = Date.now()
  const entry = requestMap.get(key)
  if (!entry || now > entry.resetAt) {
    requestMap.set(key, { count: 1, resetAt: now + WINDOW_MS })
  } else {
    entry.count++
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ success: false })

  const ip = getClientIp(req)
  if (isRateLimited(ip)) {
    return res.status(429).json({
      success: false,
      message: 'Te veel aanvragen. Probeer het over 15 minuten opnieuw.',
    })
  }
  recordAttempt(ip)

  const rawUsername = req.body?.username
  const username = typeof rawUsername === 'string' ? rawUsername.trim().slice(0, 120) : ''
  if (!username) {
    return res.status(400).json({ success: false, message: 'Vul je gebruikersnaam of e-mailadres in.' })
  }

  try {
    await requestPasswordReset(username)
    return res.json({
      success: true,
      message: 'Als dit account bestaat, ontvang je een e-mail met een herstel-link.',
    })
  } catch (err) {
    console.error('[/api/auth/forgot-password]', err)
    return res.status(500).json({
      success: false,
      message: 'Herstelmail versturen is mislukt. Neem contact op met de beheerder.',
    })
  }
}
