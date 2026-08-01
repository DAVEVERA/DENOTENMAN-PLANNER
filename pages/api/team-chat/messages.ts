import type { NextApiRequest, NextApiResponse } from 'next'

import { getSession } from '../../../lib/auth'
import { positiveInteger, sendTeamChatError, setTeamChatNoStore } from '../../../lib/team-chat/api'
import { createMessage, listMessages, type TeamMessage } from '../../../lib/team-chat/repository'
import type { SessionUser } from '../../../types'
import type { CreateMessageInput } from '../../../types/team-chat'

type MessagesResponse = { success: true; data: TeamMessage | TeamMessage[] } | { success: false; code: string }

interface MessagesDependencies {
  getSession(req: NextApiRequest, res: NextApiResponse): Promise<{ user?: SessionUser }>
  listMessages(input: { conversationId: number; userId: string; afterId?: number; beforeId?: number }): Promise<TeamMessage[]>
  createMessage(user: SessionUser, input: CreateMessageInput): Promise<TeamMessage>
}

export function createMessagesHandler(dependencies: MessagesDependencies) {
  return async function messagesHandler(req: NextApiRequest, res: NextApiResponse<MessagesResponse>): Promise<void> {
    setTeamChatNoStore(res)
    try {
      const session = await dependencies.getSession(req, res)
      if (!session.user) {
        res.status(401).json({ success: false, code: 'UNAUTHENTICATED' })
        return
      }

      if (req.method === 'GET') {
        const conversationId = positiveInteger(req.query.conversation_id)
        const afterId = req.query.after_id === undefined ? undefined : positiveInteger(req.query.after_id)
        const beforeId = req.query.before_id === undefined ? undefined : positiveInteger(req.query.before_id)
        if (!conversationId || (req.query.after_id !== undefined && !afterId)
          || (req.query.before_id !== undefined && !beforeId) || (afterId && beforeId)) {
          res.status(400).json({ success: false, code: 'INVALID_MESSAGE_QUERY' })
          return
        }
        const data = await dependencies.listMessages({
          conversationId,
          userId: session.user.user_id,
          ...(afterId ? { afterId } : {}),
          ...(beforeId ? { beforeId } : {}),
        })
        res.status(200).json({ success: true, data })
        return
      }

      if (req.method === 'POST') {
        const data = await dependencies.createMessage(session.user, req.body as CreateMessageInput)
        res.status(201).json({ success: true, data })
        return
      }

      res.setHeader('Allow', 'GET, POST')
      res.status(405).json({ success: false, code: 'METHOD_NOT_ALLOWED' })
    } catch (error) {
      sendTeamChatError(error, res, 'messages', 'TEAM_CHAT_MESSAGES_FAILED')
    }
  }
}

export default createMessagesHandler({ getSession, listMessages, createMessage })
