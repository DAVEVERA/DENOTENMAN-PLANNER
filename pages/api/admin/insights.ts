import type { NextApiRequest, NextApiResponse } from 'next'
import { getSession } from '@/lib/auth'
import { getWeeklyInsights, getEmployeeLoadBalance } from '@/lib/insights'
import type { Location } from '@/types'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ success: false, error: 'Methode niet toegestaan' })

  const session = await getSession(req, res)
  if (!session.user || !['admin', 'manager'].includes(session.user.role)) {
    return res.status(403).json({ success: false, error: 'Geen toegang' })
  }

  const week = Number(req.query.week)
  const year = Number(req.query.year)
  const location = req.query.location as Location | undefined
  const type = req.query.type as string | undefined

  if (!week || !year) return res.status(400).json({ success: false, error: 'week en year zijn vereist' })

  try {
    if (type === 'load') {
      const data = await getEmployeeLoadBalance(week, year, location)
      return res.json({ success: true, data })
    }
    const data = await getWeeklyInsights(week, year, location)
    return res.json({ success: true, data })
  } catch (err: unknown) {
    return res.status(500).json({ success: false, error: err instanceof Error ? err.message : 'Insights ophalen mislukt' })
  }
}
