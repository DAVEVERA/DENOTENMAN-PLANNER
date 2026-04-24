import type { NextApiRequest, NextApiResponse } from 'next'
import { getSession, can } from '@/lib/auth'
import { getExpenseClaims, createExpenseClaim, getExpenseSummaryByEmployee } from '@/lib/expenses'
import { getEmployee } from '@/lib/scheduler'
import type { ClaimType, CLAIM_TYPES } from '@/types'

const VALID_TYPES: readonly string[] = ['reiskosten', 'overuren', 'overig']

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const session = await getSession(req, res)
    if (!session.user) return res.status(401).json({ success: false })

    // ── GET ──────────────────────────────────────────────────────────────────
    if (req.method === 'GET') {
      if (!can(session.user, 'read')) return res.status(403).json({ success: false })

      const isAdmin = session.user.role === 'admin' || session.user.role === 'manager'

      // ?summary=1 → admin only overzicht per medewerker
      if (req.query.summary === '1') {
        if (!isAdmin) return res.status(403).json({ success: false })
        const data = await getExpenseSummaryByEmployee()
        return res.json({ success: true, data })
      }

      // Medewerker ziet alleen eigen declaraties; admin ziet alles (of per ?employee_id=)
      const employeeId = isAdmin
        ? (req.query.employee_id ? parseInt(String(req.query.employee_id)) : undefined)
        : session.user.employee_id ?? undefined

      const status = req.query.status as any ?? undefined
      const data = await getExpenseClaims({ employeeId, status })
      return res.json({ success: true, data })
    }

    // ── POST ─────────────────────────────────────────────────────────────────
    if (req.method === 'POST') {
      if (!can(session.user, 'view_own'))
        return res.status(403).json({ success: false })

      const employeeId = session.user.employee_id
      if (!employeeId)
        return res.status(400).json({ success: false, message: 'Geen medewerker gekoppeld aan dit account' })

      const { claim_type, amount, description, claim_date, reference_date, shift_id } = req.body

      // Validatie
      if (!VALID_TYPES.includes(claim_type))
        return res.status(400).json({ success: false, message: 'Ongeldig declaratietype' })
      if (!amount || isNaN(Number(amount)) || Number(amount) <= 0)
        return res.status(400).json({ success: false, message: 'Voer een geldig bedrag in (> 0)' })
      if (!description?.trim())
        return res.status(400).json({ success: false, message: 'Omschrijving is verplicht' })
      if (!claim_date)
        return res.status(400).json({ success: false, message: 'Declaratiedatum is verplicht' })

      const emp = await getEmployee(employeeId)
      const claim = await createExpenseClaim({
        employee_id:    employeeId,
        employee_name:  emp?.name ?? session.user.display_name ?? '',
        claim_type:     claim_type as ClaimType,
        amount:         Number(Number(amount).toFixed(2)),
        description:    description.trim(),
        claim_date,
        reference_date: reference_date ?? null,
        shift_id:       shift_id ? parseInt(shift_id) : null,
        submitted_by:   session.user.user_id,
      })

      return res.status(201).json({ success: true, data: claim })
    }

    res.status(405).json({ success: false })
  } catch (err: any) {
    console.error('[api/expenses]', err)
    res.status(500).json({ success: false, message: err.message })
  }
}
