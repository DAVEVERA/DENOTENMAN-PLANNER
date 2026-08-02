import type { NextApiRequest, NextApiResponse } from 'next'
import { getSession } from '@/lib/auth'
import { savePushSubscription } from '@/lib/push'
import { getPublicPushConfiguration } from '@/lib/push-config'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getSession(req, res)
  if (!session.user) return res.status(401).json({ success: false })

  const pushConfiguration = getPublicPushConfiguration(
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY,
  )

  if (req.method === 'GET') {
    return res.status(200).json({ success: true, ...pushConfiguration })
  }

  if (req.method !== 'POST') return res.status(405).json({ success: false })

  if (!pushConfiguration.configured) {
    return res.status(200).json({ success: true, configured: false })
  }

  const { subscription } = req.body
  if (!subscription?.endpoint) return res.status(400).json({ success: false })

  await savePushSubscription(
    session.user,
    subscription,
    req.headers['user-agent'] ?? undefined,
  )

  return res.json({ success: true, configured: true })
}
