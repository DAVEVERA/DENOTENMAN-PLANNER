import type { NextApiRequest, NextApiResponse } from 'next'

import { getSession } from '../../../lib/auth'
import { sendTeamChatError, setTeamChatNoStore, singleString } from '../../../lib/team-chat/api'
import { searchTeamMessages, type TeamMessage } from '../../../lib/team-chat/repository'
import type { SessionUser } from '../../../types'

type SearchResponse = { success: true; data: TeamMessage[] } | { success: false; code: string }

interface SearchDependencies {
  getSession(req: NextApiRequest, res: NextApiResponse): Promise<{ user?: SessionUser }>
  searchTeamMessages(user: SessionUser, query: string): Promise<TeamMessage[]>
}

export function createSearchHandler(dependencies: SearchDependencies) {
  return async function searchHandler(req: NextApiRequest, res: NextApiResponse<SearchResponse>): Promise<void> {
    setTeamChatNoStore(res)
    try {
      const session = await dependencies.getSession(req, res)
      if (!session.user) {
        res.status(401).json({ success: false, code: 'UNAUTHENTICATED' })
        return
      }
      if (req.method !== 'GET') {
        res.setHeader('Allow', 'GET')
        res.status(405).json({ success: false, code: 'METHOD_NOT_ALLOWED' })
        return
      }
      const query = singleString(req.query.q)
      if (query === undefined) {
        res.status(400).json({ success: false, code: 'INVALID_SEARCH_QUERY' })
        return
      }
      const data = await dependencies.searchTeamMessages(session.user, query)
      res.status(200).json({ success: true, data })
    } catch (error) {
      sendTeamChatError(error, res, 'search', 'TEAM_CHAT_SEARCH_FAILED')
    }
  }
}

export default createSearchHandler({ getSession, searchTeamMessages })
