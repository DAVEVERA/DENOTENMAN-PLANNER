import type { NextApiRequest, NextApiResponse } from 'next'
import { getSession } from '@/lib/auth'
import { savePushSubscription } from '@/lib/push'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ success: false })

  const session = await getSession(req, res)
  if (!session.user) return res.status(401).json({ success: false })
  if (!session.user.employee_id) return res.status(400).json({ success: false, message: 'Geen medewerker gekoppeld' })

  const { subscription } = req.body
  if (!subscription?.endpoint) return res.status(400).json({ success: false })

  await savePushSubscription(
    session.user.employee_id,
    subscription,
    req.headers['user-agent'] ?? undefined,
  )

  return res.json({ success: true })
}
