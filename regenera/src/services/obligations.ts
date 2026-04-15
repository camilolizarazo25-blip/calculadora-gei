// Servicio de obligaciones ambientales
// Lógica de negocio: perfil de empresa → códigos de obligaciones sugeridas
//
// IMPORTANTE: Esta función genera una lista orientativa de obligaciones
// probables según el sector y actividades declarados. La IA profunda
// (generateAIDiagnosis) complementa esto con análisis legal específico.

import type { OrgSector, EmployeeCount } from '@/types'

interface ObligationInput {
  sector: OrgSector
  generates_hazardous_waste: boolean
  has_atmospheric_emissions: boolean
  has_water_discharge: boolean
  employee_count: EmployeeCount
  activities?: string[]
  waste_types?: string[]
}

// Todos los códigos disponibles en el catálogo (001 + 007 migrations)
const AVAILABLE_CODES = new Set([
  // Originales (migración 001)
  'PGIRSR-REGISTRO', 'RUA-ANUAL', 'RESPEL-REGISTRO', 'RESPEL-INFORME-ANUAL',
  'RESPEL-MOVIMIENTO', 'EMISIONES-PERMISO', 'EMISIONES-REPORTE',
  'VERTIMIENTOS-PERMISO', 'VERTIMIENTOS-TASA-RETRIBUTIVA',
  'PMA-CONSTRUCCION', 'ESCOMBROS-MANEJO', 'MATRIZ-LEGAL-AMBIENTAL',
  // Nuevos (migración 007)
  'RESPEL-BIOSANIT-PLAN', 'RESPEL-BIOSANIT-REGISTRO', 'BIOSANIT-GESTOR-CONTRATO',
  'RUIDO-SECTOR-SALUD', 'VERTIMIENTOS-GRASAS', 'OLORES-OFENSIVOS',
  'USO-EFICIENTE-AGUA-ALIMENTOS', 'APROVECHAMIENTO-EMPAQUES', 'INVENTARIO-ENERGETICO',
  'SUSTANCIAS-QUIMICAS', 'CONCESION-AGUAS', 'RUIDO-INDUSTRIAL', 'VIBRACIONES-CONTROL',
  'LICENCIA-AMBIENTAL', 'SEGUIMIENTO-LICA', 'DEPOSITO-ESCOMBROS-PERMISO',
  'COMPENSACION-ARBOLES', 'PROGRAMA-RECICLAJE', 'REDUCCION-PLASTICOS',
  'ACEITES-USADOS-POSCONSUMO', 'BATERIAS-POSCONSUMO', 'PRAE',
  'GESTION-AMBIENTAL-ESCOLAR', 'HUELLA-CARBONO', 'REGISTRO-GEI',
  'CAPACITACION-AMBIENTAL', 'INDICADORES-AMBIENTALES', 'APROVECHAMIENTO-FORESTAL',
  'SGA-ISO14001', 'TASA-USO-AGUA',
])

export function assignObligations(profile: ObligationInput): string[] {
  const codes = new Set<string>()

  // ── Obligación base universal
  codes.add('PGIRSR-REGISTRO')

  // ── Por sector
  switch (profile.sector) {
    case 'manufactura':
      codes.add('RUA-ANUAL')
      codes.add('RUIDO-INDUSTRIAL')
      codes.add('SUSTANCIAS-QUIMICAS')
      codes.add('INVENTARIO-ENERGETICO')
      break
    case 'alimentos':
      codes.add('RUA-ANUAL')
      codes.add('VERTIMIENTOS-GRASAS')
      codes.add('OLORES-OFENSIVOS')
      codes.add('APROVECHAMIENTO-EMPAQUES')
      break
    case 'construccion':
      codes.add('PMA-CONSTRUCCION')
      codes.add('ESCOMBROS-MANEJO')
      codes.add('DEPOSITO-ESCOMBROS-PERMISO')
      break
    case 'salud':
      codes.add('RESPEL-REGISTRO')
      codes.add('RESPEL-INFORME-ANUAL')
      codes.add('RESPEL-BIOSANIT-PLAN')
      codes.add('RESPEL-BIOSANIT-REGISTRO')
      codes.add('BIOSANIT-GESTOR-CONTRATO')
      break
    case 'educacion':
      codes.add('PRAE')
      codes.add('GESTION-AMBIENTAL-ESCOLAR')
      codes.add('PROGRAMA-RECICLAJE')
      break
    case 'comercio':
      codes.add('PROGRAMA-RECICLAJE')
      codes.add('REDUCCION-PLASTICOS')
      break
    case 'servicios':
    case 'otro':
      codes.add('PROGRAMA-RECICLAJE')
      break
  }

  // ── Por impactos ambientales declarados
  if (profile.generates_hazardous_waste) {
    codes.add('RESPEL-REGISTRO')
    codes.add('RESPEL-INFORME-ANUAL')
    codes.add('RESPEL-MOVIMIENTO')
  }

  if (profile.has_atmospheric_emissions) {
    codes.add('EMISIONES-PERMISO')
    codes.add('EMISIONES-REPORTE')
    codes.add('RUIDO-INDUSTRIAL')
  }

  if (profile.has_water_discharge) {
    codes.add('VERTIMIENTOS-PERMISO')
    codes.add('VERTIMIENTOS-TASA-RETRIBUTIVA')
  }

  // ── Por tipos de residuos declarados
  if (profile.waste_types?.includes('Aceites y lubricantes usados')) {
    codes.add('ACEITES-USADOS-POSCONSUMO')
  }
  if (profile.waste_types?.includes('Residuos electrónicos (e-waste)')) {
    codes.add('BATERIAS-POSCONSUMO')
  }

  // ── Por tamaño
  if (profile.employee_count === '51-200' || profile.employee_count === '200+') {
    codes.add('MATRIZ-LEGAL-AMBIENTAL')
    codes.add('INDICADORES-AMBIENTALES')
    codes.add('CAPACITACION-AMBIENTAL')
  }
  if (profile.employee_count === '200+') {
    codes.add('HUELLA-CARBONO')
    codes.add('SGA-ISO14001')
  }

  return Array.from(codes).filter((c) => AVAILABLE_CODES.has(c))
}

