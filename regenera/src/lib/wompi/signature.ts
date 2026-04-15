import crypto from 'crypto'

// ─── Helpers de firma para integración Wompi ─────────────────
//
// Wompi usa dos tipos de secretos:
//   WOMPI_PRIVATE_KEY  → integrity secret (firma del checkout widget)
//   WOMPI_EVENTS_SECRET → firma de eventos/webhooks
//
// Documentación: https://docs.wompi.co

// ── Firma de integridad del widget ───────────────────────────
// Evita que el usuario modifique el monto en el HTML antes de pagar.
// Algoritmo: SHA256(reference + amount_in_cents + currency + private_key)
export function buildIntegritySignature(
  reference: string,
  amountInCents: number,
  currency: string
): string {
  const secret = process.env.WOMPI_PRIVATE_KEY ?? ''
  const input = `${reference}${amountInCents}${currency}${secret}`
  return crypto.createHash('sha256').update(input).digest('hex')
}

// ── Verificación de webhook ───────────────────────────────────
// Wompi incluye en cada evento:
//   signature.checksum  → hash que debemos reproducir
//   signature.properties → lista de campos del evento a concatenar
//
// Algoritmo: SHA256(values.join('') + events_secret)
// Comparar con timing-safe para evitar timing attacks.
export function verifyWompiWebhook(
  eventData: Record<string, unknown>,
  checksum: string,
  properties: string[]
): boolean {
  const secret = process.env.WOMPI_EVENTS_SECRET ?? ''

  // Extraer valores en el orden que Wompi especifica
  const values = properties.map((prop) => {
    // Las propiedades usan notación con puntos: "transaction.id", "transaction.status"
    const parts = prop.split('.')
    let value: unknown = eventData
    for (const part of parts) {
      value = (value as Record<string, unknown>)?.[part]
    }
    return String(value ?? '')
  })

  const input = values.join('') + secret
  const expected = crypto.createHash('sha256').update(input).digest('hex')

  // Comparación segura contra timing attacks
  try {
    return crypto.timingSafeEqual(
      Buffer.from(expected, 'hex'),
      Buffer.from(checksum, 'hex')
    )
  } catch {
    return false
  }
}

// ── Generar referencia única para la transacción ─────────────
// Formato legible: regen_{8 chars del orgId}_{timestamp}
// Único por (org, momento) — suficiente para MVP
export function buildWompiReference(orgId: string): string {
  const shortId = orgId.replace(/-/g, '').slice(0, 8)
  return `regen_${shortId}_${Date.now()}`
}

// ── Planes → montos en centavos ───────────────────────────────
// Wompi trabaja en centavos: 89.900 COP = 8_990_000 centavos
export const PLAN_AMOUNTS_COP: Record<string, number> = {
  basic: 89_900,
  professional: 189_900,
}

export function toCents(amountCop: number): number {
  return amountCop * 100
}
