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
