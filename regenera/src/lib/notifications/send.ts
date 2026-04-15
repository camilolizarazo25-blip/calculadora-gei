// Orquestador del sistema de notificaciones.
// Flujo por cada tipo:
//   detect → check cooldown → send email → log → next

import { createAdminClient } from '@/lib/supabase/admin'
import { sendEmail } from '@/lib/resend/client'
import {
  getOverdueOrgs,
  getCriticalOrgs,
  getInactiveOrgs,
  getHighUsageOrgs,
  type NotificationTarget,
} from './detect'
import { overdueEmail, criticalEmail, inactiveEmail, aiLimitEmail } from './templates'

// ── Tipos ─────────────────────────────────────────────────────
export type NotificationType = 'overdue' | 'critical' | 'inactive' | 'ai_limit'

export interface NotificationResult {
  sent: number
  skipped: number
  errors: number
}

// ── Cooldowns (días mínimos entre envíos del mismo tipo) ──────
const COOLDOWN_DAYS: Record<NotificationType, number> = {
  overdue:  3,   // Urgente, pero no cada día
  critical: 7,   // Una vez por semana
  inactive: 7,   // Una vez por semana
  ai_limit: 30,  // Una vez por período de facturación
}

// ── Verificar si ya se envió recientemente ────────────────────
async function wasRecentlySent(
  supabase: ReturnType<typeof createAdminClient>,
  orgId: string,
  type: NotificationType
): Promise<boolean> {
  const cooldown = COOLDOWN_DAYS[type]
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - cooldown)

  const { data } = await supabase
    .from('notification_logs')
    .select('id')
    .eq('org_id', orgId)
    .eq('type', type)
    .gte('sent_at', cutoff.toISOString())
    .limit(1)

  return (data?.length ?? 0) > 0
}

// ── Registrar notificación enviada ────────────────────────────
async function logSent(
  supabase: ReturnType<typeof createAdminClient>,
  orgId: string,
  userId: string,
  type: NotificationType
): Promise<void> {
  const { error } = await supabase
    .from('notification_logs')
    .insert({ org_id: orgId, user_id: userId, type })

  if (error) {
    // No es fatal — el email ya fue enviado. Solo log.
    console.error(`[notifications] Error logging ${type} for org ${orgId}:`, error.message)
  }
}

// ── Construir email para cada tipo ────────────────────────────
function buildEmail(
  type: NotificationType,
  target: NotificationTarget
): { subject: string; html: string } {
  const { orgName, data } = target

  switch (type) {
    case 'overdue':
      return overdueEmail(orgName, (data.overdueCount as number) ?? 1)
    case 'critical':
      return criticalEmail(orgName, (data.criticalCount as number) ?? 1)
    case 'inactive':
      return inactiveEmail(orgName)
    case 'ai_limit':
      return aiLimitEmail(
        orgName,
        (data.messagesUsed as number) ?? 0,
        (data.messagesLimit as number) ?? 1
      )
  }
}

// ── Procesar un tipo de notificación ──────────────────────────
async function processType(
  supabase: ReturnType<typeof createAdminClient>,
  type: NotificationType,
  targets: NotificationTarget[]
): Promise<NotificationResult> {
  let sent = 0, skipped = 0, errors = 0

  for (const target of targets) {
    try {
      const skip = await wasRecentlySent(supabase, target.orgId, type)
      if (skip) {
        skipped++
        continue
      }

      const email = buildEmail(type, target)
      await sendEmail({ to: target.userEmail, ...email })
      await logSent(supabase, target.orgId, target.userId, type)
      sent++

      console.log(`[notifications] ✓ ${type} → ${target.userEmail} (${target.orgName})`)
    } catch (err) {
      errors++
      console.error(`[notifications] ✗ ${type} → ${target.userEmail}:`, String(err))
    }
  }

  return { sent, skipped, errors }
}

// ── Job principal ─────────────────────────────────────────────
// Punto de entrada llamado por el cron endpoint.
// Detecta todos los targets en paralelo, luego procesa cada tipo.
export async function runNotificationJob(): Promise<
  Record<NotificationType, NotificationResult>
> {
  const supabase = createAdminClient()

  // Detección paralela — cada query es independiente
  const [overdueTargets, criticalTargets, inactiveTargets, highUsageTargets] =
    await Promise.all([
      getOverdueOrgs(),
      getCriticalOrgs(),
      getInactiveOrgs(),
      getHighUsageOrgs(),
    ])

  console.log('[notifications] Targets detectados:', {
    overdue:  overdueTargets.length,
    critical: criticalTargets.length,
    inactive: inactiveTargets.length,
    ai_limit: highUsageTargets.length,
  })

  // Envío secuencial por tipo para evitar saturar Resend
  const overdue  = await processType(supabase, 'overdue',  overdueTargets)
  const critical = await processType(supabase, 'critical', criticalTargets)
  const inactive = await processType(supabase, 'inactive', inactiveTargets)
  const ai_limit = await processType(supabase, 'ai_limit', highUsageTargets)

  return { overdue, critical, inactive, ai_limit }
}
