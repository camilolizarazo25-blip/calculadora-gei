// Cliente OpenAI — solo para uso en servidor (API Routes)
// NUNCA importar en Client Components

import OpenAI from 'openai'

// Nueva instancia por llamada — evita singleton con clave desactualizada
export function getOpenAIClient(): OpenAI {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY no está configurada')
  }
  return new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  })
}

// ─── Configuración por plan ───────────────────────────────────
export const AI_CONFIG = {
  model: 'gpt-4o-mini' as const,  // más barato, suficiente para asesoría ambiental
  temperature: 0.25,               // bajo = respuestas más consistentes y factuales
  max_tokens_by_plan: {
    trial:        600,
    basic:        900,
    professional: 1600,
  } as Record<string, number>,
  context_messages_by_plan: {
    trial:        3,
    basic:        5,
    professional: 15,
  } as Record<string, number>,
} as const

// ─── System prompt ────────────────────────────────────────────
// Diseñado para respuestas accionables y contextualizadas.
// Se construye con el perfil completo de la empresa: sector, actividades,
// obligaciones activas y estado de cumplimiento.
//
// Principio de diseño:
//   Cada respuesta debe ser tan específica que el usuario sienta
//   que habla con un asesor que ya conoce su empresa, no con ChatGPT.

interface ObligationSummary {
  title: string
  status: 'pending' | 'in_progress' | 'done' | 'not_applicable'
  due_date: string | null
  urgency: 'overdue' | 'critical' | 'warning' | 'ok' | 'done'
}

export interface SystemPromptContext {
  // Datos de la empresa
  orgName: string
  sector: string
  city: string
  department: string
  employeeCount: string
  // Perfil ambiental
  activities: string[]
  waste_types: string[]
  generates_hazardous_waste: boolean
  has_atmospheric_emissions: boolean
  has_water_discharge: boolean
  current_permits: string[]
  current_urgencies?: string
  // Obligaciones (resumen — no toda la DB)
  obligations: ObligationSummary[]
  // Diagnóstico IA (si ya fue generado)
  aiDiagnosis?: {
    risk_summary?: { overall: string; residuos: string; agua: string; aire: string; permisos: string }
    immediate_actions?: string[]
    regional_notes?: string
    diagnosis_summary?: string
  } | null
}

