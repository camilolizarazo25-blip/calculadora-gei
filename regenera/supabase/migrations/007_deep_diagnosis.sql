-- ============================================================
-- Regenera Platform — Deep Diagnosis v1.0
-- Diagnóstico ambiental profundo con IA + más plantillas
-- Aplicar DESPUÉS de 006_analytics.sql
-- ============================================================

-- ──────────────────────────────────────────────────────────────
-- 1. Campo ai_diagnosis en organizations
--    Almacena el resultado del análisis IA post-onboarding:
--    obligaciones específicas, referencias legales, riesgo, etc.
-- ──────────────────────────────────────────────────────────────
ALTER TABLE organizations
    ADD COLUMN IF NOT EXISTS ai_diagnosis jsonb;

-- ──────────────────────────────────────────────────────────────
-- 2. Fechas específicas de vencimiento en obligation_templates
--    typical_due_month: mes del año (1-12, null = depende del evento)
--    typical_due_day:   día del mes (1-31, null = último día del mes)
-- ──────────────────────────────────────────────────────────────
ALTER TABLE obligation_templates
    ADD COLUMN IF NOT EXISTS typical_due_month integer CHECK (typical_due_month BETWEEN 1 AND 12),
    ADD COLUMN IF NOT EXISTS typical_due_day   integer CHECK (typical_due_day   BETWEEN 1 AND 31);

-- Actualizar las plantillas existentes con fechas específicas reales
-- RUA: vence el 31 de marzo (mes 3, día 31)
UPDATE obligation_templates SET typical_due_month = 3,  typical_due_day = 31 WHERE code = 'RUA-ANUAL';
-- RESPEL informe anual: vence el 31 de octubre (mes 10, día 31)
UPDATE obligation_templates SET typical_due_month = 10, typical_due_day = 31 WHERE code = 'RESPEL-INFORME-ANUAL';
-- PGIRSR: vence el 31 de enero (mes 1, día 31)
UPDATE obligation_templates SET typical_due_month = 1,  typical_due_day = 31 WHERE code = 'PGIRSR-REGISTRO';
-- Matriz legal: vence el 31 de diciembre (mes 12, día 31)
UPDATE obligation_templates SET typical_due_month = 12, typical_due_day = 31 WHERE code = 'MATRIZ-LEGAL-AMBIENTAL';
-- Emisiones reporte: vence el 28 de febrero (mes 2)
UPDATE obligation_templates SET typical_due_month = 2,  typical_due_day = 28 WHERE code = 'EMISIONES-REPORTE';

-- ──────────────────────────────────────────────────────────────
-- 3. Nuevas plantillas de obligaciones (30 adicionales)
--    Cubren salud, alimentos, manufactura, construcción, comercio,
--    servicios, educación y obligaciones transversales.
-- ──────────────────────────────────────────────────────────────

INSERT INTO obligation_templates
    (code, title, description, authority, frequency, applicable_sectors, priority, typical_due_month, typical_due_day)
VALUES

-- ── SALUD ────────────────────────────────────────────────────
('RESPEL-BIOSANIT-PLAN',
 'Plan de Gestión Integral de Residuos Hospitalarios (PGIRH)',
 'Documento de gestión y manejo de residuos con riesgo biológico, químico y radiactivo. Obligatorio para IPS, EPS, laboratorios clínicos y consultorios. Resolución 1164/2002 MAVDT.',
 'Ministerio de Salud / Autoridad Ambiental Regional', 'annual',
 ARRAY['salud'], 'high', 3, 31),

('RESPEL-BIOSANIT-REGISTRO',
 'Registro de Generadores de Residuos Hospitalarios y Similares',
 'Inscripción ante el IDEAM como generador de residuos hospitalarios. Resolución 1362/2007 y Decreto 4741/2005.',
 'IDEAM', 'event',
 ARRAY['salud'], 'high', NULL, NULL),

('BIOSANIT-GESTOR-CONTRATO',
 'Contrato con Gestor Autorizado de Residuos Biosanitarios',
 'Contratación de empresa autorizada para recolección, transporte y tratamiento de residuos biosanitarios. Decreto 780/2016 sector salud.',
 'Autoridad Ambiental Regional', 'annual',
 ARRAY['salud'], 'high', 1, 31),

