import type { NextApiRequest, NextApiResponse } from 'next'
import { getSession } from '@/lib/auth'
import { savePushSubscription } from '@/lib/push'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getSession(req, res)
  if (!session.user) return res.status(401).json({ success: false })

  if (req.method === 'GET') {
    const publicKey = process.env.VAPID_PUBLIC_KEY
    if (!publicKey) return res.status(503).json({ success: false, message: 'Pushmeldingen zijn niet geconfigureerd' })
    return res.json({ success: true, publicKey })
  }

  if (req.method !== 'POST') return res.status(405).json({ success: false })

  const { subscription } = req.body
  if (!subscription?.endpoint) return res.status(400).json({ success: false })

  await savePushSubscription(
    session.user,
    subscription,
    req.headers['user-agent'] ?? undefined,
  )

  return res.json({ success: true })
}
