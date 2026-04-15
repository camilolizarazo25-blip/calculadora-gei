import type { Metadata } from 'next'
import { getAdminMetrics, getConversionFunnel } from '@/lib/analytics/metrics'

export const metadata: Metadata = { title: 'Analytics — Admin' }

// Revalidar cada 5 minutos — no necesita ser real-time
export const revalidate = 300

export default async function AdminAnalyticsPage() {
  const [metrics, funnel] = await Promise.all([
    getAdminMetrics(),
    getConversionFunnel(30),
  ])

  const formatCOP = (n: number) =>
    new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n)

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-5xl mx-auto space-y-8">

        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Analytics</h1>
          <p className="text-sm text-gray-500 mt-1">
            Panel interno Regenera · Actualiza cada 5 min
          </p>
        </div>

        {/* ── Fila 1: Usuarios ─────────────────────────────── */}
        <section>
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
            Usuarios
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <Stat
              label="Registros totales"
              value={metrics.totalUsers}
            />
            <Stat
              label="Activos 7 días"
              value={metrics.activeUsers7d}
              sub={`${metrics.totalUsers > 0 ? Math.round((metrics.activeUsers7d / metrics.totalUsers) * 100) : 0}% del total`}
            />
            <Stat
              label="Activos 30 días"
              value={metrics.activeUsers30d}
              sub={`${metrics.totalUsers > 0 ? Math.round((metrics.activeUsers30d / metrics.totalUsers) * 100) : 0}% del total`}
            />
            <Stat
              label="Onboarding completado"
              value={`${metrics.onboardingRate}%`}
              sub={`${metrics.orgsWithOnboarding} de ${metrics.totalOrgs} orgs`}
            />
          </div>
        </section>

        {/* ── Fila 2: Uso del producto ─────────────────────── */}
        <section>
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
            Uso del producto
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            <Stat
              label="Chats totales"
              value={metrics.totalChats}
              sub={metrics.totalOrgs > 0 ? `${(metrics.totalChats / metrics.totalOrgs).toFixed(1)} por empresa` : undefined}
            />
            <Stat
              label="Tareas completadas"
              value={metrics.totalTasksCompleted}
            />
            <Stat
              label="Escalaciones creadas"
              value={metrics.totalEscalations}
              sub={metrics.totalChats > 0 ? `${Math.round((metrics.totalEscalations / metrics.totalChats) * 100)}% de los chats` : undefined}
            />
          </div>
        </section>

        {/* ── Fila 3: Negocio ──────────────────────────────── */}
        <section>
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
            Negocio
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <Stat
              label="Suscripciones activas"
              value={metrics.activeSubscriptions}
              highlight
            />
            <Stat
              label="En período trial"
              value={metrics.trialingSubscriptions}
            />
            <Stat
              label="Conversión a pago"
              value={`${metrics.paidConversionRate}%`}
              sub="Registro → activo"
              highlight={metrics.paidConversionRate > 0}
            />
            <Stat
              label="Revenue total"
              value={formatCOP(metrics.totalRevenueCOP)}
              sub="Subs activas"
              highlight={metrics.totalRevenueCOP > 0}
            />
          </div>
        </section>

        {/* ── Funnel de conversión (últimos 30 días) ────────── */}
        <section>
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
            Funnel de conversión · últimos 30 días
          </h2>
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            {funnel.map((step, i) => (
              <div
                key={step.label}
                className={`flex items-center justify-between px-5 py-4 ${
                  i < funnel.length - 1 ? 'border-b border-gray-100' : ''
                }`}
              >
                <div className="flex items-center gap-4">
                  <span className="text-xs text-gray-400 w-4 font-mono">{i + 1}</span>
                  <span className="text-sm font-medium text-gray-800">{step.label}</span>
                </div>
                <div className="flex items-center gap-6">
                  {/* Barra proporcional */}
                  <div className="w-32 hidden sm:block">
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-2 bg-green-500 rounded-full transition-all"
                        style={{ width: `${step.pct}%` }}
                      />
                    </div>
                  </div>
                  <span className="text-sm text-gray-500 w-8 text-right">{step.pct}%</span>
                  <span className="text-sm font-semibold text-gray-900 w-10 text-right">
                    {step.count}
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* Diagnóstico automático */}
          <FunnelInsight funnel={funnel} />
        </section>

        {/* ── Resumen de estado ─────────────────────────────── */}
        <section className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">
            Estado del negocio
          </h2>
          <div className="space-y-2 text-sm text-gray-700">
            <StatusLine
              label="Activación"
              value={metrics.onboardingRate}
              good={50}
              ok={25}
              suffix="%"
              description="usuarios que completan onboarding"
            />
            <StatusLine
              label="Retención 7d"
              value={metrics.totalUsers > 0 ? Math.round((metrics.activeUsers7d / metrics.totalUsers) * 100) : 0}
              good={40}
              ok={20}
              suffix="%"
              description="usuarios activos en últimos 7 días"
            />
            <StatusLine
              label="Conversión a pago"
              value={metrics.paidConversionRate}
              good={10}
              ok={3}
              suffix="%"
              description="orgs con suscripción activa"
            />
            <StatusLine
              label="Uso de chat"
              value={metrics.totalOrgs > 0 ? metrics.totalChats / metrics.totalOrgs : 0}
              good={5}
              ok={2}
              suffix=" chats/org"
              description="promedio de consultas por organización"
              decimals={1}
            />
          </div>
        </section>

      </div>
    </div>
  )
}

