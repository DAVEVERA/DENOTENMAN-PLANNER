import type { NextApiRequest, NextApiResponse } from 'next'
import { getSession, can } from '@/lib/auth'
import { getExpenseClaims } from '@/lib/expenses'
import { getSettings } from '@/lib/settings'
import { sendExportEmail } from '@/lib/email'
import { buildExpenseCSV, buildExpenseExcel, buildExpenseJSON, buildExpensePDF } from '@/lib/expense-export'
import type { ClaimType, ExpenseClaim } from '@/types'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const session = await getSession(req, res)
    if (!session.user) return res.status(401).json({ success: false })
    if (!can(session.user, 'export_data')) return res.status(403).json({ success: false })
    if (req.method !== 'POST') return res.status(405).json({ success: false })

    const {
      format = 'csv',
      from = '',
      to = '',
      status = 'approved',
      claim_type,
      employee_id,
      email = false,
    } = req.body

    const claims = await getExpenseClaims({
      from,
      to,
      status: status && status !== 'all' ? status as ExpenseClaim['status'] : undefined,
      claimType: claim_type && claim_type !== 'all' ? claim_type as ClaimType : undefined,
      employeeId: employee_id ? parseInt(String(employee_id)) : undefined,
    })

    const period = `${from || '?'} - ${to || '?'}`
    const now = new Date().toISOString().slice(0, 10)

    if (format === 'json') {
      const json = buildExpenseJSON(claims)
      const emailOk = email ? await doEmail(json, `declaraties-${now}.json`, 'application/json', period) : null
      if (email !== null) res.setHeader('X-Email-Sent', emailOk ? '1' : '0')
      res.setHeader('Content-Type', 'application/json')
      res.setHeader('Content-Disposition', `attachment; filename="declaraties-${now}.json"`)
      return res.send(json)
    }

    if (format === 'csv') {
      const csv = buildExpenseCSV(claims)
      const emailOk = email ? await doEmail(Buffer.from(csv, 'utf-8'), `declaraties-${now}.csv`, 'text/csv', period) : null
      if (email !== null) res.setHeader('X-Email-Sent', emailOk ? '1' : '0')
      res.setHeader('Content-Type', 'text/csv; charset=utf-8')
      res.setHeader('Content-Disposition', `attachment; filename="declaraties-${now}.csv"`)
      return res.send(csv)
    }

    if (format === 'excel') {
      const buf = await buildExpenseExcel(claims, from, to)
      const emailOk = email ? await doEmail(buf, `declaraties-${now}.xlsx`, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', period) : null
      if (email !== null) res.setHeader('X-Email-Sent', emailOk ? '1' : '0')
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
      res.setHeader('Content-Disposition', `attachment; filename="declaraties-${now}.xlsx"`)
      return res.send(buf)
    }

    if (format === 'pdf') {
      const buf = await buildExpensePDF(claims, from, to)
      const emailOk = email ? await doEmail(buf, `declaraties-${now}.pdf`, 'application/pdf', period) : null
      if (email !== null) res.setHeader('X-Email-Sent', emailOk ? '1' : '0')
      res.setHeader('Content-Type', 'application/pdf')
      res.setHeader('Content-Disposition', `attachment; filename="declaraties-${now}.pdf"`)
      return res.send(buf)
    }

    res.status(400).json({ success: false, message: 'Ongeldig formaat' })
  } catch (err) {
    console.error('[/api/expenses/export]', err)
    res.status(500).json({ success: false, message: err instanceof Error ? err.message : 'Export mislukt' })
  }
}

async function doEmail(content: Buffer | string, filename: string, mimeType: string, period: string): Promise<boolean> {
  try {
    const settings = await getSettings()
    if (!settings.accountant_email) return false
    await sendExportEmail({
      to: settings.accountant_email,
      toName: settings.accountant_name || 'Boekhouder',
      subject: `Declaratie-export De Notenman - ${period}`,
      body: `Beste,\n\nBijgaand de declaraties voor de periode ${period}.\n\nMet vriendelijke groet,\nDe Notenman Planner`,
      filename,
      content: typeof content === 'string' ? Buffer.from(content, 'utf-8') : content,
      mimeType,
    })
    return true
  } catch (err) {
    console.error('Expense export email failed:', err)
    return false
  }
}
