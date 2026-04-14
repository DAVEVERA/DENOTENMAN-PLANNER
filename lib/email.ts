import nodemailer from 'nodemailer'

function getTransport() {
  return nodemailer.createTransport({
    host:   process.env.SMTP_HOST,
    port:   parseInt(process.env.SMTP_PORT ?? '587'),
    secure: process.env.SMTP_PORT === '465',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  })
}

const FROM = process.env.SMTP_FROM ?? 'Planner De Notenman <planner@denotenkar.nl>'
const APP_URL = process.env.NEXTAUTH_URL ?? 'http://localhost:3000'

/** Stuur een uitnodigingsemail naar een nieuwe medewerker. */
export async function sendInviteEmail(opts: {
  to:           string
  toName:       string
  username:     string
  tempPassword: string
}): Promise<void> {
  const transport = getTransport()
  const loginUrl  = `${APP_URL}/login`

  await transport.sendMail({
    from:    FROM,
    to:      `${opts.toName} <${opts.to}>`,
    subject: 'Welkom bij de Planner — jouw inloggegevens',
    text: `Hallo ${opts.toName},

Je bent uitgenodigd voor de personeelsplanner van De Notenman.

Jouw inloggegevens:
  Gebruikersnaam: ${opts.username}
  Tijdelijk wachtwoord: ${opts.tempPassword}

Log in via: ${loginUrl}

Wijzig je wachtwoord na je eerste inlog.
Vul ook je profiel in zodat de planner altijd up-to-date is.

Groeten,
De Notenman — Administratie
`,
    html: `
<!DOCTYPE html>
<html lang="nl">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f1ee;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f1ee;padding:40px 16px">
    <tr><td align="center">
      <table width="100%" style="max-width:520px;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,.08)">

        <!-- Header -->
        <tr><td style="background:#2C6E49;padding:28px 32px;text-align:center">
          <p style="margin:0;font-size:22px;font-weight:700;color:#fff;letter-spacing:-.02em">
            De Notenman — Planner
          </p>
        </td></tr>

        <!-- Body -->
        <tr><td style="padding:32px">
          <p style="margin:0 0 16px;font-size:18px;font-weight:600;color:#1a140e">
            Welkom, ${opts.toName}!
          </p>
          <p style="margin:0 0 24px;font-size:15px;color:#4a3728;line-height:1.6">
            Je bent uitgenodigd voor de personeelsplanner.
            Gebruik de onderstaande gegevens om in te loggen.
          </p>

          <!-- Credentials box -->
          <table width="100%" style="background:#f9f5f1;border:1px solid #e8ddd4;border-radius:8px;margin-bottom:24px">
            <tr>
              <td style="padding:16px 20px">
                <p style="margin:0 0 10px;font-size:13px;font-weight:600;color:#7B4F2E;text-transform:uppercase;letter-spacing:.06em">Inloggegevens</p>
                <p style="margin:0 0 6px;font-size:14px;color:#4a3728">
                  <strong>Gebruikersnaam:</strong>
                  <code style="background:#fff;border:1px solid #ddd;border-radius:4px;padding:2px 7px;font-size:14px;color:#1a140e">${opts.username}</code>
                </p>
                <p style="margin:0;font-size:14px;color:#4a3728">
                  <strong>Tijdelijk wachtwoord:</strong>
                  <code style="background:#fff;border:1px solid #ddd;border-radius:4px;padding:2px 7px;font-size:14px;color:#1a140e">${opts.tempPassword}</code>
                </p>
              </td>
            </tr>
          </table>

          <!-- CTA -->
          <p style="margin:0 0 24px;text-align:center">
            <a href="${loginUrl}" style="display:inline-block;background:#2C6E49;color:#fff;font-size:15px;font-weight:600;padding:12px 28px;border-radius:8px;text-decoration:none">
              Inloggen &rarr;
            </a>
          </p>

          <p style="margin:0;font-size:13px;color:#7B4F2E;line-height:1.5">
            Wijzig je wachtwoord na je eerste inlog en vul je profiel aan.
            Heb je vragen? Neem contact op met de beheerder.
          </p>
        </td></tr>

        <!-- Footer -->
        <tr><td style="background:#f9f5f1;padding:16px 32px;text-align:center">
          <p style="margin:0;font-size:12px;color:#9e8070">De Notenman — Personeelsplanner</p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>
`,
  })
}

export async function sendExportEmail(opts: {
  to:       string
  toName:   string
  subject:  string
  body:     string
  filename: string
  content:  Buffer
  mimeType: string
}): Promise<void> {
  const transport = getTransport()
  await transport.sendMail({
    from:    process.env.SMTP_FROM ?? 'Planner <planner@denotenkar.nl>',
    to:      `${opts.toName} <${opts.to}>`,
    subject: opts.subject,
    text:    opts.body,
    attachments: [
      {
        filename:    opts.filename,
        content:     opts.content,
        contentType: opts.mimeType,
      },
    ],
  })
}