// ─── Componentes internos ────────────────────────────────────

function Stat({
  label,
  value,
  sub,
  highlight = false,
}: {
  label: string
  value: string | number
  sub?: string
  highlight?: boolean
}) {
  return (
    <div className={`bg-white rounded-xl border p-4 ${
      highlight ? 'border-green-300 bg-green-50' : 'border-gray-200'
    }`}>
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <p className={`text-2xl font-bold ${highlight ? 'text-green-700' : 'text-gray-900'}`}>
        {value}
      </p>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
    </div>
  )
}

function StatusLine({
  label,
  value,
  good,
  ok,
  suffix,
  description,
  decimals = 0,
}: {
  label: string
  value: number
  good: number
  ok: number
  suffix: string
  description: string
  decimals?: number
}) {
  const status = value >= good ? 'good' : value >= ok ? 'ok' : 'bad'
  const dot: Record<string, string> = {
    good: 'bg-green-500',
    ok:   'bg-yellow-400',
    bad:  'bg-red-400',
  }
  return (
    <div className="flex items-center gap-3">
      <span className={`w-2 h-2 rounded-full flex-shrink-0 ${dot[status]}`} />
      <span className="font-medium w-36 flex-shrink-0">{label}</span>
      <span className="text-gray-900 font-semibold">
        {value.toFixed(decimals)}{suffix}
      </span>
      <span className="text-gray-400 text-xs">{description}</span>
    </div>
  )
}

function FunnelInsight({
  funnel,
}: {
  funnel: Array<{ label: string; count: number; pct: number }>
}) {
  const [reg, onb, chat, paid] = funnel

  // Detectar el mayor punto de caída
  const drops = [
    { step: 'Registro → Onboarding', drop: (reg?.count ?? 0) - (onb?.count ?? 0), pct: 100 - (onb?.pct ?? 0) },
    { step: 'Onboarding → Primer chat', drop: (onb?.count ?? 0) - (chat?.count ?? 0), pct: (onb?.pct ?? 0) - (chat?.pct ?? 0) },
    { step: 'Primer chat → Pago', drop: (chat?.count ?? 0) - (paid?.count ?? 0), pct: (chat?.pct ?? 0) - (paid?.pct ?? 0) },
  ]

  const worst = drops.reduce((a, b) => (b.drop > a.drop ? b : a), drops[0]!)

  if ((reg?.count ?? 0) === 0) return null

  return (
    <div className="mt-3 bg-yellow-50 border border-yellow-200 rounded-lg px-4 py-3">
      <p className="text-sm text-yellow-800">
        <span className="font-semibold">Mayor punto de caída:</span>{' '}
        {worst.step} — {worst.drop} usuario{worst.drop !== 1 ? 's' : ''} ({worst.pct}% de bajada)
      </p>
    </div>
  )
}
