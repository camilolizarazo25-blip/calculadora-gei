// ─── Tipos para requests y responses de API Routes ───────────

export interface ApiResponse<T = null> {
  data: T | null
  error: string | null
}

export interface ApiError {
  error: string
  code?: string
  details?: unknown
}

// ─── Chat ─────────────────────────────────────────────────────
export interface ChatRequest {
  message: string
  session_id?: string
}

export interface ChatResponse {
  message: string
  role: 'assistant' | 'human_agent'
  escalated: boolean
  messages_remaining: number
}

// ─── Onboarding ───────────────────────────────────────────────
export interface OnboardingStep1 {
  name: string
  nit: string
  sector: string
  city: string
  department: string
  employee_count: string
}

export interface OnboardingStep2 {
  activities: string[]
  generates_hazardous_waste: boolean
  has_atmospheric_emissions: boolean
  has_water_discharge: boolean
  waste_types: string[]
}

export interface OnboardingStep3 {
  current_permits: string[]
  current_urgencies: string
}

export type OnboardingData = OnboardingStep1 & OnboardingStep2 & OnboardingStep3

// ─── Organización ─────────────────────────────────────────────
export interface InviteMemberRequest {
  email: string
}
