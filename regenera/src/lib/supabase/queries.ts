// Queries reutilizables de Supabase
// Centralizar aquí evita duplicar lógica en múltiples API Routes

import { createClient } from './server'
import type { OrgContext, SubscriptionPlanConfig } from '@/types'

// ─── Contexto completo de organización ───────────────────────
// Queries separadas en lugar de un select anidado profundo.
// Más verboso pero más robusto con RLS activo en Supabase.
export async function getOrgContext(userId: string): Promise<OrgContext | null> {
  const supabase = await createClient()

  // 1. Membresía del usuario
  const { data: member, error: memberError } = await supabase
    .from('organization_members')
    .select('role, organization_id')
    .eq('user_id', userId)
    .eq('status', 'active')
    .single()

  if (memberError || !member) return null

  const orgId = member.organization_id

  // 2. Datos de la organización + suscripción + plan (en paralelo)
  const [orgResult, subResult] = await Promise.all([
    supabase
      .from('organizations')
      .select('id, name')
      .eq('id', orgId)
      .single(),
    supabase
      .from('subscriptions')
      .select('status, plan_id, trial_ends_at, current_period_end')
      .eq('organization_id', orgId)
      .single(),
  ])

  if (orgResult.error || !orgResult.data) return null
  if (subResult.error || !subResult.data) return null

  const org = orgResult.data
  const subscription = subResult.data

  // 3. Plan de suscripción
  const { data: plan, error: planError } = await supabase
    .from('subscription_plans')
    .select('*')
    .eq('id', subscription.plan_id)
    .single()

  if (planError || !plan) return null

  // Verificar si el trial expiró — tratarlo como inactivo aunque el status diga 'trialing'
  const now = new Date()
  const trialExpired =
    subscription.status === 'trialing' &&
    subscription.trial_ends_at &&
    new Date(subscription.trial_ends_at) < now

  const effectiveStatus = trialExpired ? 'past_due' : subscription.status
  const isActive = ['active', 'trialing'].includes(effectiveStatus)

  // 4. Uso de IA del período actual
  const periodStartStr = new Date(now.getFullYear(), now.getMonth(), 1)
    .toISOString().split('T')[0]!

  const { data: usage } = await supabase
    .from('ai_usage')
    .select('messages_used')
    .eq('organization_id', orgId)
    .eq('period_start', periodStartStr)
    .single()

  const messagesUsed = usage?.messages_used ?? 0
  const typedPlan = plan as unknown as SubscriptionPlanConfig

  return {
    orgId,
    orgName: org.name,
    role: member.role as 'owner' | 'member',
    plan: typedPlan,
    subStatus: effectiveStatus,
    isActive,
    trialEndsAt: subscription.trial_ends_at ?? null,
    periodEnd: subscription.current_period_end ?? null,
    aiUsage: {
      used: messagesUsed,
      limit: typedPlan.ai_messages_per_month,
      percentage: Math.round((messagesUsed / typedPlan.ai_messages_per_month) * 100),
    },
  }
}

// ─── Verificar sesión del usuario ─────────────────────────────
export async function getAuthUser() {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) return null
  return user
}

// ─── Obligaciones de la organización ─────────────────────────
export async function getOrgObligations(orgId: string) {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('organization_obligations')
    .select(`
      *,
      template:obligation_templates (*)
    `)
    .eq('organization_id', orgId)
    .order('due_date', { ascending: true, nullsFirst: false })

  if (error) throw error
  return data ?? []
}

// ─── Historial de chat ────────────────────────────────────────
export async function getChatHistory(orgId: string, limit = 50) {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('chat_messages')
    .select('*')
    .eq('organization_id', orgId)
    .order('created_at', { ascending: true })
    .limit(limit)

  if (error) throw error
  return data ?? []
}

// ─── Incrementar uso de IA ────────────────────────────────────
export async function incrementAIUsage(
  orgId: string,
  userId: string,
  tokensUsed: number
) {
  const supabase = await createClient()

  const today = new Date()
  const periodStart = new Date(today.getFullYear(), today.getMonth(), 1)
    .toISOString().split('T')[0]!
  const periodEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0)
    .toISOString().split('T')[0]!

  // Upsert — crea el registro si no existe, incrementa si existe
  const { error } = await supabase.rpc('increment_ai_usage', {
    p_organization_id: orgId,
    p_user_id: userId,
    p_period_start: periodStart,
    p_period_end: periodEnd,
    p_tokens: tokensUsed,
  })

  if (error) console.error('Error incrementando uso IA:', error)
}
