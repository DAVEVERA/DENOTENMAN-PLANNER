import type { NextApiRequest, NextApiResponse } from 'next'

import { getSession } from '../../../../lib/auth'
import { setTeamChatManager } from '../../../../lib/team-chat/admin'
import { sendTeamChatError, setTeamChatNoStore } from '../../../../lib/team-chat/api'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  setTeamChatNoStore(res)
  try {
    const session = await getSession(req, res)
    if (!session.user) return res.status(401).json({ success: false, code: 'UNAUTHENTICATED' })
    if (req.method !== 'POST') {
      res.setHeader('Allow', 'POST')
      return res.status(405).json({ success: false, code: 'METHOD_NOT_ALLOWED' })
    }
    await setTeamChatManager(session.user, req.body?.user_id, req.body?.active)
    return res.status(200).json({ success: true })
  } catch (error) {
    return sendTeamChatError(error, res, 'admin/team-chat/owners', 'TEAM_CHAT_OWNER_FAILED')
  }
}
