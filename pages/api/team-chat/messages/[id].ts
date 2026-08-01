import type { NextApiRequest, NextApiResponse } from 'next'

import { getSession } from '../../../../lib/auth'
import { positiveInteger, sendTeamChatError, setTeamChatNoStore } from '../../../../lib/team-chat/api'
import { editMessage, type TeamMessage } from '../../../../lib/team-chat/repository'
import type { SessionUser } from '../../../../types'

type MessageResponse = { success: true; data: TeamMessage } | { success: false; code: string }

interface MessageDependencies {
  getSession(req: NextApiRequest, res: NextApiResponse): Promise<{ user?: SessionUser }>
  editMessage(user: SessionUser, messageId: number, body: string): Promise<TeamMessage>
}

export function createMessageHandler(dependencies: MessageDependencies) {
  return async function messageHandler(req: NextApiRequest, res: NextApiResponse<MessageResponse>): Promise<void> {
    setTeamChatNoStore(res)
    try {
      const session = await dependencies.getSession(req, res)
      if (!session.user) {
        res.status(401).json({ success: false, code: 'UNAUTHENTICATED' })
        return
      }
      if (req.method !== 'PATCH') {
        res.setHeader('Allow', 'PATCH')
        res.status(405).json({ success: false, code: 'METHOD_NOT_ALLOWED' })
        return
      }

      const messageId = positiveInteger(req.query.id)
      const body = req.body?.body
      if (!messageId || typeof body !== 'string') {
        res.status(400).json({ success: false, code: 'INVALID_MESSAGE_CONTENT' })
        return
      }
      const data = await dependencies.editMessage(session.user, messageId, body)
      res.status(200).json({ success: true, data })
    } catch (error) {
      sendTeamChatError(error, res, 'messages/edit', 'TEAM_CHAT_MESSAGE_EDIT_FAILED')
    }
  }
}

export default createMessageHandler({ getSession, editMessage })
