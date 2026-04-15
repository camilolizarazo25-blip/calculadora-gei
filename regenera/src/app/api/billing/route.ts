import { type NextRequest } from 'next/server'
import { requireAuthApi, requireOrgContextApi } from '@/lib/auth/guards'
import { apiSuccess, apiError } from '@/lib/utils'

// GET /api/billing — estado de suscripción actual
export async function GET() {
  const { user, error: authError } = await requireAuthApi()
  if (authError) return authError

  const { ctx, error: ctxError } = await requireOrgContextApi(user.id)
  if (ctxError) return ctxError

  return apiSuccess({
    plan: ctx.plan,
    status: ctx.subStatus,
    isActive: ctx.isActive,
    aiUsage: ctx.aiUsage,
  })
}

// POST /api/billing/webhook — recibir eventos de Wompi
// Este endpoint NO usa auth de usuario — Wompi llama directamente con su firma.
// TODO: implementar cuando se integre Wompi
export async function POST(request: NextRequest) {
  // TODO: verificar firma HMAC del webhook con WOMPI_EVENTS_SECRET
  // const signature = request.headers.get('x-event-checksum')
  // if (!isValidWompiSignature(body, signature)) return apiError('Firma inválida', 401)

  const body = await request.json().catch(() => null)
  if (!body) return apiError('Body inválido', 400)

  // TODO: procesar eventos:
  // - transaction.updated (status: APPROVED) → activar suscripción (usar createServiceClient)
  // - subscription.renewed → extender period_end
  // - subscription.failed → cambiar status a past_due

  console.log('Wompi webhook recibido:', body.event)
  return apiSuccess({ received: true })
}
