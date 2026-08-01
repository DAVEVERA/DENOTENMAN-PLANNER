import type { NextApiResponse } from 'next'

import { GifProviderError } from './gifs'
import { TeamChatRepositoryError } from './repository'

export type TeamChatApiErrorResponse = { success: false; code: string }

export function setTeamChatNoStore(res: NextApiResponse): void {
  res.setHeader('Cache-Control', 'private, no-store')
}

export function singleString(value: string | string[] | undefined): string | undefined {
  return typeof value === 'string' ? value : undefined
}

export function positiveInteger(value: unknown): number | undefined {
  const parsed = typeof value === 'number'
    ? value
    : typeof value === 'string' && /^\d+$/.test(value)
      ? Number(value)
      : Number.NaN
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : undefined
}

export function sendTeamChatError(
  error: unknown,
  res: NextApiResponse<TeamChatApiErrorResponse>,
  scope: string,
  fallbackCode: string,
): void {
  if (error instanceof TeamChatRepositoryError || error instanceof GifProviderError) {
    res.status(error.status).json({ success: false, code: error.code })
    return
  }

  const message = error instanceof Error ? error.message : 'Unknown error'
  console.error(`[team-chat/${scope}]`, message)
  res.status(500).json({ success: false, code: fallbackCode })
}
