import type { NextApiRequest, NextApiResponse } from 'next'

import { getSession } from '../../../../../lib/auth'
import { sendTeamChatError, setTeamChatNoStore, singleString } from '../../../../../lib/team-chat/api'
import { respondToShiftExchange, type ExchangeResponse as ExchangeData } from '../../../../../lib/team-chat/exchanges'
import type { SessionUser } from '../../../../../types'

type ExchangeResponse = { success: true; data: ExchangeData } | { success: false; code: string }

interface ExchangeDependencies {
  getSession(req: NextApiRequest, res: NextApiResponse): Promise<{ user?: SessionUser }>
  respondToShiftExchange(user: SessionUser, requestId: string, decision: 'accepted' | 'declined'): Promise<ExchangeData>
}

export function createExchangeResponseHandler(dependencies: ExchangeDependencies) {
  return async function exchangeResponseHandler(req: NextApiRequest, res: NextApiResponse<ExchangeResponse>): Promise<void> {
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
      const requestId = singleString(req.query.id)
      const decision = req.body?.decision
      if (!requestId || (decision !== 'accepted' && decision !== 'declined')) {
        res.status(400).json({ success: false, code: 'INVALID_EXCHANGE_REQUEST' })
        return
      }
      const data = await dependencies.respondToShiftExchange(session.user, requestId, decision)
      res.status(200).json({ success: true, data })
    } catch (error) {
      sendTeamChatError(error, res, 'exchanges/respond', 'SHIFT_EXCHANGE_RESPONSE_FAILED')
    }
  }
}

export default createExchangeResponseHandler({ getSession, respondToShiftExchange })
