import type { NextApiRequest, NextApiResponse } from 'next'
import { getSession } from '@/lib/auth'
import { copyWeek, copyWeekPreview, autoFill, autoFillPreview } from '@/lib/planning-automation'
import type { Location } from '@/types'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ success: false, error: 'Methode niet toegestaan' })

  const session = await getSession(req, res)
  if (!session.user || session.user.role !== 'admin') {
    return res.status(403).json({ success: false, error: 'Geen toegang' })
  }

  const { action, sourceWeek, sourceYear, targetWeek, targetYear, numberOfWeeks, location, overwrite } = req.body as {
    action: 'copy' | 'autofill' | 'copy-preview' | 'autofill-preview'
    sourceWeek: number
    sourceYear: number
    targetWeek?: number
    targetYear?: number
    numberOfWeeks?: number
    location?: Location
    overwrite?: boolean
  }

  if (!action || !sourceWeek || !sourceYear) {
    return res.status(400).json({ success: false, error: 'action, sourceWeek en sourceYear zijn vereist' })
  }

  try {
    switch (action) {
      case 'copy-preview': {
        if (!targetWeek || !targetYear) return res.status(400).json({ success: false, error: 'targetWeek en targetYear vereist' })
        const preview = await copyWeekPreview(sourceWeek, sourceYear, targetWeek, targetYear, location)
        return res.json({ success: true, data: preview })
      }

      case 'copy': {
        if (!targetWeek || !targetYear) return res.status(400).json({ success: false, error: 'targetWeek en targetYear vereist' })
        const result = await copyWeek(sourceWeek, sourceYear, targetWeek, targetYear, location, overwrite, session.user.display_name)
        return res.json({ success: true, data: result })
      }

      case 'autofill-preview': {
        if (!numberOfWeeks) return res.status(400).json({ success: false, error: 'numberOfWeeks vereist' })
        const preview = await autoFillPreview(sourceWeek, sourceYear, numberOfWeeks, location)
        return res.json({ success: true, data: preview })
      }

      case 'autofill': {
        if (!numberOfWeeks) return res.status(400).json({ success: false, error: 'numberOfWeeks vereist' })
        const result = await autoFill(sourceWeek, sourceYear, numberOfWeeks, location, overwrite, session.user.display_name)
        return res.json({ success: true, data: result })
      }

      default:
        return res.status(400).json({ success: false, error: `Onbekende actie: ${action}` })
    }
  } catch (err: unknown) {
    return res.status(500).json({ success: false, error: err instanceof Error ? err.message : 'Actie mislukt' })
  }
}
