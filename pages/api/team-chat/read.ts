import type { NextApiRequest, NextApiResponse } from 'next'

import { getSession } from '../../../lib/auth'
import { positiveInteger, sendTeamChatError, setTeamChatNoStore } from '../../../lib/team-chat/api'
import { markConversationRead, type TeamReadState } from '../../../lib/team-chat/repository'
import type { SessionUser } from '../../../types'

type ReadResponse = { success: true; data: TeamReadState } | { success: false; code: string }

interface ReadDependencies {
  getSession(req: NextApiRequest, res: NextApiResponse): Promise<{ user?: SessionUser }>
  markConversationRead(user: SessionUser, conversationId: number, messageId: number): Promise<TeamReadState>
}

export function createReadHandler(dependencies: ReadDependencies) {
  return async function readHandler(req: NextApiRequest, res: NextApiResponse<ReadResponse>): Promise<void> {
    setTeamChatNoStore(res)
    try {
      const session = await dependencies.getSession(req, res)
      if (!session.user) {
        res.status(401).json({ success: false, code: 'UNAUTHENTICATED' })
        return
      }
      if (req.method !== 'POST') {
        res.setHeader('Allow', 'POST')
        res.status(405).json({ success: false, code: 'METHOD_NOT_ALLOWED' })
        return
      }
      const conversationId = positiveInteger(req.body?.conversation_id)
      const messageId = positiveInteger(req.body?.message_id)
      if (!conversationId || !messageId) {
        res.status(400).json({ success: false, code: 'INVALID_READ_STATE' })
        return
      }
      const data = await dependencies.markConversationRead(session.user, conversationId, messageId)
      res.status(200).json({ success: true, data })
    } catch (error) {
      sendTeamChatError(error, res, 'read', 'TEAM_CHAT_READ_FAILED')
    }
  }
}

export default createReadHandler({ getSession, markConversationRead })