// ── Fechas de vencimiento reales por código de obligación ──────
// Fechas específicas según normativa colombiana vigente
const SPECIFIC_DUE_DATES: Record<string, { month: number; day: number }> = {
  'RUA-ANUAL':            { month: 3,  day: 31 }, // 31 marzo - Resolución 1023/2010 IDEAM
  'RESPEL-INFORME-ANUAL': { month: 10, day: 31 }, // 31 octubre - Resolución 1362/2007
  'PGIRSR-REGISTRO':      { month: 1,  day: 31 }, // 31 enero
  'MATRIZ-LEGAL-AMBIENTAL':{ month: 12, day: 31 }, // 31 diciembre
  'EMISIONES-REPORTE':    { month: 2,  day: 28 }, // 28 febrero
  'RESPEL-BIOSANIT-PLAN': { month: 3,  day: 31 }, // 31 marzo
  'BIOSANIT-GESTOR-CONTRATO': { month: 1, day: 31 }, // 31 enero
  'USO-EFICIENTE-AGUA-ALIMENTOS': { month: 3, day: 31 },
  'INVENTARIO-ENERGETICO':{ month: 6,  day: 30 },
  'SUSTANCIAS-QUIMICAS':  { month: 12, day: 31 },
  'RUIDO-INDUSTRIAL':     { month: 6,  day: 30 },
  'HUELLA-CARBONO':       { month: 3,  day: 31 },
  'REGISTRO-GEI':         { month: 3,  day: 31 },
  'CAPACITACION-AMBIENTAL':{ month: 12, day: 31 },
  'INDICADORES-AMBIENTALES':{ month: 12, day: 31 },
  'SGA-ISO14001':         { month: 12, day: 31 },
  'PRAE':                 { month: 3,  day: 31 },
  'GESTION-AMBIENTAL-ESCOLAR': { month: 3, day: 31 },
  'PROGRAMA-RECICLAJE':   { month: 1,  day: 31 },
  'REDUCCION-PLASTICOS':  { month: 6,  day: 30 },
  'ACEITES-USADOS-POSCONSUMO': { month: 12, day: 31 },
  'BATERIAS-POSCONSUMO':  { month: 12, day: 31 },
  'APROVECHAMIENTO-EMPAQUES': { month: 9, day: 30 },
  'OLORES-OFENSIVOS':     { month: 6,  day: 30 },
}

export function calculateDueDate(
  frequency: 'annual' | 'quarterly' | 'biannual' | 'monthly' | 'event',
  obligationCode?: string
): string | null {
  const now = new Date()

  // Si hay fecha específica para este código, úsala
  if (obligationCode && SPECIFIC_DUE_DATES[obligationCode]) {
    const { month, day } = SPECIFIC_DUE_DATES[obligationCode]!
    const year = now.getMonth() + 1 >= month ? now.getFullYear() + 1 : now.getFullYear()
    return new Date(year, month - 1, day).toISOString().split('T')[0]!
  }

  switch (frequency) {
    case 'annual': {
      // Por defecto: 31 de marzo del año siguiente
      return new Date(now.getFullYear() + 1, 2, 31).toISOString().split('T')[0]!
    }
    case 'biannual': {
      const month = now.getMonth()
      if (month < 5) return new Date(now.getFullYear(), 5, 30).toISOString().split('T')[0]!
      if (month < 11) return new Date(now.getFullYear(), 11, 31).toISOString().split('T')[0]!
      return new Date(now.getFullYear() + 1, 5, 30).toISOString().split('T')[0]!
    }
    case 'quarterly': {
      const quarter = Math.floor(now.getMonth() / 3)
      const nextQuarterEnd = new Date(now.getFullYear(), (quarter + 2) * 3, 0)
      return nextQuarterEnd.toISOString().split('T')[0]!
    }
    case 'monthly': {
      return new Date(now.getFullYear(), now.getMonth() + 2, 0).toISOString().split('T')[0]!
    }
    case 'event':
      return null
  }
}