('RUIDO-SECTOR-SALUD',
 'Monitoreo de Ruido Ambiental — Sector Salud',
 'Las IPS deben garantizar niveles de ruido adecuados para la recuperación de pacientes. Resolución 0627/2006 MADS.',
 'Autoridad Ambiental Regional / Alcaldía', 'annual',
 ARRAY['salud'], 'medium', 6, 30),

-- ── ALIMENTOS ────────────────────────────────────────────────
('VERTIMIENTOS-GRASAS',
 'Trampa de Grasas y Permiso de Vertimientos — Sector Alimentos',
 'Instalación y mantenimiento de trampa de grasas con limpieza periódica. Permiso de vertimientos para aguas residuales con carga orgánica alta. Resolución 0631/2015 MADS.',
 'Autoridad Ambiental Regional / Empresa de Acueducto', 'quarterly',
 ARRAY['alimentos'], 'high', NULL, NULL),

('OLORES-OFENSIVOS',
 'Plan de Manejo de Olores Ofensivos',
 'Caracterización de fuentes de olores y plan de mitigación. Aplica a plantas de alimentos con procesos de cocción, fermentación o almacenamiento. Resolución 1541/2013 MADS.',
 'Autoridad Ambiental Regional', 'annual',
 ARRAY['alimentos', 'manufactura'], 'medium', 6, 30),

('USO-EFICIENTE-AGUA-ALIMENTOS',
 'Programa de Uso Eficiente y Ahorro del Agua (PUEAA)',
 'Plan quinquenal de ahorro y uso eficiente del agua. Obligatorio si usan concesión de aguas o tienen alto consumo. Ley 373/1997.',
 'Autoridad Ambiental Regional', 'annual',
 ARRAY['alimentos', 'manufactura', 'salud'], 'medium', 3, 31),

('APROVECHAMIENTO-EMPAQUES',
 'Plan de Gestión de Devolución de Productos Posconsumo',
 'Si la empresa usa empaques plásticos o vidrio en escala industrial, debe adherirse a un plan colectivo de posconsumo. Resolución 1407/2018 MADS.',
 'MADS / Autoridad Ambiental', 'annual',
 ARRAY['alimentos', 'manufactura', 'comercio'], 'medium', 9, 30),

-- ── MANUFACTURA ──────────────────────────────────────────────
('INVENTARIO-ENERGETICO',
 'Inventario y Plan de Gestión Energética',
 'Diagnóstico del consumo energético e implementación de medidas de eficiencia. Ley 1715/2014 y Decreto 1623/2015. Aplica a grandes consumidores de energía.',
 'UPME / Ministerio de Minas', 'annual',
 ARRAY['manufactura', 'alimentos'], 'medium', 6, 30),

('SUSTANCIAS-QUIMICAS',
 'Registro y Control de Sustancias Químicas Peligrosas',
 'Inventario de productos químicos, hojas de seguridad (SDS/MSDS) actualizadas y plan de contingencia. Decreto 1079/2015. Obligatorio si usan solventes, ácidos, bases, etc.',
 'Ministerio de Ambiente / Autoridad Ambiental', 'annual',
 ARRAY['manufactura', 'alimentos', 'salud'], 'high', 12, 31),

('CONCESION-AGUAS',
 'Concesión de Aguas Superficiales o Subterráneas',
 'Trámite de obtención o renovación de concesión para captación de aguas. Aplica si la empresa tiene captación propia (pozo, quebrada, río). Decreto 1076/2015 Art. 2.2.3.2.',
 'Autoridad Ambiental Regional', 'event',
 ARRAY['manufactura', 'alimentos', 'construccion'], 'high', NULL, NULL),

('RUIDO-INDUSTRIAL',
 'Monitoreo y Control de Ruido Industrial (Fuentes Fijas)',
 'Medición de niveles de presión sonora en fuentes fijas y perímetro. Resolución 0627/2006 MADS. Aplica a industrias con maquinaria de alto ruido.',
 'Autoridad Ambiental Regional', 'annual',
 ARRAY['manufactura', 'alimentos', 'construccion'], 'medium', 6, 30),

