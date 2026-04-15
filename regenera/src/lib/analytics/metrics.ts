// Queries de métricas para el panel /admin/analytics.
// Usa el admin client para leer todas las organizaciones sin RLS.
// Todas las queries corren en paralelo para minimizar latencia.

import { createAdminClient } from '@/lib/supabase/admin'

export interface AdminMetrics {
  // Usuarios
  totalUsers: number
  activeUsers7d: number
  activeUsers30d: number

  // Funnel de activación
  totalOrgs: number
  orgsWithOnboarding: number
  onboardingRate: number        // porcentaje (0–100)

  // Uso del producto
  totalChats: number
  totalTasksCompleted: number
  totalEscalations: number

  // Negocio
  activeSubscriptions: number   // status = 'active'
  trialingSubscriptions: number // status = 'trialing'
  paidConversionRate: number    // orgs active / total orgs (%)
  totalRevenueCOP: number       // suma de amount_cop de subs activas
}

export async function getAdminMetrics(): Promise<AdminMetrics> {
  const supabase = createAdminClient()

  const now = new Date()
  const ago7d  = new Date(now.getTime() - 7  * 24 * 60 * 60 * 1000).toISOString()
  const ago30d = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString()
  const currentPeriodStart = new Date(now.getFullYear(), now.getMonth(), 1)
    .toISOString().split('T')[0]!

  const [
    usersResult,
    activeUsers7dResult,
    activeUsers30dResult,
    orgsResult,
    onboardingResult,
    chatsResult,
    tasksResult,
    escalationsResult,
    subsResult,
    revenueResult,
  ] = await Promise.all([

    // Total usuarios únicos con eventos
    supabase
      .from('analytics_events')
      .select('user_id', { count: 'exact', head: true })
      .eq('event_name', 'user_registered'),

    // Usuarios activos 7d — distintos user_ids con cualquier evento
    supabase
      .from('analytics_events')
      .select('user_id')
      .not('user_id', 'is', null)
      .gte('created_at', ago7d),

    // Usuarios activos 30d
    supabase
      .from('analytics_events')
      .select('user_id')
      .not('user_id', 'is', null)
      .gte('created_at', ago30d),

    // Total organizaciones
    supabase
      .from('organizations')
      .select('id', { count: 'exact', head: true }),

    // Orgs con onboarding completado
    supabase
      .from('organizations')
      .select('id', { count: 'exact', head: true })
      .not('onboarding_completed_at', 'is', null),

    // Total chats (mensajes de usuario en el período actual)
    supabase
      .from('chat_messages')
      .select('id', { count: 'exact', head: true })
      .eq('role', 'user'),

    // Tareas completadas totales
    supabase
      .from('organization_obligations')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'done'),

    // Escalaciones totales
    supabase
      .from('escalations')
      .select('id', { count: 'exact', head: true }),

    // Suscripciones por estado
    supabase
      .from('subscriptions')
      .select('status'),

    // Revenue: suma de amount_cop de suscripciones activas
    supabase
      .from('subscriptions')
      .select('amount_cop')
      .eq('status', 'active')
      .not('amount_cop', 'is', null),
  ])

  // Calcular usuarios activos únicos (el select trae filas, deduplicamos client-side)
  const activeUsers7d  = new Set((activeUsers7dResult.data  ?? []).map(r => r.user_id)).size
  const activeUsers30d = new Set((activeUsers30dResult.data ?? []).map(r => r.user_id)).size

  // Suscripciones por estado
  const allSubs = subsResult.data ?? []
  const activeSubscriptions   = allSubs.filter(s => s.status === 'active').length
  const trialingSubscriptions = allSubs.filter(s => s.status === 'trialing').length

  // Métricas derivadas
  const totalOrgs          = orgsResult.count ?? 0
  const orgsWithOnboarding = onboardingResult.count ?? 0
  const onboardingRate     = totalOrgs > 0
    ? Math.round((orgsWithOnboarding / totalOrgs) * 100)
    : 0

  const paidConversionRate = totalOrgs > 0
    ? Math.round((activeSubscriptions / totalOrgs) * 100)
    : 0

  const totalRevenueCOP = (revenueResult.data ?? [])
    .reduce((sum, s) => sum + (s.amount_cop ?? 0), 0)

  return {
    totalUsers:          usersResult.count ?? 0,
    activeUsers7d,
    activeUsers30d,
    totalOrgs,
    orgsWithOnboarding,
    onboardingRate,
    totalChats:          chatsResult.count ?? 0,
    totalTasksCompleted: tasksResult.count ?? 0,
    totalEscalations:    escalationsResult.count ?? 0,
    activeSubscriptions,
    trialingSubscriptions,
    paidConversionRate,
    totalRevenueCOP,
  }
}

// ── Funnel de conversión (últimos N días) ─────────────────────
// Responde: ¿dónde se caen los usuarios?
export interface FunnelStep {
  label: string
  count: number
  pct: number   // % del paso anterior
}

export async function getConversionFunnel(days = 30): Promise<FunnelStep[]> {
  const supabase = createAdminClient()
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()

  const [registered, onboarded, chatted, activated] = await Promise.all([
    supabase
      .from('analytics_events')
      .select('organization_id', { count: 'exact', head: true })
      .eq('event_name', 'user_registered')
      .gte('created_at', since),

    supabase
      .from('analytics_events')
      .select('organization_id', { count: 'exact', head: true })
      .eq('event_name', 'onboarding_completed')
      .gte('created_at', since),

    supabase
      .from('analytics_events')
      .select('organization_id')
      .eq('event_name', 'chat_used')
      .gte('created_at', since),

    supabase
      .from('analytics_events')
      .select('organization_id', { count: 'exact', head: true })
      .eq('event_name', 'subscription_activated')
      .gte('created_at', since),
  ])

  const r = registered.count ?? 0
  const o = onboarded.count ?? 0
  const c = new Set((chatted.data ?? []).map(e => e.organization_id)).size
  const a = activated.count ?? 0

  const pct = (n: number, base: number) => base > 0 ? Math.round((n / base) * 100) : 0

  return [
    { label: 'Registros',         count: r, pct: 100         },
    { label: 'Onboarding',        count: o, pct: pct(o, r)   },
    { label: 'Primer chat',       count: c, pct: pct(c, r)   },
    { label: 'Pago completado',   count: a, pct: pct(a, r)   },
  ]
}
