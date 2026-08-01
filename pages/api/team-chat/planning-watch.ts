import type { NextApiRequest, NextApiResponse } from 'next'

import { getSession } from '../../../lib/auth'
import { sendTeamChatError, setTeamChatNoStore } from '../../../lib/team-chat/api'
import { getPlanningWatch, syncPlanningTriggers, type PlanningWatchItem } from '../../../lib/team-chat/planning-watch'
import type { SessionUser } from '../../../types'

type PlanningWatchData = PlanningWatchItem[] | { published: number; duplicates: number }
type PlanningWatchResponse = { success: true; data: PlanningWatchData } | { success: false; code: string }

interface PlanningWatchDependencies {
  getSession(req: NextApiRequest, res: NextApiResponse): Promise<{ user?: SessionUser }>
  getPlanningWatch(user: SessionUser): Promise<PlanningWatchItem[]>
  syncPlanningTriggers(user: SessionUser): Promise<{ published: number; duplicates: number }>
}

export function createPlanningWatchHandler(dependencies: PlanningWatchDependencies) {
  return async function planningWatchHandler(req: NextApiRequest, res: NextApiResponse<PlanningWatchResponse>): Promise<void> {
    setTeamChatNoStore(res)
    try {
      const session = await dependencies.getSession(req, res)
      if (!session.user) {
        res.status(401).json({ success: false, code: 'UNAUTHENTICATED' })
        return
      }
      if (req.method === 'GET') {
        res.status(200).json({ success: true, data: await dependencies.getPlanningWatch(session.user) })
        return
      }
      if (req.method === 'POST') {
        res.status(200).json({ success: true, data: await dependencies.syncPlanningTriggers(session.user) })
        return
      }
      res.setHeader('Allow', 'GET, POST')
      res.status(405).json({ success: false, code: 'METHOD_NOT_ALLOWED' })
    } catch (error) {
      sendTeamChatError(error, res, 'planning-watch', 'PLANNING_WATCH_FAILED')
    }
  }
}

export default createPlanningWatchHandler({ getSession, getPlanningWatch, syncPlanningTriggers })
