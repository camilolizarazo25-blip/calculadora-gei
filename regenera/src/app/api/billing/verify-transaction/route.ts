import { z } from 'zod'
import { requireAuthApi, requireOrgContextApi } from '@/lib/auth/guards'
import { createAdminClient } from '@/lib/supabase/admin'
import { apiSuccess, apiError } from '@/lib/utils'

const Schema = z.object({
  transaction_id: z.string().min(1),
})

// POST /api/billing/verify-transaction
// Verifica un pago con la API de Wompi y activa la suscripción si fue aprobado.
// Se llama desde la página /pago/exitoso después del redirect de Wompi.
//
// Por qué verificar server-side:
//   - El status en la URL (?status=APPROVED) lo envía Wompi pero podría ser manipulado
//   - Consultamos la API de Wompi con nuestra clave privada para confirmar
//   - Idempotente: si ya está activa con este transaction_id, no hace nada
export async function POST(request: Request) {
  const { user, error: authError } = await requireAuthApi()
  if (authError) return authError

  const body = await request.json().catch(() => null)
  const parsed = Schema.safeParse(body)
  if (!parsed.success) return apiError('transaction_id requerido', 400)

  const { transaction_id } = parsed.data

  // ── 1. Verificar transacción con API de Wompi ─────────────
  const privateKey = process.env.WOMPI_PRIVATE_KEY ?? ''
  const isSandbox = privateKey.includes('test') || privateKey.includes('placeholder')
  const wompiBase = isSandbox
    ? 'https://sandbox.wompi.co/v1'
    : 'https://production.wompi.co/v1'

  let transaction: WompiTransaction | null = null
  try {
    const res = await fetch(`${wompiBase}/transactions/${transaction_id}`, {
      headers: { Authorization: `Bearer ${privateKey}` },
    })
    if (!res.ok) {
      console.error('Wompi API error:', res.status)
      return apiError('No se pudo verificar el pago con Wompi', 502)
    }
    const data = await res.json()
    transaction = data.data as WompiTransaction
  } catch (err) {
    console.error('Error consultando Wompi:', err)
    return apiError('Error de conexión con Wompi', 502)
  }

  if (!transaction) return apiError('Transacción no encontrada', 404)
  if (transaction.status !== 'APPROVED') {
    return apiSuccess({ activated: false, status: transaction.status })
  }

  // ── 2. Obtener la suscripción por referencia ──────────────
  const { ctx, error: ctxError } = await requireOrgContextApi(user.id)
  if (ctxError) return ctxError

  const adminClient = createAdminClient()

  // Idempotencia: si ya procesamos esta transacción, no hacer nada
  const { data: sub } = await adminClient
    .from('subscriptions')
    .select('id, wompi_transaction_id')
    .eq('organization_id', ctx.orgId)
    .single()

  if (sub?.wompi_transaction_id === transaction_id) {
    return apiSuccess({ activated: true, already: true })
  }

  // ── 3. Determinar plan por monto ──────────────────────────
  let planId = 'basic'
  if (transaction.amount_in_cents === 18_990_000) planId = 'professional'

  // ── 4. Activar suscripción ────────────────────────────────
  const now = new Date()
  const periodEnd = new Date(now)
  periodEnd.setDate(periodEnd.getDate() + 30)

  const { error } = await adminClient
    .from('subscriptions')
    .update({
      status: 'active',
      plan_id: planId,
      current_period_start: now.toISOString(),
      current_period_end: periodEnd.toISOString(),
      wompi_transaction_id: transaction_id,
      amount_cop: Math.round(transaction.amount_in_cents / 100),
      payment_method: normalizeMethod(transaction.payment_method_type),
      trial_ends_at: null,
    })
    .eq('organization_id', ctx.orgId)

  if (error) {
    console.error('Error activando suscripción:', error)
    return apiError('Error activando la suscripción', 500)
  }

  console.log(`Suscripción activada vía redirect: org ${ctx.orgId}, plan ${planId}`)
  return apiSuccess({ activated: true, plan_id: planId })
}

interface WompiTransaction {
  id: string
  status: string
  reference: string
  amount_in_cents: number
  currency: string
  payment_method_type?: string
}

function normalizeMethod(type?: string): 'pse' | 'card' | 'nequi' | 'daviplata' | null {
  if (!type) return null
  const map: Record<string, 'pse' | 'card' | 'nequi' | 'daviplata'> = {
    CARD: 'card', PSE: 'pse', NEQUI: 'nequi', DAVIPLATA: 'daviplata',
  }
  return map[type.toUpperCase()] ?? null
}
