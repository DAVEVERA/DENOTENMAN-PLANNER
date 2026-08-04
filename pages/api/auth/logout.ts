import type { NextApiRequest, NextApiResponse } from 'next'
import { getIronSession } from 'iron-session'
import { sessionOptions } from '@/lib/session'
import type { SessionUser } from '@/types'
import { hasSameOrigin } from '@/lib/request-security'
import type { PlannerSessionData } from '@/lib/session'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ success: false })
  if (!hasSameOrigin(req)) return res.status(403).json({ success: false })
  const session = await getIronSession<PlannerSessionData>(req, res, sessionOptions)
  session.destroy()
  res.json({ success: true })
}
