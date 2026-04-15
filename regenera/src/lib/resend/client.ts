// Wrapper sobre la API REST de Resend (sin SDK — sin dependencias extra).
// Docs: https://resend.com/docs/api-reference/emails/send-email

export const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.regenera.co'

export async function sendEmail({
  to,
  subject,
  html,
}: {
  to: string
  subject: string
  html: string
}): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY

  // En desarrollo sin clave configurada: log y no enviar.
  if (!apiKey || apiKey === 'resend_placeholder') {
    console.log(`[Resend] (dry-run) → ${to} | ${subject}`)
    return
  }

  const from = process.env.EMAIL_FROM ?? 'Regenera <noreply@regenera.co>'

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ from, to, subject, html }),
  })

  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(`Resend ${res.status}: ${JSON.stringify(body)}`)
  }
}
