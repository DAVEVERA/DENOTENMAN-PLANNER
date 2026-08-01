import type { NextApiRequest, NextApiResponse } from 'next'

import { getSession } from '../../../lib/auth'
import { getChatBootstrap, type TeamChatBootstrap } from '../../../lib/team-chat/repository'
import type { SessionUser } from '../../../types'

type BootstrapResponse =
  | { success: true; data: TeamChatBootstrap }
  | { success: false; code: 'UNAUTHENTICATED' | 'METHOD_NOT_ALLOWED' | 'CHAT_BOOTSTRAP_FAILED' }

interface BootstrapDependencies {
  getSession(req: NextApiRequest, res: NextApiResponse): Promise<{ user?: SessionUser }>
  getChatBootstrap(user: SessionUser): Promise<TeamChatBootstrap>
}

export function createBootstrapHandler(dependencies: BootstrapDependencies) {
  return async function bootstrapHandler(
    req: NextApiRequest,
    res: NextApiResponse<BootstrapResponse>,
  ): Promise<void> {
    res.setHeader('Cache-Control', 'private, no-store')

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

      const data = await dependencies.getChatBootstrap(session.user)
      res.status(200).json({ success: true, data })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      console.error('[team-chat/bootstrap]', message)
      res.status(500).json({ success: false, code: 'CHAT_BOOTSTRAP_FAILED' })
    }
  }
}

export default createBootstrapHandler({ getSession, getChatBootstrap })
