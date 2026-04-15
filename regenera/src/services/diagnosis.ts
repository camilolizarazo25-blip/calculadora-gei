// Motor de diagnóstico ambiental profundo con IA
// ─────────────────────────────────────────────────────────────
// Recibe el perfil completo de la empresa y genera un diagnóstico
// personalizado con:
//   - Obligaciones aplicables con referencias legales exactas
//   - Nivel de riesgo por área (residuos, agua, aire, permisos)
//   - Prioridades de acción por urgencia
//   - Código de obligación en obligation_templates (si existe)
//
// Diseño: la IA NO inventa obligaciones — mapea a los códigos
// del catálogo de Regenera cuando puede, o las marca como
// "personalizada" para revisión manual del asesor.

import { getOpenAIClient } from '@/lib/openai/client'

export interface OrgProfile {
  name: string
  nit: string
  sector: string
  city: string
  department: string
  employee_count: string
  activities: string[]
  generates_hazardous_waste: boolean
  has_atmospheric_emissions: boolean
  has_water_discharge: boolean
  waste_types: string[]
  current_permits: string[]
  current_urgencies: string
}

export interface DiagnosisObligation {
  code: string | null          // código en obligation_templates, null si es nueva/personalizada
  title: string
  description: string
  legal_reference: string      // "Decreto 1076/2015 Art. X.X.X"
  authority: string            // "IDEAM" / "CAR" / "CORANTIOQUIA" etc.
  frequency: string            // "annual" / "quarterly" / "event"
  priority: 'high' | 'medium' | 'low'
  applies_because: string      // explicación breve de por qué aplica a esta empresa específica
  typical_due: string | null   // "31 de marzo" / "último día del trimestre" / null
}

export interface DiagnosisResult {
  risk_summary: {
    overall: 'high' | 'medium' | 'low'
    residuos: 'high' | 'medium' | 'low' | 'none'
    agua: 'high' | 'medium' | 'low' | 'none'
    aire: 'high' | 'medium' | 'low' | 'none'
    permisos: 'high' | 'medium' | 'low' | 'none'
  }
  obligations: DiagnosisObligation[]
  immediate_actions: string[]   // máx 3 cosas urgentes a hacer ahora
  regional_notes: string        // información específica de la autoridad regional
  diagnosis_summary: string     // párrafo ejecutivo para mostrar al usuario
  generated_at: string
}

// Catálogo de códigos disponibles en obligation_templates
// La IA usará estos para mapear cuando apliquen
const OBLIGATION_CODES_CATALOG = `
PGIRSR-REGISTRO, RUA-ANUAL, RESPEL-REGISTRO, RESPEL-INFORME-ANUAL, RESPEL-MOVIMIENTO,
EMISIONES-PERMISO, EMISIONES-REPORTE, VERTIMIENTOS-PERMISO, VERTIMIENTOS-TASA-RETRIBUTIVA,
PMA-CONSTRUCCION, ESCOMBROS-MANEJO, MATRIZ-LEGAL-AMBIENTAL,
RESPEL-BIOSANIT-PLAN, RESPEL-BIOSANIT-REGISTRO, BIOSANIT-GESTOR-CONTRATO, RUIDO-SECTOR-SALUD,
VERTIMIENTOS-GRASAS, OLORES-OFENSIVOS, USO-EFICIENTE-AGUA-ALIMENTOS, APROVECHAMIENTO-EMPAQUES,
INVENTARIO-ENERGETICO, SUSTANCIAS-QUIMICAS, CONCESION-AGUAS, RUIDO-INDUSTRIAL, VIBRACIONES-CONTROL,
LICENCIA-AMBIENTAL, SEGUIMIENTO-LICA, DEPOSITO-ESCOMBROS-PERMISO, COMPENSACION-ARBOLES,
PROGRAMA-RECICLAJE, REDUCCION-PLASTICOS, ACEITES-USADOS-POSCONSUMO, BATERIAS-POSCONSUMO,
PRAE, GESTION-AMBIENTAL-ESCOLAR,
HUELLA-CARBONO, REGISTRO-GEI, CAPACITACION-AMBIENTAL, INDICADORES-AMBIENTALES,
APROVECHAMIENTO-FORESTAL, SGA-ISO14001, TASA-USO-AGUA
`

