import { createClient } from '@/lib/supabase/server'
import { requireAuthApi } from '@/lib/auth/guards'
import { apiSuccess, apiError } from '@/lib/utils'

// GET /api/org — datos de la organización del usuario autenticado
export async function GET() {
  const { user, error: authError } = await requireAuthApi()
  if (authError) return authError

  const supabase = await createClient()

  const { data, error } = await supabase
    .from('organization_members')
    .select(`
      role,
      organizations (
        id, name, nit, sector, city, department,
        employee_count, profile, onboarding_completed_at,
        subscriptions (
          plan_id, status, trial_ends_at,
          current_period_start, current_period_end
        )
      )
    `)
    .eq('user_id', user.id)
    .eq('status', 'active')
    .single()

  if (error || !data) return apiError('Organización no encontrada', 404)

  return apiSuccess(data)
}
