import type { NextApiRequest, NextApiResponse } from 'next'

import { getSession } from '../../../../lib/auth'
import { sendTeamChatError, setTeamChatNoStore } from '../../../../lib/team-chat/api'
import { createShiftExchange, type CreateShiftExchangeInput, type ShiftExchangeRequest } from '../../../../lib/team-chat/exchanges'
import type { SessionUser } from '../../../../types'

type ExchangeResponse = { success: true; data: ShiftExchangeRequest } | { success: false; code: string }

interface ExchangeDependencies {
  getSession(req: NextApiRequest, res: NextApiResponse): Promise<{ user?: SessionUser }>
  createShiftExchange(user: SessionUser, input: CreateShiftExchangeInput): Promise<ShiftExchangeRequest>
}

export function createExchangeHandler(dependencies: ExchangeDependencies) {
  return async function exchangeHandler(req: NextApiRequest, res: NextApiResponse<ExchangeResponse>): Promise<void> {
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
      const data = await dependencies.createShiftExchange(session.user, req.body as CreateShiftExchangeInput)
      res.status(201).json({ success: true, data })
    } catch (error) {
      sendTeamChatError(error, res, 'exchanges', 'SHIFT_EXCHANGE_FAILED')
    }
  }
}

export default createExchangeHandler({ getSession, createShiftExchange })