('VIBRACIONES-CONTROL',
 'Control de Vibraciones Mecánicas',
 'Monitoreo de vibraciones en instalaciones industriales con maquinaria pesada. NTC 2234 y Decreto 948/1995.',
 'Autoridad Ambiental Regional', 'annual',
 ARRAY['manufactura', 'construccion'], 'low', NULL, NULL),

-- ── CONSTRUCCIÓN ─────────────────────────────────────────────
('LICENCIA-AMBIENTAL',
 'Licencia Ambiental para Proyectos',
 'Autorización para ejecutar proyectos que pueden causar deterioro grave a los recursos naturales o al ambiente. Decreto 1076/2015 Art. 2.2.2.3. Obligatoria para proyectos de infraestructura mayor.',
 'ANLA o Autoridad Ambiental Regional', 'event',
 ARRAY['construccion'], 'high', NULL, NULL),

('SEGUIMIENTO-LICA',
 'Informe de Cumplimiento Ambiental (ICA) — Licencia Ambiental',
 'Reporte semestral de cumplimiento de las obligaciones de la licencia ambiental. Resolución 1503/2010 MADS.',
 'ANLA / Autoridad Ambiental Regional', 'biannual',
 ARRAY['construccion'], 'high', NULL, NULL),

('DEPOSITO-ESCOMBROS-PERMISO',
 'Autorización para Depósito de Escombros',
 'Permiso ante la autoridad municipal para uso de escombreras o zonas de depósito de RCDs. Resolución 472/2017 MADS.',
 'Alcaldía / Autoridad Ambiental', 'event',
 ARRAY['construccion'], 'medium', NULL, NULL),

('COMPENSACION-ARBOLES',
 'Permiso de Tala y Plan de Compensación Forestal',
 'Permiso ante la autoridad ambiental para talar o trasplantar árboles durante obras. Plan de compensación (reforestar). Decreto 1076/2015 Art. 2.2.1.1.',
 'Autoridad Ambiental Regional / SDA', 'event',
 ARRAY['construccion'], 'high', NULL, NULL),

-- ── COMERCIO / SERVICIOS ─────────────────────────────────────
('PROGRAMA-RECICLAJE',
 'Programa de Separación en la Fuente y Reciclaje',
 'Implementación y reporte del programa de separación de residuos sólidos reciclables. Decreto 2981/2013 y Resolución 754/2014.',
 'Municipio / Empresa de Aseo', 'annual',
 ARRAY['comercio', 'servicios', 'educacion', 'otro'], 'medium', 1, 31),

('REDUCCION-PLASTICOS',
 'Plan de Reducción de Plásticos de un Solo Uso',
 'Estrategia para reducir plásticos de un solo uso en operaciones de la empresa. Resolución 1407/2018 y Ley 2232/2022.',
 'MADS / Autoridad Ambiental', 'annual',
 ARRAY['comercio', 'servicios', 'alimentos'], 'medium', 6, 30),

('ACEITES-USADOS-POSCONSUMO',
 'Gestión de Aceites Lubricantes Usados (Posconsumo)',
 'Entrega de aceites usados a gestores autorizados. Registro de volúmenes entregados. Resolución 1188/2003 MAVDT.',
 'MADS / Punto de recolección autorizado', 'annual',
 ARRAY['comercio', 'servicios', 'manufactura'], 'medium', 12, 31),

('BATERIAS-POSCONSUMO',
 'Gestión de Baterías y Pilas Usadas (Posconsumo)',
 'Entrega de baterías plomo-ácido y pilas a gestores autorizados. Resolución 372/2009 y 1297/2010 MADS.',
 'MADS / Punto de recolección autorizado', 'annual',
 ARRAY['comercio', 'servicios', 'manufactura', 'salud'], 'medium', 12, 31),

-- ── EDUCACIÓN ────────────────────────────────────────────────
('PRAE',
 'Proyecto Ambiental Escolar (PRAE)',
 'Proyecto obligatorio para instituciones educativas que incorpora la problemática ambiental local al currículo. Decreto 1743/1994 MEN-MADS.',
 'Secretaría de Educación / Autoridad Ambiental', 'annual',
 ARRAY['educacion'], 'high', 3, 31),

