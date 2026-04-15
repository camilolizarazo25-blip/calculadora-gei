import { type NextRequest } from 'next/server'
import { z } from 'zod'
import { getChatHistory, incrementAIUsage } from '@/lib/supabase/queries'
import { requireAuthApi, requireOrgContextApi } from '@/lib/auth/guards'
import { getOpenAIClient, AI_CONFIG, buildSystemPrompt, type SystemPromptContext } from '@/lib/openai/client'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { apiSuccess, apiError } from '@/lib/utils'
import { getObligationUrgency } from '@/lib/utils'
import type { EscalationReason } from '@/types'
import { trackEvent } from '@/lib/analytics/track'

const ChatRequestSchema = z.object({
  message: z.string().min(1).max(2000),
})

// ─── GET /api/chat — historial de mensajes ────────────────────
export async function GET() {
  const { user, error: authError } = await requireAuthApi()
  if (authError) return authError

  const { ctx, error: ctxError } = await requireOrgContextApi(user.id)
  if (ctxError) return ctxError

  const history = await getChatHistory(ctx.orgId, 50)
  return apiSuccess(history)
}

// ─── POST /api/chat — enviar mensaje ─────────────────────────
export async function POST(request: NextRequest) {
  // 1. Auth + org context
  const { user, error: authError } = await requireAuthApi()
  if (authError) return authError

  const body = await request.json().catch(() => null)
  const parsed = ChatRequestSchema.safeParse(body)
  if (!parsed.success) return apiError('Mensaje inválido', 400)

  const { ctx, error: ctxError } = await requireOrgContextApi(user.id)
  if (ctxError) return ctxError

  // 2. Suscripción activa
  if (!ctx.isActive) {
    return apiError(
      'Tu suscripción está inactiva. Activa un plan para continuar usando el asesor.',
      402,
      'SUBSCRIPTION_INACTIVE'
    )
  }

  const supabase = await createClient()

  // 3. Límite de mensajes IA
  if (ctx.aiUsage.used >= ctx.aiUsage.limit) {
    const serviceClient = await createServiceClient()
    await createEscalation(serviceClient, {
      orgId: ctx.orgId,
      userId: user.id,
      question: parsed.data.message,
      reason: 'limit_reached',
    })
    return apiError(
      `Alcanzaste tu límite de ${ctx.aiUsage.limit} consultas este mes. Tu pregunta fue enviada a un asesor de Regenera.`,
      429,
      'AI_LIMIT_REACHED'
    )
  }

  // 4. Rate limit: máximo 5 mensajes de usuario por hora por organización
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString()
  const { count } = await supabase
    .from('chat_messages')
    .select('*', { count: 'exact', head: true })
    .eq('organization_id', ctx.orgId)
    .eq('role', 'user')
    .gte('created_at', oneHourAgo)

  if ((count ?? 0) >= 5) {
    return apiError('Demasiadas consultas en poco tiempo. Espera unos minutos.', 429, 'RATE_LIMITED')
  }

  // 5. Guardar mensaje del usuario (RLS permite INSERT role='user' desde cliente normal)
  await supabase.from('chat_messages').insert({
    organization_id: ctx.orgId,
    user_id: user.id,
    role: 'user',
    content: parsed.data.message,
  })

  // 6. Obtener historial para contexto de la IA
  const contextLimit = AI_CONFIG.context_messages_by_plan[ctx.plan.id] ?? 5
  const history = await getChatHistory(ctx.orgId, contextLimit + 5)
  const recentHistory = history.slice(-contextLimit - 1, -1)

  // 7. Obtener perfil completo de la organización + obligaciones
  const [orgResult, obligationsResult] = await Promise.all([
    supabase
      .from('organizations')
      .select('name, sector, city, department, employee_count, profile, ai_diagnosis')
      .eq('id', ctx.orgId)
      .single(),
    supabase
      .from('organization_obligations')
      .select('*, template:obligation_templates(title)')
      .eq('organization_id', ctx.orgId)
      .neq('status', 'not_applicable')
      .order('due_date', { ascending: true, nullsFirst: false })
      .limit(20),
  ])

  const org = orgResult.data
  const profile = (org?.profile ?? {}) as Record<string, unknown>

  // Construir resumen de obligaciones para el prompt
  const obligations = (obligationsResult.data ?? []).map((ob) => ({
    title: (ob.template as { title: string } | null)?.title ?? 'Obligación',
    status: ob.status as 'pending' | 'in_progress' | 'done' | 'not_applicable',
    due_date: ob.due_date,
    urgency: getObligationUrgency(ob.due_date, ob.status),
  }))

  // 8. Construir system prompt con contexto completo
  const systemPrompt = buildSystemPrompt({
    orgName: org?.name ?? ctx.orgName,
    sector: (org?.sector as string) ?? '',
    city: (org?.city as string) ?? '',
    department: (org?.department as string) ?? '',
    employeeCount: (org?.employee_count as string) ?? '',
    activities: (profile.activities as string[]) ?? [],
    waste_types: (profile.waste_types as string[]) ?? [],
    generates_hazardous_waste: (profile.generates_hazardous_waste as boolean) ?? false,
    has_atmospheric_emissions: (profile.has_atmospheric_emissions as boolean) ?? false,
    has_water_discharge: (profile.has_water_discharge as boolean) ?? false,
    current_permits: (profile.current_permits as string[]) ?? [],
    current_urgencies: (profile.current_urgencies as string) ?? '',
    aiDiagnosis: (org?.ai_diagnosis as SystemPromptContext['aiDiagnosis']) ?? null,
    obligations,
  })

  const messages = [
    { role: 'system' as const, content: systemPrompt },
    ...recentHistory
      .filter((m) => m.role !== 'human_agent')
      .map((m) => ({
        role: m.role === 'user' ? ('user' as const) : ('assistant' as const),
        content: m.content,
      })),
    { role: 'user' as const, content: parsed.data.message },
  ]

  // 9. Llamar a OpenAI
  const openai = getOpenAIClient()
  const maxTokens = AI_CONFIG.max_tokens_by_plan[ctx.plan.id] ?? 900

  let aiContent = ''
  let tokensUsed = 0
  let shouldEscalate = false

  try {
    const completion = await openai.chat.completions.create({
      model: AI_CONFIG.model,
      temperature: AI_CONFIG.temperature,
      max_tokens: maxTokens,
      messages,
    })

    aiContent = completion.choices[0]?.message.content ?? 'No pude generar una respuesta.'
    tokensUsed = completion.usage?.total_tokens ?? 0

    shouldEscalate = aiContent.startsWith('[ESCALAR]')
    if (shouldEscalate) {
      aiContent = aiContent.replace('[ESCALAR]', '').trim()
      aiContent +=
        '\n\n_Esta consulta fue enviada a un asesor de Regenera. Te responderemos en menos de 8 horas hábiles._'
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('=== ERROR OPENAI ===', msg)
    return apiError('Error al procesar tu consulta. Intenta de nuevo.', 500)
  }

  // 10. Guardar respuesta IA — requiere service client (RLS bloquea role='assistant' desde cliente normal)
  const serviceClient = await createServiceClient()

  const { data: savedAiMsg } = await serviceClient
    .from('chat_messages')
    .insert({
      organization_id: ctx.orgId,
      user_id: null,
      role: 'assistant',
      content: aiContent,
    })
    .select('id')
    .single()

  // 11. Crear escalación si aplica — también service client (RLS bloquea INSERT en escalations)
  if (shouldEscalate && savedAiMsg) {
    const escalationId = await createEscalation(serviceClient, {
      orgId: ctx.orgId,
      userId: user.id,
      question: parsed.data.message,
      reason: 'ai_low_confidence',
      contextMessages: history.slice(-5),
    })

    if (escalationId) {
      await serviceClient
        .from('chat_messages')
        .update({ escalation_id: escalationId })
        .eq('id', savedAiMsg.id)
    }
  }

  // 12. Incrementar contador de uso — RPC SECURITY DEFINER (no necesita service client)
  await incrementAIUsage(ctx.orgId, user.id, tokensUsed)

  trackEvent('chat_used', {
    userId: user.id,
    orgId:  ctx.orgId,
    metadata: {
      plan_id:          ctx.plan.id,
      escalated:        shouldEscalate,
      messages_remaining: ctx.aiUsage.limit - ctx.aiUsage.used - 1,
    },
  })

  return apiSuccess({
    message: aiContent,
    role: 'assistant',
    escalated: shouldEscalate,
    messages_remaining: ctx.aiUsage.limit - ctx.aiUsage.used - 1,
  })
}

// ─── Helper: crear escalación ────────────────────────────────
async function createEscalation(
  supabase: Awaited<ReturnType<typeof createServiceClient>>,
  params: {
    orgId: string
    userId: string
    question: string
    reason: EscalationReason
    contextMessages?: Array<{ role: string; content: string; created_at: string }>
  }
): Promise<string | null> {
  const { data, error } = await supabase
    .from('escalations')
    .insert({
      organization_id: params.orgId,
      triggered_by: params.userId,
      user_question: params.question,
      reason: params.reason,
      chat_session_context: params.contextMessages ?? [],
      status: 'pending',
    })
    .select('id')
    .single()

  if (error) {
    console.error('Error creando escalación:', error)
    return null
  }

  // TODO: enviar email a Regenera con Resend
  // await sendEscalationEmail(data.id, params.orgId, params.question)

  trackEvent('escalation_created', {
    userId: params.userId,
    orgId:  params.orgId,
    metadata: { reason: params.reason },
  })

  return data.id
}
