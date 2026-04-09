import type { NextApiRequest, NextApiResponse } from 'next'
import { getIronSession } from 'iron-session'
import { sessionOptions } from '@/lib/session'
import type { SessionUser } from '@/types'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getIronSession<{ user?: SessionUser; csrf?: string }>(req, res, sessionOptions)
  session.destroy()
  res.json({ success: true })
}