('GESTION-AMBIENTAL-ESCOLAR',
 'Plan de Gestión Ambiental Escolar (PGAE)',
 'Documento que integra el manejo de residuos, agua y energía en la institución educativa. Complementario al PRAE.',
 'Secretaría de Educación / Municipio', 'annual',
 ARRAY['educacion'], 'medium', 3, 31),

-- ── TRANSVERSAL / TODAS LAS EMPRESAS ─────────────────────────
('HUELLA-CARBONO',
 'Medición de Huella de Carbono (Alcances 1, 2 y 3)',
 'Inventario de emisiones de gases de efecto invernadero según protocolo GHG. Recomendado para cumplimiento de metas NDC Colombia. IPCC / ISO 14064.',
 'IDEAM / Autoridad Ambiental (voluntario)', 'annual',
 ARRAY['manufactura', 'alimentos', 'construccion', 'salud', 'comercio', 'servicios', 'educacion', 'otro'], 'low', 3, 31),

('REGISTRO-GEI',
 'Registro en el Sistema de Información de GEI (SIRECE)',
 'Reporte de emisiones de gases efecto invernadero al IDEAM. Obligatorio para empresas con emisiones superiores a 100.000 tCO2e/año. Decreto 298/2016.',
 'IDEAM', 'annual',
 ARRAY['manufactura', 'alimentos', 'construccion'], 'medium', 3, 31),

('CAPACITACION-AMBIENTAL',
 'Programa de Capacitación Ambiental al Personal',
 'Plan anual de capacitación en gestión ambiental, manejo de residuos y normativa aplicable al personal. Recomendado en ISO 14001 y SGA.',
 'Interno / Autoridad Ambiental (cuando aplique)', 'annual',
 ARRAY['manufactura', 'alimentos', 'servicios', 'construccion', 'salud', 'comercio', 'educacion', 'otro'], 'low', 12, 31),

('INDICADORES-AMBIENTALES',
 'Seguimiento a Indicadores de Desempeño Ambiental (IDA)',
 'Medición y reporte de indicadores de consumo de agua, energía, generación de residuos y emisiones. Parte del Sistema de Gestión Ambiental (ISO 14001).',
 'Interno / Autoridad Ambiental', 'annual',
 ARRAY['manufactura', 'alimentos', 'servicios', 'construccion', 'salud', 'comercio', 'educacion', 'otro'], 'low', 12, 31),

('APROVECHAMIENTO-FORESTAL',
 'Permiso de Aprovechamiento Forestal',
 'Autorización para aprovechamiento de productos forestales de bosques naturales. Decreto 1076/2015 Art. 2.2.1.1. Aplica a empresas que explotan madera o talan árboles para obras.',
 'Autoridad Ambiental Regional', 'event',
 ARRAY['construccion', 'manufactura'], 'high', NULL, NULL),

('SGA-ISO14001',
 'Sistema de Gestión Ambiental (SGA) — ISO 14001',
 'Implementación o mantenimiento del Sistema de Gestión Ambiental certificado o no certificado. Referencia ISO 14001:2015. Recomendado para empresas medianas y grandes.',
 'Organismo certificador (voluntario)', 'annual',
 ARRAY['manufactura', 'alimentos', 'construccion', 'salud', 'comercio', 'servicios'], 'low', 12, 31),

('TASA-USO-AGUA',
 'Pago de Tasa por Uso de Agua',
 'Cobro por captación de aguas superficiales o subterráneas con concesión. Decreto 155/2004 y Decreto 1076/2015 Art. 2.2.9.7.',
 'Autoridad Ambiental Regional', 'quarterly',
 ARRAY['manufactura', 'alimentos', 'construccion', 'salud'], 'medium', NULL, NULL)

ON CONFLICT (code) DO NOTHING;

-- ──────────────────────────────────────────────────────────────
-- 4. Índice para búsqueda eficiente de diagnóstico IA
-- ──────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_organizations_ai_diagnosis
    ON organizations USING gin(ai_diagnosis)
    WHERE ai_diagnosis IS NOT NULL;
