import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Sidebar from '@/components/layout/Sidebar'
import TopBar from '@/components/layout/TopBar'

// ─── Responsabilidades de este layout ────────────────────────
//
// 1. Verificar sesión activa (sin sesión → /login)
// 2. Verificar que el usuario tenga org activa (sin org → /sin-organizacion)
// 3. Verificar onboarding completado — EXCEPTO si ya estamos en /onboarding
//    (evitar bucle infinito: layout detecta onboarding incompleto → redirect /onboarding
//     → layout corre de nuevo → redirect /onboarding → ∞)
//
// Lo que NO hace este layout:
//   - Validar roles (cada página/API Route lo hace)
//   - Consultar datos de negocio (solo lo mínimo para protección)

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // Leer pathname inyectado por el middleware (evita usePathname en Server Component)
  const headersList = await headers()
  const pathname = headersList.get('x-pathname') ?? ''

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Verificar membresía activa en alguna organización
  const { data: member } = await supabase
    .from('organization_members')
    .select('organizations(onboarding_completed_at)')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .single()

  // Sin organización → pantalla de error clara (no redirigir a login)
  if (!member) redirect('/sin-organizacion')

  const org = member.organizations as { onboarding_completed_at: string | null } | null

  // Onboarding incompleto → /onboarding
  // IMPORTANTE: excluir /onboarding del check para no crear bucle infinito
  if (!org?.onboarding_completed_at && pathname !== '/onboarding') {
    redirect('/onboarding')
  }

  // Onboarding completo intentando volver a /onboarding → /dashboard
  if (org?.onboarding_completed_at && pathname === '/onboarding') {
    redirect('/dashboard')
  }

  // Si estamos en /onboarding (sin completar), renderizar sin el shell del dashboard
  if (pathname === '/onboarding') {
    return <>{children}</>
  }

  return (
    <div className="flex h-screen bg-surface-50 overflow-hidden">
      <Sidebar />
      <div className="flex flex-col flex-1 overflow-hidden">
        <TopBar />
        <main className="flex-1 overflow-y-auto p-6">
          {children}
        </main>
      </div>
    </div>
  )
}
