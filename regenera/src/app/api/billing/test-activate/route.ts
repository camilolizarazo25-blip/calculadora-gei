import { z } from 'zod'
import { requireAuthApi, requireOrgContextApi } from '@/lib/auth/guards'
import { createAdminClient } from '@/lib/supabase/admin'
import { apiSuccess, apiError } from '@/lib/utils'

const Schema = z.object({
  plan_id: z.enum(['basic', 'professional']),
})

// POST /api/billing/test-activate
// Activa la suscripción directamente — SOLO en desarrollo (cuando WOMPI_PUBLIC_KEY es placeholder).
// Permite probar el flujo completo sin claves reales de Wompi.
export async function POST(request: Request) {
  if (!process.env.WOMPI_PUBLIC_KEY?.includes('placeholder')) {
    return apiError('Solo disponible en modo desarrollo', 403)
  }

  const { user, error: authError } = await requireAuthApi()
  if (authError) return authError

  const body = await request.json().catch(() => null)
  const parsed = Schema.safeParse(body)
  if (!parsed.success) return apiError('plan_id inválido', 400)

  const { ctx, error: ctxError } = await requireOrgContextApi(user.id)
  if (ctxError) return ctxError

  const { plan_id } = parsed.data
  const now = new Date()
  const periodEnd = new Date(now)
  periodEnd.setDate(periodEnd.getDate() + 30)

  const adminClient = createAdminClient()
  const { error } = await adminClient
    .from('subscriptions')
    .update({
      status: 'active',
      plan_id,
      current_period_start: now.toISOString(),
      current_period_end: periodEnd.toISOString(),
      trial_ends_at: null,
      wompi_transaction_id: `test_${Date.now()}`,
    })
    .eq('organization_id', ctx.orgId)

  if (error) {
    console.error('test-activate error:', error)
    return apiError('Error activando suscripción de prueba', 500)
  }

  return apiSuccess({ activated: true, plan_id })
}
