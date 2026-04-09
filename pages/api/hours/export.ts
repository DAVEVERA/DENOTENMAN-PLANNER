import type { NextApiRequest, NextApiResponse } from 'next'
import { getSession, can } from '@/lib/auth'
import { getTimeLogs } from '@/lib/hours'
import { getSettings } from '@/lib/settings'
import { buildCSV, buildJSON, buildExcel, buildPDF } from '@/lib/export'
import { sendExportEmail } from '@/lib/email'
import type { Location } from '@/types'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getSession(req, res)
  if (!session.user) return res.status(401).json({ success: false })
  if (!can(session.user, 'export_data')) return res.status(403).json({ success: false })

  if (req.method !== 'POST') return res.status(405).json({ success: false })

  const {
    format   = 'csv',
    from     = '',
    to       = '',
    location,
    email    = false,
    employee_id,
    is_processed,
  } = req.body

  const logs = await getTimeLogs({
    from, to,
    location:     location as Location | undefined,
    employee_id:  employee_id ? parseInt(employee_id) : undefined,
    is_processed: is_processed !== undefined ? parseInt(is_processed) : undefined,
  })

  const period = `${from || '?'} – ${to || '?'}`
  const now = new Date().toISOString().slice(0, 10)

  if (format === 'json') {
    const json = buildJSON(logs)
    const emailOk = email ? await doEmail(json, `uren-${now}.json`, 'application/json', period) : null
    if (email !== null) res.setHeader('X-Email-Sent', emailOk ? '1' : '0')
    res.setHeader('Content-Type', 'application/json')
    res.setHeader('Content-Disposition', `attachment; filename="uren-${now}.json"`)
    return res.send(json)
  }

  if (format === 'csv') {
    const csv = buildCSV(logs)
    const emailOk = email ? await doEmail(Buffer.from(csv, 'utf-8'), `uren-${now}.csv`, 'text/csv', period) : null
    if (email !== null) res.setHeader('X-Email-Sent', emailOk ? '1' : '0')
    res.setHeader('Content-Type', 'text/csv; charset=utf-8')
    res.setHeader('Content-Disposition', `attachment; filename="uren-${now}.csv"`)
    return res.send(csv)
  }

  if (format === 'excel') {
    const buf = await buildExcel(logs, from, to)
    const emailOk = email ? await doEmail(buf, `uren-${now}.xlsx`, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', period) : null
    if (email !== null) res.setHeader('X-Email-Sent', emailOk ? '1' : '0')
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    res.setHeader('Content-Disposition', `attachment; filename="uren-${now}.xlsx"`)
    return res.send(buf)
  }

  if (format === 'pdf') {
    const buf = await buildPDF(logs, from, to, 'Urenregistratie De Notenkar')
    const emailOk = email ? await doEmail(buf, `uren-${now}.pdf`, 'application/pdf', period) : null
    if (email !== null) res.setHeader('X-Email-Sent', emailOk ? '1' : '0')
    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', `attachment; filename="uren-${now}.pdf"`)
    return res.send(buf)
  }

  res.status(400).json({ success: false, message: 'Ongeldig formaat' })
}

async function doEmail(content: Buffer | string, filename: string, mimeType: string, period: string): Promise<boolean> {
  try {
    const settings = await getSettings()
    if (!settings.accountant_email) return false
    await sendExportEmail({
      to:       settings.accountant_email,
      toName:   settings.accountant_name || 'Boekhouder',
      subject:  `Urenexport De Notenkar – ${period}`,
      body:     `Beste,\n\nBijgaand de urenregistratie voor de periode ${period}.\n\nMet vriendelijke groet,\nDe Notenkar Planner`,
      filename,
      content:  typeof content === 'string' ? Buffer.from(content, 'utf-8') : content,
      mimeType,
    })
    return true
  } catch (err) {
    console.error('Email failed:', err)
    return false
  }
}
