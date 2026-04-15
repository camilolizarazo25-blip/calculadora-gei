import type { Metadata } from 'next'
import { requireAuth, requireOrgContext } from '@/lib/auth/guards'
import { formatCurrencyCOP, formatDateCO, daysUntil } from '@/lib/utils'
import { CheckoutButton } from '@/components/billing/CheckoutButton'

export const metadata: Metadata = { title: 'Mi cuenta' }

const PLAN_LABELS: Record<string, string> = {
  trial: 'Prueba gratuita',
  basic: 'Plan Básico',
  professional: 'Plan Profesional',
}

// Estado → color y texto del badge
function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { label: string; classes: string }> = {
    trialing:     { label: 'En prueba', classes: 'bg-blue-50 text-blue-700' },
    active:       { label: 'Activa',    classes: 'bg-brand-50 text-brand-700' },
    past_due:     { label: 'Vencida',   classes: 'bg-yellow-50 text-yellow-700' },
    cancelled:    { label: 'Cancelada', classes: 'bg-red-50 text-red-700' },
    inactive:     { label: 'Inactiva',  classes: 'bg-surface-100 text-surface-400' },
  }
  const { label, classes } = config[status] ?? { label: status, classes: 'bg-surface-100 text-surface-400' }
  return (
    <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${classes}`}>
      {label}
    </span>
  )
}

export default async function CuentaPage() {
  const user = await requireAuth()
  const ctx = await requireOrgContext(user.id)

  const isOwner = ctx.role === 'owner'
  const trialDays = ctx.trialEndsAt ? daysUntil(ctx.trialEndsAt) : null
  const trialExpired = ctx.subStatus === 'past_due' && ctx.plan.id === 'trial'

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-xl font-semibold text-surface-900">Mi cuenta</h1>
        <p className="text-sm text-surface-300">Configuración y suscripción</p>
      </div>

      {/* ── Información personal ─────────────────────────────── */}
      <div className="card space-y-3">
        <h2 className="font-medium text-surface-900">Información personal</h2>
        <div className="text-sm space-y-1.5">
          <p className="text-surface-300">
            Email: <span className="text-surface-900">{user.email}</span>
          </p>
          <p className="text-surface-300">
            Nombre: <span className="text-surface-900">
              {user.user_metadata?.full_name ?? 'No especificado'}
            </span>
          </p>
          <p className="text-surface-300">
            Organización: <span className="text-surface-900 font-medium">{ctx.orgName}</span>
          </p>
          <p className="text-surface-300">
            Rol: <span className="text-surface-900 capitalize">
              {ctx.role === 'owner' ? 'Administrador' : 'Miembro'}
            </span>
          </p>
        </div>
      </div>

      {/* ── Suscripción — solo visible para owner ─────────────── */}
      {isOwner && (
        <>
          {/* Banner de alerta si el acceso está bloqueado */}
          {!ctx.isActive && (
            <div className="bg-red-50 border border-red-200 rounded-2xl p-4">
              <p className="text-sm font-medium text-red-800">
                {ctx.subStatus === 'past_due'
                  ? 'Tu acceso está limitado — el período de prueba o pago venció'
                  : 'Tu suscripción está cancelada'}
              </p>
              <p className="text-xs text-red-600 mt-1">
                Suscríbete para restaurar el acceso completo al asesor IA y las funcionalidades.
              </p>
            </div>
          )}

          {/* Banner de trial por vencer */}
          {ctx.subStatus === 'trialing' && trialDays !== null && trialDays <= 5 && trialDays > 0 && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-2xl p-4">
              <p className="text-sm font-medium text-yellow-800">
                Tu prueba gratuita vence en {trialDays} día{trialDays !== 1 ? 's' : ''}
              </p>
              <p className="text-xs text-yellow-700 mt-1">
                Suscríbete hoy para no perder el acceso.
              </p>
            </div>
          )}

          {/* Estado de suscripción */}
          <div className="card space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-medium text-surface-900">Suscripción</h2>
              <StatusBadge status={ctx.subStatus} />
            </div>

            <div className="text-sm space-y-2">
              <div className="flex justify-between">
                <span className="text-surface-300">Plan</span>
                <span className="text-surface-900 font-medium">
                  {PLAN_LABELS[ctx.plan.id] ?? ctx.plan.name}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-surface-300">Precio</span>
                <span className="text-surface-900">
                  {ctx.plan.price_cop === 0 ? 'Gratis' : `${formatCurrencyCOP(ctx.plan.price_cop)}/mes`}
                </span>
              </div>
              {ctx.subStatus === 'trialing' && ctx.trialEndsAt && (
                <div className="flex justify-between">
                  <span className="text-surface-300">Trial vence</span>
                  <span className="text-surface-900">{formatDateCO(ctx.trialEndsAt)}</span>
                </div>
              )}
              {ctx.subStatus === 'active' && ctx.periodEnd && (
                <div className="flex justify-between">
                  <span className="text-surface-300">Próxima renovación</span>
                  <span className="text-surface-900">{formatDateCO(ctx.periodEnd)}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-surface-300">Consultas IA</span>
                <span className="text-surface-900">
                  {ctx.aiUsage.used} / {ctx.aiUsage.limit} usadas
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-surface-300">Usuarios</span>
                <span className="text-surface-900">{ctx.plan.max_users}</span>
              </div>
            </div>

            {/* Barra de uso IA */}
            <div>
              <div className="flex justify-between text-xs text-surface-300 mb-1">
                <span>Consultas IA este mes</span>
                <span>{ctx.aiUsage.percentage}%</span>
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
            </div>
          </div>

          {/* ── Planes disponibles para contratar/mejorar ──────── */}
          {(ctx.subStatus === 'trialing' || ctx.subStatus === 'past_due' || ctx.plan.id === 'basic') && (
            <div className="space-y-3">
              <h2 className="font-medium text-surface-900">
                {ctx.plan.id === 'professional' ? '' : 'Planes disponibles'}
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Plan Básico */}
                {ctx.plan.id !== 'basic' || !ctx.isActive ? (
                  <div className={`card space-y-3 ${ctx.plan.id === 'basic' && ctx.isActive ? 'border-brand-300 bg-brand-50/30' : ''}`}>
                    <div>
                      <p className="font-semibold text-surface-900">Plan Básico</p>
                      <p className="text-2xl font-bold text-brand-600 mt-1">
                        {formatCurrencyCOP(89_900)}
                        <span className="text-sm font-normal text-surface-300">/mes</span>
                      </p>
                    </div>
                    <ul className="text-sm text-surface-600 space-y-1">
                      <li>✓ 30 consultas IA / mes</li>
                      <li>✓ 1 usuario</li>
                      <li>✓ Soporte en 12 horas</li>
                      <li>✓ Gestión de obligaciones</li>
                    </ul>
                    <CheckoutButton
                      planId="basic"
                      planName="Básico"
                      priceCop={89_900}
                      className="btn-primary w-full text-sm"
                    />
                  </div>
                ) : null}

                {/* Plan Profesional */}
                <div className={`card space-y-3 relative ${ctx.plan.id === 'professional' && ctx.isActive ? 'border-brand-300' : ''}`}>
                  <div className="absolute -top-2 right-4">
                    <span className="bg-brand-600 text-white text-xs font-medium px-2 py-0.5 rounded-full">
                      Recomendado
                    </span>
                  </div>
                  <div>
                    <p className="font-semibold text-surface-900">Plan Profesional</p>
                    <p className="text-2xl font-bold text-brand-600 mt-1">
                      {formatCurrencyCOP(189_900)}
                      <span className="text-sm font-normal text-surface-300">/mes</span>
                    </p>
                  </div>
                  <ul className="text-sm text-surface-600 space-y-1">
                    <li>✓ 100 consultas IA / mes</li>
                    <li>✓ 2 usuarios</li>
                    <li>✓ Soporte en 4 horas</li>
                    <li>✓ Soporte WhatsApp</li>
                    <li>✓ Documentos ambientales</li>
                  </ul>
                  {ctx.plan.id === 'professional' && ctx.isActive ? (
                    <p className="text-sm text-brand-600 font-medium text-center py-2">
                      ✓ Plan activo
                    </p>
                  ) : (
                    <CheckoutButton
                      planId="professional"
                      planName="Profesional"
                      priceCop={189_900}
                      className="btn-primary w-full text-sm"
                    />
                  )}
                </div>
              </div>

              <p className="text-xs text-surface-300 text-center">
                El pago activa el plan inmediatamente por 30 días.
                Para renovar, repite el proceso antes del vencimiento.
              </p>
            </div>
          )}
        </>
      )}

      {/* Miembro sin acceso a suscripción */}
      {!isOwner && (
        <div className="card bg-surface-50">
          <p className="text-sm text-surface-300">
            La información de suscripción y pago solo es visible para el administrador de la organización.
          </p>
          <div className="mt-3 text-sm space-y-1.5">
            <div className="flex justify-between">
              <span className="text-surface-300">Plan</span>
              <span className="text-surface-900">{PLAN_LABELS[ctx.plan.id] ?? ctx.plan.name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-surface-300">Consultas IA disponibles</span>
              <span className="text-surface-900">{ctx.aiUsage.limit - ctx.aiUsage.used} restantes</span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
