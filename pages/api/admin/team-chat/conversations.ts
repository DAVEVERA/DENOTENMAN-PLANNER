import type { NextApiRequest, NextApiResponse } from 'next'

import { getSession } from '../../../../lib/auth'
import { listTeamChatAdminData, manageTeamConversation } from '../../../../lib/team-chat/admin'
import { sendTeamChatError, setTeamChatNoStore } from '../../../../lib/team-chat/api'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  setTeamChatNoStore(res)
  try {
    const session = await getSession(req, res)
    if (!session.user) return res.status(401).json({ success: false, code: 'UNAUTHENTICATED' })
    if (req.method === 'GET') return res.status(200).json({ success: true, data: await listTeamChatAdminData(session.user) })
    if (req.method === 'POST' || req.method === 'PATCH') {
      return res.status(req.method === 'POST' ? 201 : 200).json({ success: true, data: await manageTeamConversation(session.user, req.body) })
    }
    res.setHeader('Allow', 'GET, POST, PATCH')
    return res.status(405).json({ success: false, code: 'METHOD_NOT_ALLOWED' })
  } catch (error) {
    return sendTeamChatError(error, res, 'admin/team-chat/conversations', 'TEAM_CHAT_MANAGEMENT_FAILED')
  }
}