function buildDiagnosisPrompt(profile: OrgProfile): string {
  const activitiesText = profile.activities.length > 0
    ? profile.activities.join(', ')
    : 'No especificadas'
  const wasteText = profile.waste_types.length > 0
    ? profile.waste_types.join(', ')
    : 'No especificados'
  const permitsText = profile.current_permits.length > 0
    ? profile.current_permits.join(', ')
    : 'Ninguno registrado'
  const urgenciesText = profile.current_urgencies
    ? profile.current_urgencies
    : 'Ninguna urgencia reportada'

  return `Eres un experto en derecho ambiental colombiano y cumplimiento normativo de empresas. Tu tarea es realizar un DIAGNÓSTICO AMBIENTAL PROFUNDO de una empresa colombiana basado en su perfil.

PERFIL DE LA EMPRESA A DIAGNOSTICAR:
- Razón social: ${profile.name}
- NIT: ${profile.nit}
- Sector: ${profile.sector}
- Ubicación: ${profile.city}, ${profile.department}
- Tamaño: ${profile.employee_count} empleados
- Actividades: ${activitiesText}
- Genera residuos peligrosos (RESPEL): ${profile.generates_hazardous_waste ? 'SÍ' : 'NO'}
- Tiene emisiones atmosféricas: ${profile.has_atmospheric_emissions ? 'SÍ' : 'NO'}
- Realiza vertimientos: ${profile.has_water_discharge ? 'SÍ' : 'NO'}
- Tipos de residuos: ${wasteText}
- Permisos vigentes: ${permitsText}
- Urgencias actuales: ${urgenciesText}

CÓDIGOS DE OBLIGACIONES DISPONIBLES EN EL SISTEMA (usa estos cuando apliquen):
${OBLIGATION_CODES_CATALOG}

TAREA: Genera un diagnóstico ambiental completo y específico para esta empresa. Para cada obligación:
1. Determina si aplica a esta empresa específica (no genéricamente)
2. Explica POR QUÉ aplica (basándote en sus actividades, sector y declaraciones)
3. Cita la norma exacta (decreto, resolución, artículo)
4. Usa el código del catálogo si corresponde, o null si es una obligación adicional no catalogada
5. Indica la autoridad ambiental regional según el departamento (${profile.department})

MARCO NORMATIVO CLAVE A CONSIDERAR:
- Decreto 1076/2015 (Decreto Único Reglamentario del Sector Ambiente — DURS)
- Ley 99/1993 (SINA — Sistema Nacional Ambiental)
- Decreto 4741/2005 / Resolución 1362/2007 (Residuos Peligrosos — RESPEL)
- Resolución 0631/2015 (Parámetros de vertimientos a cuerpos de agua)
- Resolución 0627/2006 (Norma nacional de emisión de ruido)
- Decreto 948/1995 / Resolución 909/2008 (Emisiones atmosféricas)
- Resolución 472/2017 (Gestión de Residuos de Construcción y Demolición)
- Ley 373/1997 (Uso eficiente del agua)
- Resolución 1164/2002 (Residuos hospitalarios)
- Decreto 155/2004 (Tasas por uso de agua)
- Ley 2232/2022 (Reducción de plásticos de un solo uso)
- Decreto 298/2016 / Resolución 1447/2018 (Inventario GEI)

Responde ÚNICAMENTE con un JSON válido con esta estructura exacta:
{
  "risk_summary": {
    "overall": "high|medium|low",
    "residuos": "high|medium|low|none",
    "agua": "high|medium|low|none",
    "aire": "high|medium|low|none",
    "permisos": "high|medium|low|none"
  },
  "obligations": [
    {
      "code": "CODIGO_CATALOGO o null",
      "title": "Título de la obligación",
      "description": "Descripción específica para esta empresa",
      "legal_reference": "Decreto X/XXXX Art. X.X — descripción corta",
      "authority": "Nombre de la autoridad competente",
      "frequency": "annual|quarterly|biannual|monthly|event",
      "priority": "high|medium|low",
      "applies_because": "Explicación de 1-2 oraciones de por qué aplica a esta empresa",
      "typical_due": "Fecha orientativa o null"
    }
  ],
  "immediate_actions": [
    "Acción urgente 1",
    "Acción urgente 2",
    "Acción urgente 3"
  ],
  "regional_notes": "Información sobre la autoridad ambiental competente en ${profile.department} y requisitos específicos regionales",
  "diagnosis_summary": "Párrafo ejecutivo de 3-4 oraciones resumiendo el estado ambiental de la empresa, riesgos principales y pasos prioritarios"
}

IMPORTANTE:
- Incluye SOLO las obligaciones que realmente aplican a esta empresa específica
- Máximo 15 obligaciones (prioriza las más importantes)
- Sé específico: no copies descripciones genéricas, adapta cada una al sector y actividades declaradas
- Si hay urgencias reportadas, prioriza las obligaciones relacionadas
- Responde solo con el JSON, sin texto adicional antes ni después`
}

export async function generateAIDiagnosis(profile: OrgProfile): Promise<DiagnosisResult> {
  const openai = getOpenAIClient()

  const completion = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    temperature: 0.1, // muy bajo para máxima consistencia en diagnóstico legal
    max_tokens: 3000,
    response_format: { type: 'json_object' },
    messages: [
      {
        role: 'user',
        content: buildDiagnosisPrompt(profile),
      },
    ],
  })

  const raw = completion.choices[0]?.message.content ?? '{}'

  try {
    const result = JSON.parse(raw) as DiagnosisResult
    result.generated_at = new Date().toISOString()
    return result
  } catch {
    throw new Error('El diagnóstico IA retornó un formato inválido')
  }
}
