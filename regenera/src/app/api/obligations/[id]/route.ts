import { type NextRequest } from 'next/server'
import { z } from 'zod'
import { requireAuthApi, requireOrgContextApi } from '@/lib/auth/guards'
import { createClient } from '@/lib/supabase/server'
import { apiSuccess, apiError } from '@/lib/utils'
import { trackEvent } from '@/lib/analytics/track'

const UpdateSchema = z.object({
  status: z.enum(['pending', 'in_progress', 'done', 'not_applicable']),
})

// PATCH /api/obligations/[id] — actualizar estado de una obligación
// Owner y member pueden actualizar — es la operación legítima del usuario (RLS lo permite).
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, error: authError } = await requireAuthApi()
  if (authError) return authError

  const { id } = await params
  if (!id) return apiError('ID de obligación requerido', 400)

  const body = await request.json().catch(() => null)
  const parsed = UpdateSchema.safeParse(body)
  if (!parsed.success) return apiError('Estado inválido', 400)

  const { ctx, error: ctxError } = await requireOrgContextApi(user.id)
  if (ctxError) return ctxError

  // createClient es suficiente: RLS policy "obligations_update_status" permite
  // UPDATE a todos los miembros activos de la organización.
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('organization_obligations')
    .update({
      status: parsed.data.status,
      completed_at: parsed.data.status === 'done' ? new Date().toISOString() : null,
    })
    .eq('id', id)
    .eq('organization_id', ctx.orgId)  // RLS extra — nunca actualizar otra org
    .select('id, status')
    .single()

  if (error || !data) return apiError('Obligación no encontrada', 404)

  if (parsed.data.status === 'done') {
    trackEvent('obligation_completed', {
      userId: user.id,
      orgId:  ctx.orgId,
      metadata: { obligation_id: id },
    })
  }

  return apiSuccess(data)
}
