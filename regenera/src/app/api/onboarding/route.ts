import { type NextRequest } from 'next/server'
import { z } from 'zod'
import { requireAuthApi, requireOrgContextApi, requireOwnerApi } from '@/lib/auth/guards'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { apiSuccess, apiError } from '@/lib/utils'
import { assignObligations, calculateDueDate } from '@/services/obligations'
import { generateAIDiagnosis } from '@/services/diagnosis'
import { trackEvent } from '@/lib/analytics/track'

const OnboardingSchema = z.object({
  name: z.string().min(2).max(200),
  nit: z.string().min(9).max(20),
  sector: z.enum(['manufactura', 'alimentos', 'servicios', 'construccion', 'salud', 'comercio', 'educacion', 'otro']),
  city: z.string().min(2).max(100),
  department: z.string().min(2).max(100),
  employee_count: z.enum(['1-10', '11-50', '51-200', '200+']),
  activities: z.array(z.string()).min(1, 'Selecciona al menos una actividad'),
  generates_hazardous_waste: z.boolean(),
  has_atmospheric_emissions: z.boolean(),
  has_water_discharge: z.boolean(),
  waste_types: z.array(z.string()),
  current_permits: z.array(z.string()),
  current_urgencies: z.string().max(500).default(''),
})

export async function POST(request: NextRequest) {
  const { user, error: authError } = await requireAuthApi()
  if (authError) return authError

  const body = await request.json().catch(() => null)
  const parsed = OnboardingSchema.safeParse(body)
  if (!parsed.success) {
    const firstError = parsed.error.errors[0]?.message ?? 'Datos de onboarding inválidos'
    return apiError(firstError, 400)
  }

  const { ctx, error: ctxError } = await requireOrgContextApi(user.id)
  if (ctxError) return ctxError

  const ownerError = requireOwnerApi(ctx)
  if (ownerError) return ownerError

  const supabase = await createClient()
  const data = parsed.data

  // ── 1. Construir perfil ambiental (JSONB) ──────────────────
  const profile = {
    activities: data.activities,
    waste_types: data.waste_types,
    generates_hazardous_waste: data.generates_hazardous_waste,
    has_atmospheric_emissions: data.has_atmospheric_emissions,
    has_water_discharge: data.has_water_discharge,
    current_permits: data.current_permits,
    current_urgencies: data.current_urgencies,
  }

  // ── 2. Generar diagnóstico IA en paralelo con el guardado ──
  // El diagnóstico corre en background — no bloquea el onboarding
  // si falla. Se guarda después de las obligaciones base.
  const diagnosisPromise = generateAIDiagnosis({
    name: data.name,
    nit: data.nit,
    sector: data.sector,
    city: data.city,
    department: data.department,
    employee_count: data.employee_count,
    activities: data.activities,
    generates_hazardous_waste: data.generates_hazardous_waste,
    has_atmospheric_emissions: data.has_atmospheric_emissions,
    has_water_discharge: data.has_water_discharge,
    waste_types: data.waste_types,
    current_permits: data.current_permits,
    current_urgencies: data.current_urgencies,
  }).catch((err) => {
    console.error('Diagnóstico IA falló (no bloqueante):', err)
    return null
  })

  // ── 3. Actualizar organización ─────────────────────────────
  const { error: orgError } = await supabase
    .from('organizations')
    .update({
      name: data.name,
      nit: data.nit,
      sector: data.sector,
      city: data.city,
      department: data.department,
      employee_count: data.employee_count,
      profile,
      onboarding_completed_at: new Date().toISOString(),
    })
    .eq('id', ctx.orgId)

  if (orgError) {
    console.error('Error actualizando organización:', orgError)
    return apiError('Error guardando información de la empresa', 500)
  }

  // ── 4. Generar obligaciones base (reglas deterministas) ────
  const obligationCodes = assignObligations({
    sector: data.sector,
    generates_hazardous_waste: data.generates_hazardous_waste,
    has_atmospheric_emissions: data.has_atmospheric_emissions,
    has_water_discharge: data.has_water_discharge,
    employee_count: data.employee_count,
    activities: data.activities,
    waste_types: data.waste_types,
  })

  // ── 5. Obtener templates de la DB ──────────────────────────
  const { data: templates } = await supabase
    .from('obligation_templates')
    .select('id, code, frequency')
    .in('code', obligationCodes)
    .eq('is_active', true)

  // ── 6. Insertar obligaciones con fechas reales ─────────────
  const adminClient = createAdminClient()

  if (templates && templates.length > 0) {
    const obligationRows = templates.map((t) => ({
      organization_id: ctx.orgId,
      template_id: t.id,
      status: 'pending' as const,
      due_date: calculateDueDate(t.frequency as 'annual' | 'quarterly' | 'biannual' | 'monthly' | 'event', t.code),
    }))

    const { error: upsertError } = await adminClient
      .from('organization_obligations')
      .upsert(obligationRows, {
        onConflict: 'organization_id,template_id',
        ignoreDuplicates: true,
      })

    if (upsertError) {
      console.error('Error insertando obligaciones:', upsertError)
      return apiError('Error guardando las obligaciones', 500)
    }
  }

  // ── 7. Esperar diagnóstico IA y guardarlo ──────────────────
  const diagnosis = await diagnosisPromise

  if (diagnosis) {
    // Guardar en organizations.ai_diagnosis
    await adminClient
      .from('organizations')
      .update({ ai_diagnosis: diagnosis })
      .eq('id', ctx.orgId)

    // Insertar obligaciones adicionales del diagnóstico IA que no
    // estén ya en las base (basadas en códigos del catálogo)
    const aiCodes = diagnosis.obligations
      .filter((o) => o.code && !obligationCodes.includes(o.code))
      .map((o) => o.code!)
      .filter(Boolean)

    if (aiCodes.length > 0) {
      const { data: aiTemplates } = await adminClient
        .from('obligation_templates')
        .select('id, code, frequency')
        .in('code', aiCodes)
        .eq('is_active', true)

      if (aiTemplates && aiTemplates.length > 0) {
        const aiRows = aiTemplates.map((t) => ({
          organization_id: ctx.orgId,
          template_id: t.id,
          status: 'pending' as const,
          due_date: calculateDueDate(t.frequency as 'annual' | 'quarterly' | 'biannual' | 'monthly' | 'event', t.code),
        }))

        await adminClient
          .from('organization_obligations')
          .upsert(aiRows, { onConflict: 'organization_id,template_id', ignoreDuplicates: true })
      }
    }
  }

  const totalTemplates = templates?.length ?? 0
  const aiExtra = diagnosis
    ? diagnosis.obligations.filter((o) => o.code && !obligationCodes.includes(o.code)).length
    : 0

  trackEvent('onboarding_completed', {
    userId: user.id,
    orgId: ctx.orgId,
    metadata: {
      sector: data.sector,
      employee_count: data.employee_count,
      obligations_count: totalTemplates + aiExtra,
      ai_diagnosis_generated: !!diagnosis,
    },
  })

  return apiSuccess({
    obligations_count: totalTemplates + aiExtra,
    ai_diagnosis_generated: !!diagnosis,
    redirect: '/onboarding/completado',
  }, 201)
}

export async function GET() {
  return apiError('Método no permitido', 405)
}
