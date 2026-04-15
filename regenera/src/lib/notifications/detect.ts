// Funciones de detección de usuarios que necesitan notificación.
// Usan el admin client (service role) para consultar la DB directamente.
// Cada función retorna los targets para UN tipo de notificación.

import { createAdminClient } from '@/lib/supabase/admin'

export interface NotificationTarget {
  orgId: string
  orgName: string
  userId: string
  userEmail: string
  data: Record<string, number | string | null>
}

// ── 1. Orgs con obligaciones vencidas (due_date < hoy) ────────
export async function getOverdueOrgs(): Promise<NotificationTarget[]> {
  const supabase = createAdminClient()

  const { data, error } = await supabase.rpc('get_overdue_notification_targets')
  if (error) throw new Error(`getOverdueOrgs: ${error.message}`)

  return (data ?? []).map((row: {
    org_id: string
    org_name: string
    user_id: string
    user_email: string
    overdue_count: number
  }) => ({
    orgId: row.org_id,
    orgName: row.org_name,
    userId: row.user_id,
    userEmail: row.user_email,
    data: { overdueCount: row.overdue_count },
  }))
}

// ── 2. Orgs con obligaciones que vencen en ≤7 días ────────────
export async function getCriticalOrgs(): Promise<NotificationTarget[]> {
  const supabase = createAdminClient()

  const { data, error } = await supabase.rpc('get_critical_notification_targets')
  if (error) throw new Error(`getCriticalOrgs: ${error.message}`)

  return (data ?? []).map((row: {
    org_id: string
    org_name: string
    user_id: string
    user_email: string
    critical_count: number
  }) => ({
    orgId: row.org_id,
    orgName: row.org_name,
    userId: row.user_id,
    userEmail: row.user_email,
    data: { criticalCount: row.critical_count },
  }))
}

// ── 3. Owners inactivos (sin login en 4+ días) ────────────────
// Solo orgs con onboarding completo y obligaciones pendientes.
export async function getInactiveOrgs(): Promise<NotificationTarget[]> {
  const supabase = createAdminClient()

  const { data, error } = await supabase.rpc('get_inactive_notification_targets', {
    days_inactive: 4,
  })
  if (error) throw new Error(`getInactiveOrgs: ${error.message}`)

  return (data ?? []).map((row: {
    org_id: string
    org_name: string
    user_id: string
    user_email: string
    last_seen_at: string | null
  }) => ({
    orgId: row.org_id,
    orgName: row.org_name,
    userId: row.user_id,
    userEmail: row.user_email,
    data: { lastSeenAt: row.last_seen_at },
  }))
}

// ── 4. Orgs con uso de IA ≥ 80% del límite mensual ───────────
export async function getHighUsageOrgs(): Promise<NotificationTarget[]> {
  const supabase = createAdminClient()

  const { data, error } = await supabase.rpc('get_high_ai_usage_targets', {
    threshold_pct: 80,
  })
  if (error) throw new Error(`getHighUsageOrgs: ${error.message}`)

  return (data ?? []).map((row: {
    org_id: string
    org_name: string
    user_id: string
    user_email: string
    messages_used: number
    messages_limit: number
    usage_pct: number
  }) => ({
    orgId: row.org_id,
    orgName: row.org_name,
    userId: row.user_id,
    userEmail: row.user_email,
    data: {
      messagesUsed: row.messages_used,
      messagesLimit: row.messages_limit,
      usagePct: row.usage_pct,
    },
  }))
}
