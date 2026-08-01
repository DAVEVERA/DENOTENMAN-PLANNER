import type { NextApiRequest, NextApiResponse } from 'next'

import { getSession } from '../../../lib/auth'
import { positiveInteger, sendTeamChatError, setTeamChatNoStore } from '../../../lib/team-chat/api'
import { toggleReaction, type TeamReactionState } from '../../../lib/team-chat/repository'
import type { SessionUser } from '../../../types'

type ReactionResponse = { success: true; data: TeamReactionState } | { success: false; code: string }

interface ReactionDependencies {
  getSession(req: NextApiRequest, res: NextApiResponse): Promise<{ user?: SessionUser }>
  toggleReaction(user: SessionUser, messageId: number, emoji: unknown): Promise<TeamReactionState>
}

export function createReactionHandler(dependencies: ReactionDependencies) {
  return async function reactionHandler(req: NextApiRequest, res: NextApiResponse<ReactionResponse>): Promise<void> {
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
      const messageId = positiveInteger(req.body?.message_id)
      if (!messageId) {
        res.status(400).json({ success: false, code: 'INVALID_MESSAGE_ID' })
        return
      }
      const data = await dependencies.toggleReaction(session.user, messageId, req.body?.emoji)
      res.status(200).json({ success: true, data })
    } catch (error) {
      sendTeamChatError(error, res, 'reactions', 'TEAM_CHAT_REACTION_FAILED')
    }
  }
}

export default createReactionHandler({ getSession, toggleReaction })
