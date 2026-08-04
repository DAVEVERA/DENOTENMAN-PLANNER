import type { NextApiRequest } from 'next'

/** Reject cross-site state changes even when a browser happens to attach cookies. */
export function hasSameOrigin(req: NextApiRequest): boolean {
  const origin = req.headers.origin
  const host = req.headers.host
  if (!origin || !host) return false
  const protocol = String(req.headers['x-forwarded-proto'] ?? (process.env.NODE_ENV === 'production' ? 'https' : 'http'))
    .split(',')[0].trim()
  try {
    return new URL(origin).origin === `${protocol}://${host}`
  } catch {
    return false
  }
}

export function getClientIp(req: NextApiRequest): string {
  const forwarded = req.headers['x-forwarded-for']
  if (typeof forwarded === 'string') return forwarded.split(',')[0].trim().slice(0, 64)
  return (req.socket.remoteAddress ?? 'unknown').slice(0, 64)
}
