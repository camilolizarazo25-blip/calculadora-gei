import { type NextRequest } from 'next/server'
import { z } from 'zod'
import { requireAuthApi, requireOrgContextApi, requireOwnerApi } from '@/lib/auth/guards'
import { createServiceClient } from '@/lib/supabase/server'
import { apiSuccess, apiError } from '@/lib/utils'
import {
  buildIntegritySignature,
  buildWompiReference,
  toCents,
  PLAN_AMOUNTS_COP,
} from '@/lib/wompi/signature'

const CheckoutSchema = z.object({
  plan_id: z.enum(['basic', 'professional']),
})

// POST /api/billing/checkout
// Genera los parámetros necesarios para iniciar el pago en Wompi Widget.
// Solo el owner puede iniciar un pago.
//
// Respuesta:
//   public_key     → clave pública de Wompi (para el widget en frontend)
//   reference      → referencia única de la transacción
//   amount_in_cents → monto en centavos (Wompi lo requiere así)
//   currency       → "COP"
//   integrity      → firma SHA256 para verificar integridad del monto
//   redirect_url   → URL de retorno después del pago
//   plan_id        → plan seleccionado (para mostrar en la UI)
//
// El frontend toma estos valores e inicializa el Wompi Widget Script.
// El widget maneja todo el flujo de pago (tarjeta, PSE, Nequi, etc).

export async function POST(request: NextRequest) {
  const { user, error: authError } = await requireAuthApi()
  if (authError) return authError

  const body = await request.json().catch(() => null)
  const parsed = CheckoutSchema.safeParse(body)
  if (!parsed.success) return apiError('Plan inválido', 400)

  const { ctx, error: ctxError } = await requireOrgContextApi(user.id)
  if (ctxError) return ctxError

  const ownerError = requireOwnerApi(ctx)
  if (ownerError) return ownerError

  const { plan_id } = parsed.data
  const amountCop = PLAN_AMOUNTS_COP[plan_id]
  if (!amountCop) return apiError('Plan no válido para pago', 400)

  const amountInCents = toCents(amountCop)
  const reference = buildWompiReference(ctx.orgId)
  const currency = 'COP'

  // Guardar la referencia en la suscripción ANTES de redirigir al pago.
  // Esto permite que el webhook identifique la org cuando Wompi notifique.
  // Si ya existe una referencia previa, se sobreescribe (nuevo intento de pago).
  const serviceClient = await createServiceClient()
  const { error: refError } = await serviceClient
    .from('subscriptions')
    .update({
      wompi_reference: reference,
      // Guardar el plan que el usuario intenta comprar para activarlo en el webhook
      // (no cambiar plan_id aún — se cambia solo cuando el pago sea APPROVED)
    })
    .eq('organization_id', ctx.orgId)

  if (refError) {
    console.error('Error guardando referencia Wompi:', refError)
    return apiError('Error iniciando el proceso de pago', 500)
  }

  const integrity = buildIntegritySignature(reference, amountInCents, currency)
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

  return apiSuccess({
    public_key: process.env.WOMPI_PUBLIC_KEY ?? '',
    reference,
    amount_in_cents: amountInCents,
    currency,
    integrity,
    redirect_url: `${appUrl}/pago/exitoso?ref=${reference}`,
    customer_email: user.email ?? '',
    plan_id,
    plan_name: plan_id === 'basic' ? 'Plan Básico' : 'Plan Profesional',
    amount_cop: amountCop,
  })
}