export function buildSystemPrompt(ctx: SystemPromptContext): string {
  // ── Resumen de obligaciones ───────────────────────────────────
  // Solo incluir las relevantes para no desperdiciar tokens:
  // vencidas, urgentes, y las primeras 5 pendientes.
  const overdue = ctx.obligations.filter(o => o.urgency === 'overdue')
  const critical = ctx.obligations.filter(o => o.urgency === 'critical')
  const pending  = ctx.obligations.filter(o => o.urgency === 'warning' || o.urgency === 'ok').slice(0, 5)
  const done     = ctx.obligations.filter(o => o.urgency === 'done').length

  const obligationLines: string[] = []

  if (overdue.length > 0) {
    obligationLines.push(`VENCIDAS (${overdue.length}): ${overdue.map(o => o.title).join(', ')}`)
  }
  if (critical.length > 0) {
    obligationLines.push(`URGENTES - próximas 7 días (${critical.length}): ${critical.map(o => o.title).join(', ')}`)
  }
  if (pending.length > 0) {
    obligationLines.push(`PENDIENTES: ${pending.map(o => o.title).join(', ')}`)
  }
  if (done > 0) {
    obligationLines.push(`CUMPLIDAS: ${done} obligaciones`)
  }
  if (obligationLines.length === 0) {
    obligationLines.push('No hay obligaciones registradas aún (empresa recién registrada)')
  }

  // ── Perfil ambiental resumido ─────────────────────────────────
  const envFlags: string[] = []
  if (ctx.generates_hazardous_waste) envFlags.push('genera residuos peligrosos (RESPEL)')
  if (ctx.has_atmospheric_emissions)  envFlags.push('tiene emisiones atmosféricas')
  if (ctx.has_water_discharge)         envFlags.push('realiza vertimientos')
  if (envFlags.length === 0)           envFlags.push('sin impactos ambientales significativos registrados')

  const permitsText = ctx.current_permits.length > 0
    ? ctx.current_permits.join(', ')
    : 'ninguno registrado'

  const activitiesText = ctx.activities.length > 0
    ? ctx.activities.join(', ')
    : 'no especificadas'

  const wasteText = ctx.waste_types.length > 0
    ? ctx.waste_types.join(', ')
    : 'no especificados'

  const urgenciesText = ctx.current_urgencies?.trim()
    ? `\n- Urgencias reportadas: ${ctx.current_urgencies}`
    : ''

  // ── Autoridad ambiental regional ─────────────────────────────
  const authority = REGIONAL_AUTHORITY[ctx.department?.toLowerCase()] ?? 'la autoridad ambiental regional competente'

  // ── Diagnóstico IA (si existe) ────────────────────────────────
  let diagnosisSection = ''
  if (ctx.aiDiagnosis) {
    const d = ctx.aiDiagnosis
    const riskLines: string[] = []
    if (d.risk_summary) {
      riskLines.push(`Riesgo general: ${d.risk_summary.overall?.toUpperCase()}`)
      if (d.risk_summary.residuos !== 'none') riskLines.push(`  · Residuos: ${d.risk_summary.residuos}`)
      if (d.risk_summary.agua !== 'none')     riskLines.push(`  · Agua: ${d.risk_summary.agua}`)
      if (d.risk_summary.aire !== 'none')     riskLines.push(`  · Aire: ${d.risk_summary.aire}`)
      if (d.risk_summary.permisos !== 'none') riskLines.push(`  · Permisos: ${d.risk_summary.permisos}`)
    }
    const actionsText = d.immediate_actions?.length
      ? `\nACCIONES INMEDIATAS IDENTIFICADAS:\n${d.immediate_actions.map((a, i) => `${i + 1}. ${a}`).join('\n')}`
      : ''
    const summaryText = d.diagnosis_summary ? `\nRESUMEN DEL DIAGNÓSTICO: ${d.diagnosis_summary}` : ''
    const regionalText = d.regional_notes ? `\nINFO REGIONAL: ${d.regional_notes}` : ''

    diagnosisSection = `
DIAGNÓSTICO AMBIENTAL PROFUNDO (generado por IA para esta empresa):
${riskLines.join('\n')}${summaryText}${actionsText}${regionalText}`
  }

  return `Eres un asesor ambiental experto de Regenera Consultoría S.A.S., firma especializada en cumplimiento ambiental para empresas colombianas.

EMPRESA QUE ESTÁS ASESORANDO AHORA:
- Razón social: ${ctx.orgName}
- Sector: ${ctx.sector || 'no especificado'}
- Ubicación: ${ctx.city || 'Colombia'}, ${ctx.department || ''}
- Tamaño: ${ctx.employeeCount || 'no especificado'} empleados
- Actividades: ${activitiesText}
- Impactos ambientales: ${envFlags.join('; ')}
- Tipos de residuos: ${wasteText}
- Permisos vigentes: ${permitsText}
- Autoridad ambiental regional: ${authority}${urgenciesText}
${diagnosisSection}

ESTADO ACTUAL DE OBLIGACIONES:
${obligationLines.join('\n')}

CÓMO DEBES RESPONDER:
1. Responde SIEMPRE en español colombiano, directo y sin tecnicismos innecesarios
2. El usuario es gerente o responsable administrativo — no ingeniero ambiental
3. Cita siempre el decreto o resolución exacta cuando menciones normativa colombiana
4. Respuestas concretas y accionables: "debes hacer X antes de Y porque Z"
5. Máximo 3-4 párrafos. Si necesitas más espacio, usa listas cortas
6. Si la pregunta toca directamente una obligación vencida o urgente de su empresa, MENCIÓNALA explícitamente
7. Usa el diagnóstico ambiental profundo cuando esté disponible para dar respuestas más precisas
8. Personaliza: usa el nombre de la empresa y su sector en las respuestas

LO QUE NO DEBES HACER:
- Responder con "depende del caso" sin dar al menos una orientación concreta
- Dar información de otros países o normativa internacional sin advertirlo
- Comprometerte a que la empresa está cumpliendo (no tienes toda la información)
- Dar asesoría legal definitiva — siempre recomienda verificar con un abogado si hay implicaciones legales graves

CUÁNDO ESCALAR A UN ASESOR HUMANO:
Si la pregunta cumple alguno de estos criterios, inicia tu respuesta con exactamente [ESCALAR]:
- Implica revisión de documentos legales o contratos específicos de la empresa
- Hay riesgo de sanción inminente o proceso sancionatorio activo
- Requiere cálculos técnicos específicos (DBO, caudales, inventarios RESPEL exactos)
- El usuario pide ayuda para redactar documentos oficiales
- No tienes certeza razonable sobre la respuesta correcta para Colombia
- El usuario lo pide explícitamente

Cuando escales, da igualmente una orientación inicial útil antes de la nota de escalación.`
}

// ─── Mapa de autoridades ambientales por departamento ────────
// Fuente: https://www.minambiente.gov.co/corporaciones-autonomas/
const REGIONAL_AUTHORITY: Record<string, string> = {
  'antioquia':            'CORANTIOQUIA o Área Metropolitana del Valle de Aburrá (AMVA)',
  'atlántico':            'CRA (Corporación Autónoma Regional del Atlántico)',
  'bolívar':              'CARDIQUE o CSB',
  'boyacá':               'CORPOBOYACÁ',
  'caldas':               'CORPOCALDAS',
  'caquetá':              'CORPOAMAZONIA',
  'cauca':                'CRC (Corporación Autónoma Regional del Cauca)',
  'cesar':                'CORPOCESAR',
  'córdoba':              'CVS (Corporación Autónoma Regional de los Valles del Sinú)',
  'cundinamarca':         'CAR (Corporación Autónoma Regional de Cundinamarca)',
  'bogotá':               'SDA (Secretaría Distrital de Ambiente)',
  'bogota':               'SDA (Secretaría Distrital de Ambiente)',
  'chocó':                'CODECHOCÓ',
  'huila':                'CAM (Corporación Autónoma Regional del Alto Magdalena)',
  'la guajira':           'CORPOGUAJIRA',
  'magdalena':            'CORPAMAG',
  'meta':                 'CORMACARENA o CORPORINOQUIA',
  'nariño':               'CORPONARIÑO',
  'norte de santander':   'CORPONOR',
  'putumayo':             'CORPOAMAZONIA',
  'quindío':              'CRQ (Corporación Autónoma Regional del Quindío)',
  'risaralda':            'CARDER',
  'san andrés':           'CORALINA',
  'santander':            'CDMB o CAS',
  'sucre':                'CARSUCRE',
  'tolima':               'CORTOLIMA',
  'valle del cauca':      'CVC (Corporación Autónoma Regional del Valle del Cauca)',
  'vaupés':               'CORPOAMAZONIA',
  'vichada':              'CORPORINOQUIA',
}
