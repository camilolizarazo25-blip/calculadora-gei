import { type NextRequest } from 'next/server'
import { z } from 'zod'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { requireAuthApi, requireOrgContextApi, requireOwnerApi } from '@/lib/auth/guards'
import { apiSuccess, apiError } from '@/lib/utils'

const InviteSchema = z.object({
  email: z.string().email(),
})

// POST /api/org/members — invitar miembro a la organización (solo owner)
export async function POST(request: NextRequest) {
  const { user, error: authError } = await requireAuthApi()
  if (authError) return authError

  const body = await request.json().catch(() => null)
  const parsed = InviteSchema.safeParse(body)
  if (!parsed.success) return apiError('Email inválido', 400)

  const { ctx, error: ctxError } = await requireOrgContextApi(user.id)
  if (ctxError) return ctxError
  if (!ctx.isActive) return apiError('Suscripción inactiva', 402, 'SUBSCRIPTION_INACTIVE')

  const ownerError = requireOwnerApi(ctx)
  if (ownerError) return ownerError

  // inviteUserByEmail requiere service role (admin API de Supabase)
  const serviceClient = await createServiceClient()

  // Verificar límite del plan — createClient es suficiente (RLS permite SELECT a miembros)
  const supabase = await createClient()
  const { count } = await supabase
    .from('organization_members')
    .select('*', { count: 'exact', head: true })
    .eq('organization_id', ctx.orgId)
    .eq('status', 'active')

  const currentCount = count ?? 0
  if (currentCount >= ctx.plan.max_users) {
    return apiError(
      `Tu plan permite máximo ${ctx.plan.max_users} usuario${ctx.plan.max_users > 1 ? 's' : ''}. Actualiza tu plan para agregar más.`,
      403,
      'USER_LIMIT_REACHED'
    )
  }

  // redirectTo: después de que el usuario acepta el email, Supabase redirige
  // a /auth/callback?code=xxx&next=/invite, donde establece su contraseña.
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  const { error: inviteError } = await serviceClient.auth.admin.inviteUserByEmail(
    parsed.data.email,
    {
      data: {
        organization_id: ctx.orgId,
        invited_by: user.id,
        role: 'member',
      },
      redirectTo: `${appUrl}/auth/callback?next=/invite`,
    }
  )

  if (inviteError) {
    console.error('Error invitando usuario:', inviteError)
    return apiError('Error enviando invitación. Verifica que el email sea válido.', 500)
  }

  return apiSuccess({ message: `Invitación enviada a ${parsed.data.email}` }, 201)
}

// GET /api/org/members — listar miembros de la organización
// createClient es suficiente: RLS policy "members_select" permite SELECT a todos los miembros activos
export async function GET() {
  const { user, error: authError } = await requireAuthApi()
  if (authError) return authError

  const { ctx, error: ctxError } = await requireOrgContextApi(user.id)
  if (ctxError) return ctxError

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('organization_members')
    .select('id, role, status, created_at, invited_by')
    .eq('organization_id', ctx.orgId)
    .neq('status', 'removed')
    .order('created_at', { ascending: true })

  if (error) return apiError('Error obteniendo miembros', 500)

  return apiSuccess(data ?? [])
}
