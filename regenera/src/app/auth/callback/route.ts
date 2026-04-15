// Callback de Supabase Auth — maneja confirmación de email y OAuth
import { type NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const next = requestUrl.searchParams.get('next')

  if (code) {
    const supabase = await createClient()
    const { data, error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error && data.user) {
      // Determinar destino: si tiene `next` en la URL, respetarlo.
      // Si no, verificar si ya completó onboarding para elegir entre /onboarding y /dashboard.
      let destination = next ?? '/onboarding'

      if (!next) {
        const { data: member } = await supabase
          .from('organization_members')
          .select('organizations(onboarding_completed_at)')
          .eq('user_id', data.user.id)
          .eq('status', 'active')
          .single()

        const onboardingDone =
          (member?.organizations as unknown as { onboarding_completed_at: string | null } | null)
            ?.onboarding_completed_at

        destination = onboardingDone ? '/dashboard' : '/onboarding'
      }

      return NextResponse.redirect(`${requestUrl.origin}${destination}`)
    }
  }

  // En caso de error redirigir a login con indicador
  return NextResponse.redirect(`${requestUrl.origin}/login?error=auth_callback_error`)
}
