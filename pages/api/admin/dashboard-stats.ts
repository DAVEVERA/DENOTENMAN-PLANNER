import type { NextApiRequest, NextApiResponse } from 'next'
import { getSession } from '@/lib/auth'
import { supabase, T } from '@/lib/db'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ success: false, error: 'Methode niet toegestaan' })

  const session = await getSession(req, res)
  if (!session.user || !['admin', 'manager'].includes(session.user.role)) {
    return res.status(403).json({ success: false, error: 'Geen toegang' })
  }

  try {
    const [empRes, openRes, leaveRes, expRes] = await Promise.all([
      supabase
        .from(T('employees'))
        .select('id', { count: 'exact', head: true })
        .eq('is_active', 1),

      // Eén totaal voor beheer-openingen en door medewerkers aangeboden diensten.
      supabase
        .from(T('shifts'))
        .select('id', { count: 'exact', head: true })
        .is('archived_at', null)
        .eq('is_open', 1),

      supabase
        .from(T('leave_requests'))
        .select('id', { count: 'exact', head: true })
        .eq('status', 'pending'),

      supabase
        .from(T('expense_claims'))
        .select('id', { count: 'exact', head: true })
        .eq('status', 'pending'),
    ])

    return res.json({
      success: true,
      data: {
        employees:       empRes.count  ?? 0,
        openShifts:      openRes.count ?? 0,
        pendingLeave:    leaveRes.count ?? 0,
        pendingExpenses: expRes.count  ?? 0,
      },
    })
  } catch (err: unknown) {
    console.error('[dashboard-stats]', err)
    return res.status(500).json({ success: false, error: 'Statistieken ophalen mislukt' })
  }
}
