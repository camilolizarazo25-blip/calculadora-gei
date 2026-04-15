import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { requireAuth, requireOrgContext } from '@/lib/auth/guards'
import { daysUntil } from '@/lib/utils'
import {
  calculateDashboardStatus,
  getPriorityTasks,
  type ObligationItem,
} from '@/lib/dashboard'
import { TrafficLightBadge } from '@/components/dashboard/TrafficLightBadge'
import { TaskCard } from '@/components/dashboard/TaskCard'
import { ComplianceRing } from '@/components/dashboard/ComplianceRing'
import { ObligationsTimeline } from '@/components/dashboard/ObligationsTimeline'
import { trackEvent } from '@/lib/analytics/track'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Dashboard' }

export default async function DashboardPage() {
  const user = await requireAuth()
  const ctx = await requireOrgContext(user.id)
  const supabase = await createClient()

  // Cargar todas las obligaciones + fecha de onboarding para detectar primera visita
  const [obligationsResult, orgResult] = await Promise.all([
    supabase
      .from('organization_obligations')
      .select('id, status, due_date, template:obligation_templates(title, authority, priority)')
      .eq('organization_id', ctx.orgId)
      .order('due_date', { ascending: true, nullsFirst: false }),
    supabase
      .from('organizations')
      .select('onboarding_completed_at, sector, city')
      .eq('id', ctx.orgId)
      .single(),
  ])

  // Transformar a ObligationItem con urgencia calculada
  const obligations: ObligationItem[] = (obligationsResult.data ?? []).map((ob) => {
    const template = ob.template as { title: string; authority: string; priority: string } | null
    const days = ob.due_date ? daysUntil(ob.due_date) : null

    let urgency: ObligationItem['urgency']
    if (ob.status === 'done' || ob.status === 'not_applicable') {
      urgency = 'done'
    } else if (days !== null && days < 0) {
      urgency = 'overdue'
    } else if (days !== null && days <= 7) {
      urgency = 'critical'
    } else if (days !== null && days <= 30) {
      urgency = 'warning'
    } else {
      urgency = 'ok'
    }

    return {
      id: ob.id,
      title: template?.title ?? 'Obligación',
      authority: template?.authority ?? '',
      priority: (template?.priority ?? 'medium') as ObligationItem['priority'],
      status: ob.status as ObligationItem['status'],
      due_date: ob.due_date,
      urgency,
      daysLeft: days,
    }
  })

  const status = calculateDashboardStatus(obligations)
  const tasks = getPriorityTasks(obligations)

  // Fire-and-forget — nunca bloquea el render
  trackEvent('dashboard_viewed', {
    userId: user.id,
    orgId:  ctx.orgId,
    metadata: {
      overdue_count:  status.overdueCount,
      critical_count: status.criticalCount,
      compliance_pct: status.compliancePercent,
    },
  })

  // ── Detectar primera visita ───────────────────────────────
  // "Primera visita" = onboarding completado hace menos de 48 horas.
  // No necesita cookies ni localStorage — el timestamp ya está en DB.
  const onboardingAt = orgResult.data?.onboarding_completed_at
  const isFirstVisit = onboardingAt
    ? Date.now() - new Date(onboardingAt).getTime() < 48 * 60 * 60 * 1000
    : false

  const firstName = user.user_metadata?.full_name?.split(' ')[0] ?? null
  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Buenos días' : hour < 18 ? 'Buenas tardes' : 'Buenas noches'
  const hasObligations = obligations.length > 0
  const orgCity = orgResult.data?.city ?? 'Colombia'
  const orgSector = orgResult.data?.sector ?? 'tu sector'

  const trialDaysLeft = ctx.trialEndsAt ? daysUntil(ctx.trialEndsAt) : null

  return (
    <div className="space-y-5 max-w-3xl">

      {/* ── Banner de suscripción inactiva ────────────────── */}
      {!ctx.isActive && ctx.role === 'owner' && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-4 flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-red-800">Acceso limitado — suscripción vencida</p>
            <p className="text-xs text-red-600 mt-0.5">
              El asesor IA no está disponible. Activa un plan para restaurar el acceso completo.
            </p>
          </div>
          <Link href="/cuenta" className="bg-red-600 text-white text-sm font-medium px-4 py-2 rounded-xl hover:bg-red-700 transition-colors whitespace-nowrap flex-shrink-0">
            Activar plan
          </Link>
        </div>
      )}

      {ctx.subStatus === 'trialing' && trialDaysLeft !== null && trialDaysLeft <= 5 && trialDaysLeft > 0 && ctx.role === 'owner' && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-2xl p-3.5 flex items-center justify-between gap-4">
          <p className="text-sm text-yellow-800">
            <span className="font-semibold">
              Tu prueba vence en {trialDaysLeft} día{trialDaysLeft !== 1 ? 's' : ''}.
            </span>{' '}
            Suscríbete para no perder el acceso.
          </p>
          <Link href="/cuenta" className="text-sm font-semibold text-yellow-800 underline whitespace-nowrap flex-shrink-0">
            Ver planes
          </Link>
        </div>
      )}

      {/* ── 1. Header contextual ─────────────────────────── */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-semibold text-surface-900">
            {greeting}{firstName ? `, ${firstName}` : ''}
          </h1>
          <p className="text-sm text-surface-400 mt-0.5">{ctx.orgName}</p>
        </div>
        {hasObligations && (
          <TrafficLightBadge light={status.light} label={status.label} />
        )}
      </div>

      {/* ── 2. "Wow moment" — primera visita ─────────────── */}
      {isFirstVisit && tasks.length > 0 && (
        <div className="bg-brand-50 border border-brand-200 rounded-2xl p-5">
          <div className="flex items-start gap-3">
            <span className="text-2xl flex-shrink-0">🎯</span>
            <div>
              <p className="font-semibold text-brand-900">
                Estas son las {Math.min(tasks.length, 3)} cosas más importantes para {ctx.orgName} hoy
              </p>
              <p className="text-sm text-brand-700 mt-1">
                Analizamos tu perfil y encontramos {obligations.length} obligación{obligations.length !== 1 ? 'es' : ''} aplicables.
                Te mostramos las más urgentes primero.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ── 3. Bloque de alertas (urgencia visible) ───────── */}
      {(status.overdueCount > 0 || status.criticalCount > 0) && (
        <div className="space-y-2">
          {status.overdueCount > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <span className="w-2 h-2 rounded-full bg-red-500 flex-shrink-0" />
                <p className="text-sm font-medium text-red-800">
                  {status.overdueCount === 1
                    ? 'Tienes 1 obligación vencida que requiere acción inmediata'
                    : `Tienes ${status.overdueCount} obligaciones vencidas que requieren acción inmediata`}
                </p>
              </div>
              <Link href="/obligaciones" className="text-xs font-semibold text-red-700 hover:text-red-900 underline whitespace-nowrap flex-shrink-0">
                Gestionar →
              </Link>
            </div>
          )}
          {status.criticalCount > 0 && (
            <div className="bg-orange-50 border border-orange-200 rounded-xl px-4 py-3 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <span className="w-2 h-2 rounded-full bg-orange-500 flex-shrink-0" />
                <p className="text-sm font-medium text-orange-800">
                  {status.criticalCount === 1
                    ? '1 obligación vence esta semana'
                    : `${status.criticalCount} obligaciones vencen esta semana`}
                </p>
              </div>
              <Link href="/obligaciones" className="text-xs font-semibold text-orange-700 hover:text-orange-900 underline whitespace-nowrap flex-shrink-0">
                Ver →
              </Link>
            </div>
          )}
        </div>
      )}

      {/* ── Empty state inteligente — sin obligaciones ────── */}
      {!hasObligations && (
        <div className="bg-white border border-surface-200 rounded-2xl p-6 space-y-4">
          <div className="flex items-start gap-3">
            <span className="text-2xl flex-shrink-0">🌱</span>
            <div>
              <p className="font-semibold text-surface-900">
                Ya analizamos el perfil de {ctx.orgName}
              </p>
              <p className="text-sm text-surface-400 mt-1">
                Completa el onboarding para identificar tus obligaciones ambientales y activar el asesor personalizado.
              </p>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row gap-3">
            <Link href="/onboarding" className="btn-primary text-sm text-center flex-1">
              Configurar mi empresa →
            </Link>
            {ctx.isActive && (
              <Link
                href={`/chat?q=${encodeURIComponent(`¿Qué obligaciones ambientales aplican a una empresa del sector ${orgSector} en ${orgCity}?`)}`}
                className="text-sm text-center flex-1 px-4 py-2.5 rounded-xl border border-brand-300 text-brand-700 hover:bg-brand-50 transition-colors font-medium"
              >
                Preguntar al asesor →
              </Link>
            )}
          </div>
        </div>
      )}

      {/* ── 4. "Qué hacer hoy" ───────────────────────────── */}
      {tasks.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="font-semibold text-surface-900">Qué hacer hoy</h2>
              <p className="text-xs text-surface-400 mt-0.5">{status.description}</p>
            </div>
            <Link href="/obligaciones" className="text-xs text-brand-600 hover:underline font-medium">
              Ver todas ({obligations.length}) →
            </Link>
          </div>

          <div className="space-y-2">
            {tasks.map((task, i) => (
              <TaskCard
                key={task.id}
                item={task}
                rank={i + 1}
                highlight={isFirstVisit && i < 3}
              />
            ))}
          </div>

          {obligations.filter(o => o.urgency !== 'done').length > tasks.length && (
            <Link
              href="/obligaciones"
              className="block text-center text-sm text-surface-400 hover:text-brand-600 mt-3 transition-colors"
            >
              + {obligations.filter(o => o.urgency !== 'done').length - tasks.length} más pendientes →
            </Link>
          )}
        </section>
      )}

      {/* ── 5. Timeline por mes ──────────────────────────── */}
      {hasObligations && (
        <ObligationsTimeline obligations={obligations} />
      )}

      {/* ── 6. Cumplimiento + contadores ─────────────────── */}
      {hasObligations && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="card">
            <ComplianceRing
              percent={status.compliancePercent}
              doneCount={status.doneCount}
              totalCount={obligations.length}
            />
          </div>
          <div className="card grid grid-cols-2 gap-4">
            <div>
              <p className={`text-2xl font-bold ${status.overdueCount > 0 ? 'text-red-600' : 'text-surface-300'}`}>
                {status.overdueCount}
              </p>
              <p className="text-xs text-surface-400 mt-0.5">Vencidas</p>
            </div>
            <div>
              <p className={`text-2xl font-bold ${status.criticalCount > 0 ? 'text-orange-500' : 'text-surface-300'}`}>
                {status.criticalCount}
              </p>
              <p className="text-xs text-surface-400 mt-0.5">Esta semana</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-surface-800">{status.pendingCount}</p>
              <p className="text-xs text-surface-400 mt-0.5">Pendientes</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-brand-600">{status.doneCount}</p>
              <p className="text-xs text-surface-400 mt-0.5">Cumplidas</p>
            </div>
          </div>
        </div>
      )}

      {/* ── 7. Uso de IA — conectado con valor ───────────── */}
      {ctx.isActive && (
        <div className="card py-4">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-1.5">
                <p className="text-sm font-medium text-surface-800">Consultas con el asesor</p>
                <p className="text-sm font-semibold text-surface-900">
                  {ctx.aiUsage.used}
                  <span className="text-surface-400 font-normal"> / {ctx.aiUsage.limit}</span>
                </p>
              </div>
              <div className="h-2 bg-surface-100 rounded-full">
                <div
                  className={`h-2 rounded-full transition-all ${
                    ctx.aiUsage.percentage >= 90 ? 'bg-red-500' :
                    ctx.aiUsage.percentage >= 70 ? 'bg-yellow-500' : 'bg-brand-500'
                  }`}
                  style={{ width: `${Math.min(ctx.aiUsage.percentage, 100)}%` }}
                />
              </div>

              {/* Mensaje conectado al valor — no al límite */}
              <p className="text-xs text-surface-400 mt-1.5">
                {ctx.aiUsage.limit - ctx.aiUsage.used === 0
                  ? 'Límite alcanzado este mes — tu próxima pregunta se envía a un asesor humano'
                  : ctx.aiUsage.limit - ctx.aiUsage.used <= 3
                  ? `Te quedan ${ctx.aiUsage.limit - ctx.aiUsage.used} consulta${ctx.aiUsage.limit - ctx.aiUsage.used !== 1 ? 's' : ''} — úsalas para resolver tus obligaciones más urgentes`
                  : status.overdueCount > 0 || status.criticalCount > 0
                  ? 'Usa el asesor para entender cómo gestionar tus obligaciones urgentes'
                  : `${ctx.aiUsage.limit - ctx.aiUsage.used} consultas disponibles este mes`}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ── 8. CTA Chat ──────────────────────────────────── */}
      <div className={`rounded-2xl p-5 flex items-center justify-between gap-4 flex-wrap ${
        ctx.isActive ? 'bg-brand-600' : 'bg-surface-100 border border-surface-200'
      }`}>
        <div>
          <p className={`font-semibold ${ctx.isActive ? 'text-white' : 'text-surface-500'}`}>
            {ctx.isActive
              ? status.overdueCount > 0
                ? '¿No sabes cómo resolver las obligaciones vencidas?'
                : '¿Tienes dudas sobre tu cumplimiento ambiental?'
              : 'Asesor IA no disponible'}
          </p>
          <p className={`text-sm mt-0.5 ${ctx.isActive ? 'text-brand-100' : 'text-surface-400'}`}>
            {ctx.isActive
              ? `El asesor ya conoce el perfil de ${ctx.orgName}. Pregúntale qué hacer primero.`
              : 'Activa un plan para acceder al asesor ambiental IA.'}
          </p>
        </div>
        {ctx.isActive ? (
          <Link
            href={status.overdueCount > 0
              ? `/chat?q=${encodeURIComponent('Tengo obligaciones ambientales vencidas. ¿Por cuál debo empezar y qué debo hacer?')}`
              : '/chat'}
            className="bg-white text-brand-700 font-semibold text-sm px-5 py-2.5 rounded-xl hover:bg-brand-50 transition-colors whitespace-nowrap flex-shrink-0"
          >
            {status.overdueCount > 0 ? 'Resolver con el asesor →' : 'Consultar al asesor →'}
          </Link>
        ) : (
          <Link href="/cuenta" className="btn-primary text-sm whitespace-nowrap flex-shrink-0">
            Activar plan
          </Link>
        )}
      </div>

    </div>
  )
}
