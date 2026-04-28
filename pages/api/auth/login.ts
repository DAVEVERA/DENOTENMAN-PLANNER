import type { NextApiRequest, NextApiResponse } from 'next'
import { attemptLogin, ensureDefaultAdmin } from '@/lib/auth'

// ─── In-memory brute-force protection ────────────────────────────────────────
// Tracks failed login attempts per IP. Resets after WINDOW_MS.
const failMap = new Map<string, { count: number; resetAt: number }>()
const MAX_ATTEMPTS = 5
const WINDOW_MS    = 15 * 60 * 1000 // 15 minutes
const MIN_DELAY_MS = 300              // Minimum response time to thwart timing attacks

function getClientIp(req: NextApiRequest): string {
  const forwarded = req.headers['x-forwarded-for']
  if (typeof forwarded === 'string') return forwarded.split(',')[0].trim()
  return req.socket?.remoteAddress ?? 'unknown'
}

function isRateLimited(ip: string): boolean {
  const now  = Date.now()
  const entry = failMap.get(ip)
  if (!entry || now > entry.resetAt) return false
  return entry.count >= MAX_ATTEMPTS
}

function recordFailure(ip: string): void {
  const now   = Date.now()
  const entry = failMap.get(ip)
  if (!entry || now > entry.resetAt) {
    failMap.set(ip, { count: 1, resetAt: now + WINDOW_MS })
  } else {
    entry.count++
  }
}

function clearFailure(ip: string): void {
  failMap.delete(ip)
}

// ─── Handler ──────────────────────────────────────────────────────────────────

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ success: false })

  const start = Date.now()

  const ip = getClientIp(req)
  if (isRateLimited(ip)) {
    await ensureDelay(start)
    return res.status(429).json({
      success: false,
      message: 'Te veel pogingen. Probeer het over 15 minuten opnieuw.',
    })
  }

  // Input validation
  const rawUsername = req.body?.username
  const rawPassword = req.body?.password
  if (!rawUsername || !rawPassword) {
    await ensureDelay(start)
    return res.status(400).json({ success: false, message: 'Gebruikersnaam en wachtwoord vereist' })
  }

  const username = String(rawUsername).trim().slice(0, 80)
  const password = String(rawPassword).slice(0, 128)

  if (!username || !password) {
    await ensureDelay(start)
    return res.status(400).json({ success: false, message: 'Gebruikersnaam en wachtwoord vereist' })
  }

  await ensureDefaultAdmin()

  const ok = await attemptLogin(req, res, username, password)

  await ensureDelay(start)

  if (!ok) {
    recordFailure(ip)
    return res.status(401).json({ success: false, message: 'Onjuiste inloggegevens' })
  }

  clearFailure(ip)
  return res.json({ success: true })
}

/** Ensures the response takes at least MIN_DELAY_MS to thwart timing attacks. */
async function ensureDelay(startMs: number): Promise<void> {
  const elapsed = Date.now() - startMs
  if (elapsed < MIN_DELAY_MS) {
    await new Promise(r => setTimeout(r, MIN_DELAY_MS - elapsed))
  }
}
