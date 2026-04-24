import type { NextApiRequest, NextApiResponse } from 'next'
import { getSession, can } from '@/lib/auth'
import { getExpenseClaim, updateExpenseClaimStatus, deleteExpenseClaim } from '@/lib/expenses'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const session = await getSession(req, res)
    if (!session.user) return res.status(401).json({ success: false })

    const id = parseInt(String(req.query.id))
    if (!id || isNaN(id)) return res.status(400).json({ success: false, message: 'Ongeldig ID' })

    const claim = await getExpenseClaim(id)
    if (!claim) return res.status(404).json({ success: false, message: 'Declaratie niet gevonden' })

    const isAdmin    = session.user.role === 'admin' || session.user.role === 'manager'
    const isOwner    = claim.employee_id === session.user.employee_id

    // ── GET ──────────────────────────────────────────────────────────────────
    if (req.method === 'GET') {
      if (!isAdmin && !isOwner)
        return res.status(403).json({ success: false })
      return res.json({ success: true, data: claim })
    }

    // ── PATCH — status bijwerken (admin only) ─────────────────────────────
    if (req.method === 'PATCH') {
      if (!isAdmin) return res.status(403).json({ success: false, message: 'Geen toegang' })

      const { status, review_note } = req.body
      if (status !== 'approved' && status !== 'rejected')
        return res.status(400).json({ success: false, message: 'Status moet "approved" of "rejected" zijn' })

      const updated = await updateExpenseClaimStatus(
        id,
        status,
        session.user.display_name ?? session.user.user_id,
        review_note,
      )
      return res.json({ success: true, data: updated })
    }

    // ── DELETE — alleen eigen pending declaraties (of admin) ─────────────
    if (req.method === 'DELETE') {
      if (!isAdmin && !isOwner)
        return res.status(403).json({ success: false })
      if (!isAdmin && claim.status !== 'pending')
        return res.status(400).json({ success: false, message: 'Alleen openstaande declaraties kunnen worden ingetrokken' })

      await deleteExpenseClaim(id)
      return res.json({ success: true })
    }

    res.status(405).json({ success: false })
  } catch (err: any) {
    console.error('[api/expenses/[id]]', err)
    res.status(500).json({ success: false, message: err.message })
  }
}
