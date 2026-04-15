// Función de tracking reutilizable.
//
// Diseño intencional:
// - Retorna void (no Promise) — nunca se debe await
// - Atrapa todos los errores internamente
// - Nunca bloquea ni rompe el flujo del usuario
// - Solo se llama en server-side (API Routes y Server Components)

import { createAdminClient } from '@/lib/supabase/admin'

// Nombres de eventos válidos — tipados para evitar typos
export type AnalyticsEvent =
  | 'user_registered'       // DB trigger (no llamar manualmente)
  | 'subscription_created'  // DB trigger (no llamar manualmente)
  | 'onboarding_completed'
  | 'chat_used'
  | 'escalation_created'
  | 'obligation_completed'
  | 'dashboard_viewed'
  | 'subscription_activated'
  | 'subscription_canceled'

interface TrackParams {
  userId?: string | null
  orgId?:  string | null
  metadata?: Record<string, unknown>
}

/**
 * Registra un evento de producto en analytics_events.
 *
 * Uso:
 *   trackEvent('chat_used', { userId: user.id, orgId: ctx.orgId, metadata: { plan_id: 'basic' } })
 *
 * No usar await — es fire-and-forget por diseño.
 * Si el tracking falla, el usuario nunca lo nota.
 */
export function trackEvent(event: AnalyticsEvent, params: TrackParams = {}): void {
  const supabase = createAdminClient()

  const promise = supabase
    .from('analytics_events')
    .insert({
      event_name:      event,
      user_id:         params.userId  ?? null,
      organization_id: params.orgId   ?? null,
      metadata:        params.metadata ?? {},
    })

  Promise.resolve(promise)
    .then(({ error }) => {
      if (error) console.error(`[analytics] ${event}:`, error.message)
    })
    .catch((err: unknown) => {
      console.error(`[analytics] ${event}:`, err)
    })
}
