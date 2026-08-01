import type { NextApiRequest, NextApiResponse } from 'next'

import { getSession } from '../../../lib/auth'
import { sendTeamChatError, setTeamChatNoStore, singleString } from '../../../lib/team-chat/api'
import { searchGifs, type GifResult } from '../../../lib/team-chat/gifs'
import type { SessionUser } from '../../../types'

type GifsResponse = { success: true; data: GifResult[] } | { success: false; code: string }

interface GifsDependencies {
  getSession(req: NextApiRequest, res: NextApiResponse): Promise<{ user?: SessionUser }>
  searchGifs(query: string): Promise<GifResult[]>
}

export function createGifsHandler(dependencies: GifsDependencies) {
  return async function gifsHandler(req: NextApiRequest, res: NextApiResponse<GifsResponse>): Promise<void> {
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
        res.status(400).json({ success: false, code: 'INVALID_GIF_QUERY' })
        return
      }
      const data = await dependencies.searchGifs(query)
      res.status(200).json({ success: true, data })
    } catch (error) {
      sendTeamChatError(error, res, 'gifs', 'GIF_PROVIDER_UNAVAILABLE')
    }
  }
}

export default createGifsHandler({ getSession, searchGifs })
