import type { NextApiRequest, NextApiResponse } from 'next'
import { getSession } from '@/lib/auth'
import { supabase, T } from '@/lib/db'
import nodemailer from 'nodemailer'

function getTransport() {
  const port   = parseInt(process.env.SMTP_PORT ?? '587')
  const secure = port === 465
  return nodemailer.createTransport({
    host:   process.env.SMTP_HOST,
    port,
    secure,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    tls:  { rejectUnauthorized: true },
  })
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ success: false })

  const session = await getSession(req, res)
  if (!session.user) return res.status(401).json({ success: false, message: 'Niet ingelogd' })

  const { subject, category, description } = req.body as {
    subject:     string
    category:    string
    description: string
  }

  if (!subject?.trim() || !description?.trim()) {
    return res.status(400).json({ success: false, message: 'Onderwerp en beschrijving zijn verplicht.' })
  }

  // E-mailadres van de medewerker ophalen (niet op SessionUser, wel in employees-tabel)
  let employeeEmail: string | null = null
  if (session.user.employee_id) {
    const { data } = await supabase
      .from(T('employees'))
      .select('email')
      .eq('id', session.user.employee_id)
      .single()
    employeeEmail = data?.email ?? null
  }

  // Ontvangst-adres: SMTP_SUPPORT_TO of fallback naar SMTP_FROM (beheer-inbox)
  const toAddress = process.env.SMTP_SUPPORT_TO ?? process.env.SMTP_FROM ?? 'planner@denotenman.nl'
  const fromLabel  = process.env.SMTP_FROM ?? 'Planner De Notenman <planner@denotenman.nl>'

  try {
    const host = process.env.SMTP_HOST
    if (!host || host === 'localhost' || host === '127.0.0.1') {
      // In development: log het ticket zonder te mailen
      console.log('[support-ticket]', { from: session.user.display_name, subject, category, description })
      return res.json({ success: true })
    }

    const transport = getTransport()
    await transport.sendMail({
      from:    fromLabel,
      to:      toAddress,
      // Reply-To zodat beheer direct kan antwoorden op het e-mailadres van de medewerker
      replyTo: employeeEmail ? `${session.user.display_name} <${employeeEmail}>` : undefined,
      subject: `[Support] ${category ? `[${category}] ` : ''}${subject}`,
      text: [
        `Van:         ${session.user.display_name}`,
        `E-mail:      ${employeeEmail ?? '(onbekend)'}`,
        `Categorie:   ${category || '-'}`,
        `Onderwerp:   ${subject}`,
        '',
        description,
      ].join('\n'),
      html: `
<!DOCTYPE html>
<html lang="nl">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f1ee;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f1ee;padding:40px 16px">
    <tr><td align="center">
      <table width="100%" style="max-width:540px;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,.08)">
        <tr><td style="background:#1A1412;padding:24px 32px">
          <p style="margin:0;font-size:20px;font-weight:700;color:#fff">🎫 Support Ticket</p>
          <p style="margin:6px 0 0;font-size:13px;color:rgba(255,255,255,.5)">De Notenman – Personeelsplanner</p>
        </td></tr>
        <tr><td style="padding:28px 32px">
          <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9f5f1;border:1px solid #e8ddd4;border-radius:8px;margin-bottom:20px">
            <tr><td style="padding:16px 20px">
              <p style="margin:0 0 8px;font-size:12px;font-weight:700;color:#7B4F2E;text-transform:uppercase;letter-spacing:.06em">Indiener</p>
              <p style="margin:0;font-size:15px;color:#1a140e;font-weight:600">${session.user.display_name}</p>
              ${employeeEmail ? `<p style="margin:4px 0 0;font-size:13px;color:#4a3728">${employeeEmail}</p>` : ''}
            </td></tr>
          </table>
          <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:20px">
            <tr>
              <td style="padding:0 8px 0 0" width="50%">
                <p style="margin:0 0 4px;font-size:12px;font-weight:600;color:#7B4F2E;text-transform:uppercase;letter-spacing:.05em">Categorie</p>
                <p style="margin:0;font-size:14px;color:#1a140e">${category || '—'}</p>
              </td>
              <td style="padding:0 0 0 8px" width="50%">
                <p style="margin:0 0 4px;font-size:12px;font-weight:600;color:#7B4F2E;text-transform:uppercase;letter-spacing:.05em">Onderwerp</p>
                <p style="margin:0;font-size:14px;color:#1a140e;font-weight:600">${subject}</p>
              </td>
            </tr>
          </table>
          <p style="margin:0 0 6px;font-size:12px;font-weight:600;color:#7B4F2E;text-transform:uppercase;letter-spacing:.05em">Beschrijving</p>
          <div style="background:#f9f5f1;border:1px solid #e8ddd4;border-radius:8px;padding:16px 20px;font-size:14px;color:#1a140e;line-height:1.6;white-space:pre-wrap">${description.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div>
        </td></tr>
        <tr><td style="background:#f9f5f1;padding:14px 32px;text-align:center">
          <p style="margin:0;font-size:11px;color:#9e8070">Verstuurd via de Personeelsplanner van De Notenman</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>
      `,
    })

    return res.json({ success: true })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[support-ticket]', msg)
    return res.status(500).json({ success: false, message: 'Ticket versturen mislukt. Probeer later opnieuw.' })
  }
}
