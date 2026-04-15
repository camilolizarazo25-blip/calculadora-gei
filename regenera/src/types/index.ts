// ─── Tipos de dominio de Regenera ────────────────────────────
// Estos tipos reflejan el schema de la base de datos Supabase.
// Para tipos auto-generados por Supabase, ver database.ts

export type SubscriptionPlan = 'trial' | 'basic' | 'professional'
export type SubscriptionStatus = 'trialing' | 'active' | 'past_due' | 'inactive' | 'cancelled'
export type MemberRole = 'owner' | 'member'
export type MemberStatus = 'active' | 'pending' | 'removed'
export type ObligationStatus = 'pending' | 'in_progress' | 'done' | 'not_applicable'
export type EscalationStatus = 'pending' | 'in_progress' | 'resolved'
export type EscalationReason = 'ai_low_confidence' | 'user_requested' | 'limit_reached'
export type MessageRole = 'user' | 'assistant' | 'human_agent'

// ─── Organización ─────────────────────────────────────────────
// Los campos opcionales se completan durante el onboarding.
// IMPORTANTE: el estado de suscripción NO está aquí — leerlo
// siempre desde la tabla subscriptions (fuente de verdad única).
export interface Organization {
  id: string
  name: string
  nit: string | null
  sector: OrgSector | null
  city: string | null
  department: string | null
  employee_count: EmployeeCount | null
  profile: OrgProfile | null
  onboarding_completed_at: string | null
  created_at: string
}

export type OrgSector =
  | 'manufactura'
  | 'alimentos'
  | 'servicios'
  | 'construccion'
  | 'salud'
  | 'comercio'
  | 'educacion'
  | 'otro'

export type EmployeeCount = '1-10' | '11-50' | '51-200' | '200+'

// Perfil ambiental — guardado como JSONB en Supabase
export interface OrgProfile {
  activities: string[]              // actividades ambientales que realiza
  waste_types: string[]             // tipos de residuos que genera
  generates_hazardous_waste: boolean
  has_atmospheric_emissions: boolean
  has_water_discharge: boolean
  current_permits: string[]         // permisos ambientales vigentes
  current_urgencies: string         // texto libre — problemas actuales
}

// ─── Miembros de organización ─────────────────────────────────
export interface OrganizationMember {
  id: string
  organization_id: string
  user_id: string
  role: MemberRole
  status: MemberStatus
  invited_by: string | null
  created_at: string
}

// ─── Obligaciones ─────────────────────────────────────────────
export interface ObligationTemplate {
  id: string
  code: string
  title: string
  description: string
  authority: string
  frequency: 'annual' | 'quarterly' | 'biannual' | 'monthly' | 'event'
  applicable_sectors: OrgSector[]
  applicable_if: Record<string, unknown> | null
  regulation_reference: string | null
  priority: 'high' | 'medium' | 'low'
  is_active: boolean
  created_at: string
}

export interface OrganizationObligation {
  id: string
  organization_id: string
  template_id: string
  status: ObligationStatus
  due_date: string | null
  completed_at: string | null
  notes: string | null
  is_custom: boolean
  created_at: string
  // Join con template
  template?: ObligationTemplate
}

// ─── Chat ─────────────────────────────────────────────────────
export interface ChatMessage {
  id: string
  organization_id: string
  user_id: string | null
  role: MessageRole
  content: string
  escalation_id: string | null
  created_at: string
}

// ─── Escalaciones ─────────────────────────────────────────────
export interface Escalation {
  id: string
  organization_id: string
  triggered_by: string
  user_question: string
  reason: EscalationReason
  chat_session_context: ChatMessage[]
  status: EscalationStatus
  assigned_to: string | null
  response: string | null
  response_at: string | null
  created_at: string
  resolved_at: string | null
}

// ─── Planes y suscripciones ───────────────────────────────────
export interface SubscriptionPlanConfig {
  id: SubscriptionPlan
  name: string
  price_cop: number
  max_users: number
  ai_messages_per_month: number
  ai_max_tokens_per_message: number
  ai_context_messages: number
  response_time_hours: number
  features: {
    docs: false | 'basic' | 'all'
    whatsapp: boolean
  }
}

export interface Subscription {
  id: string
  organization_id: string
  plan_id: SubscriptionPlan
  status: SubscriptionStatus
  trial_ends_at: string | null
  current_period_start: string
  current_period_end: string
  wompi_transaction_id: string | null
  amount_cop: number | null
  payment_method: 'pse' | 'card' | 'nequi' | 'daviplata' | null
  cancelled_at: string | null
}

// ─── Uso de IA ────────────────────────────────────────────────
export interface AIUsage {
  id: string
  organization_id: string
  user_id: string
  period_start: string
  period_end: string
  messages_used: number
  tokens_used: number
  last_message_at: string | null
}

// ─── Contexto de organización (usado en toda la app) ──────────
export interface OrgContext {
  orgId: string
  orgName: string
  role: MemberRole
  plan: SubscriptionPlanConfig
  subStatus: SubscriptionStatus
  isActive: boolean
  trialEndsAt: string | null   // null si ya no está en trial
  periodEnd: string | null      // fin del período actual de facturación
  aiUsage: {
    used: number
    limit: number
    percentage: number
  }
}
