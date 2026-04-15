import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { requireAuth, requireOrgContext } from '@/lib/auth/guards'
import { getObligationUrgency } from '@/lib/utils'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Onboarding completado' }

export default async function OnboardingCompletadoPage({
  searchParams,
}: {
  searchParams: Promise<{ obligaciones?: string }>
}) {
  const user = await requireAuth()
  const ctx = await requireOrgContext(user.id)
  const params = await searchParams
  const supabase = await createClient()

  // Cargar obligaciones detectadas para mostrar valor inmediato
  const { data: obligations } = await supabase
    .from('organization_obligations')
    .select('*, template:obligation_templates(title, authority, priority, frequency)')
    .eq('organization_id', ctx.orgId)
    .order('created_at', { ascending: true })

  const items = obligations ?? []
  const obligationCount = items.length || parseInt(params.obligaciones ?? '0', 10)

  // Agrupar por prioridad para mostrar las más importantes primero
  const high   = items.filter((o) => (o.template as any)?.priority === 'high').slice(0, 4)
  const medium = items.filter((o) => (o.template as any)?.priority === 'medium').slice(0, 3)
  const shown  = [...high, ...medium].slice(0, 5)

  // Determinar riesgos principales para el mensaje de valor
  const hasHazardous = items.some((o) =>
    (o.template as any)?.code?.includes('RESPEL')
  )
  const hasEmissions = items.some((o) =>
    (o.template as any)?.code?.includes('EMISIONES')
  )
  const hasVertimientos = items.some((o) =>
    (o.template as any)?.code?.includes('VERTIMIENTOS')
  )

  return (
    <div className="min-h-screen bg-surface-50 flex items-start justify-center px-4 py-10">
      <div className="w-full max-w-xl space-y-6">

        {/* ── Header de éxito ──────────────────────────────── */}
        <div className="text-center">
          <div className="w-20 h-20 rounded-full bg-brand-100 flex items-center justify-center mx-auto mb-4">
            <svg className="w-10 h-10 text-brand-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-surface-900">
            ¡{ctx.orgName} ya está en Regenera!
          </h1>
          <p className="text-surface-400 mt-2 text-sm">
            Analizamos tu empresa y esto es lo que encontramos
          </p>
        </div>

        {/* ── Resultado: obligaciones detectadas ───────────── */}
        <div className="bg-white rounded-2xl border border-surface-200 p-6 shadow-sm">
          <div className="flex items-center gap-4 mb-5">
            <div className="w-14 h-14 rounded-2xl bg-brand-600 text-white text-2xl font-bold flex items-center justify-center flex-shrink-0">
              {obligationCount}
            </div>
            <div>
              <p className="font-semibold text-surface-900">
                {obligationCount === 1 ? 'obligación ambiental identificada' :
                 obligationCount === 0 ? 'obligaciones registradas' :
                 'obligaciones ambientales identificadas'}
              </p>
              <p className="text-sm text-surface-400">
                específicas para {ctx.orgName}
              </p>
            </div>
          </div>

          {/* Lista de obligaciones de alta prioridad */}
          {shown.length > 0 && (
            <div className="space-y-2 mb-4">
              {shown.map((ob, i) => {
                const template = ob.template as any
                const urgency  = getObligationUrgency(ob.due_date, ob.status)
                return (
                  <div key={ob.id ?? i} className="flex items-start gap-3 p-3 bg-surface-50 rounded-xl">
                    <div className={`mt-1 w-2 h-2 rounded-full flex-shrink-0 ${
                      template?.priority === 'high' ? 'bg-red-500' :
                      template?.priority === 'medium' ? 'bg-yellow-500' : 'bg-brand-500'
                    }`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-surface-900 leading-snug">
                        {template?.title}
                      </p>
                      <p className="text-xs text-surface-400 mt-0.5">{template?.authority}</p>
                    </div>
                    {template?.priority === 'high' && (
                      <span className="text-xs bg-red-50 text-red-600 font-medium px-2 py-0.5 rounded-full whitespace-nowrap flex-shrink-0">
                        Alta prioridad
                      </span>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          {obligationCount > shown.length && (
            <p className="text-xs text-surface-400 text-center pb-2">
              + {obligationCount - shown.length} obligaciones más en tu panel
            </p>
          )}

          <Link
            href="/obligaciones"
            className="btn-primary w-full text-center block"
          >
            Ver todas mis obligaciones →
          </Link>
        </div>

        {/* ── Riesgos detectados ───────────────────────────── */}
        {(hasHazardous || hasEmissions || hasVertimientos) && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-2xl p-5">
            <p className="text-sm font-semibold text-yellow-800 mb-3">
              Aspectos que requieren atención prioritaria:
            </p>
            <ul className="space-y-2 text-sm text-yellow-700">
              {hasHazardous && (
                <li className="flex items-start gap-2">
                  <span className="mt-0.5 flex-shrink-0">⚠️</span>
                  <span>
                    <strong>Residuos peligrosos:</strong> El registro como generador RESPEL ante la autoridad ambiental es obligatorio y tiene plazos definidos.
                  </span>
                </li>
              )}
              {hasEmissions && (
                <li className="flex items-start gap-2">
                  <span className="mt-0.5 flex-shrink-0">⚠️</span>
                  <span>
                    <strong>Emisiones atmosféricas:</strong> Operar fuentes fijas sin permiso puede generar sanciones de hasta 5.000 SMMLV.
                  </span>
                </li>
              )}
              {hasVertimientos && (
                <li className="flex items-start gap-2">
                  <span className="mt-0.5 flex-shrink-0">⚠️</span>
                  <span>
                    <strong>Vertimientos:</strong> Los vertimientos sin permiso son una de las causas más frecuentes de sanciones ambientales en Colombia.
                  </span>
                </li>
              )}
            </ul>
          </div>
        )}

        {/* ── CTA Chat ─────────────────────────────────────── */}
        <div className="bg-brand-600 rounded-2xl p-6 text-center">
          <p className="text-lg font-semibold text-white mb-2">
            ¿Por dónde empezar?
          </p>
          <p className="text-brand-100 text-sm mb-5">
            Nuestro asesor ambiental ya conoce el perfil de {ctx.orgName}.
            Pregúntale qué hacer primero.
          </p>
          <Link
            href="/chat"
            className="inline-block bg-white text-brand-700 font-semibold px-6 py-3 rounded-xl hover:bg-brand-50 transition-colors"
          >
            Hablar con el asesor →
          </Link>
        </div>

        {/* ── Accesos rápidos ──────────────────────────────── */}
        <div className="grid grid-cols-2 gap-3">
          <Link
            href="/dashboard"
            className="bg-white border border-surface-200 rounded-xl p-4 text-center hover:border-brand-300 transition-colors"
          >
            <p className="text-2xl mb-1">📊</p>
            <p className="text-sm font-medium text-surface-800">Ver dashboard</p>
            <p className="text-xs text-surface-400 mt-0.5">Estado general</p>
          </Link>
          <Link
            href="/obligaciones"
            className="bg-white border border-surface-200 rounded-xl p-4 text-center hover:border-brand-300 transition-colors"
          >
            <p className="text-2xl mb-1">📋</p>
            <p className="text-sm font-medium text-surface-800">Mis obligaciones</p>
            <p className="text-xs text-surface-400 mt-0.5">{obligationCount} identificadas</p>
          </Link>
        </div>

        <p className="text-xs text-surface-400 text-center pb-4">
          Puedes actualizar el perfil de tu empresa en cualquier momento desde Configuración.
        </p>
      </div>
    </div>
  )
}
