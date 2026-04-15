'use client'

// Onboarding wizard — 3 pasos
// ─────────────────────────────────────────────────────────────
// Este componente es la pieza más importante de activación.
// Cada campo capturado aquí alimenta:
//   · buildSystemPrompt() → respuestas de chat contextualizadas
//   · assignObligations() → lista de obligaciones específicas
//   · dashboard → semáforo de cumplimiento real
//
// Principio: pedir lo mínimo que genera el máximo valor.
// Un formulario largo genera abandono; uno corto genera activación.

import { useState } from 'react'
import { useRouter } from 'next/navigation'

// ─── Datos de referencia ─────────────────────────────────────

const DEPARTAMENTOS = [
  'Amazonas', 'Antioquia', 'Arauca', 'Atlántico', 'Bolívar', 'Boyacá',
  'Caldas', 'Caquetá', 'Casanare', 'Cauca', 'Cesar', 'Chocó', 'Córdoba',
  'Cundinamarca', 'Bogotá D.C.', 'Guainía', 'Guaviare', 'Huila', 'La Guajira',
  'Magdalena', 'Meta', 'Nariño', 'Norte de Santander', 'Putumayo', 'Quindío',
  'Risaralda', 'San Andrés', 'Santander', 'Sucre', 'Tolima', 'Valle del Cauca',
  'Vaupés', 'Vichada',
]

const SECTORES = [
  { value: 'manufactura',  label: 'Manufactura e industria' },
  { value: 'alimentos',    label: 'Alimentos y bebidas' },
  { value: 'construccion', label: 'Construcción y obras civiles' },
  { value: 'salud',        label: 'Salud y servicios médicos' },
  { value: 'comercio',     label: 'Comercio y distribución' },
  { value: 'servicios',    label: 'Servicios empresariales' },
  { value: 'educacion',    label: 'Educación' },
  { value: 'otro',         label: 'Otro sector' },
]

const TAMANOS = [
  { value: '1-10',    label: '1 – 10 empleados',   sub: 'Microempresa' },
  { value: '11-50',   label: '11 – 50 empleados',  sub: 'Pequeña empresa' },
  { value: '51-200',  label: '51 – 200 empleados', sub: 'Mediana empresa' },
  { value: '200+',    label: 'Más de 200',          sub: 'Gran empresa' },
]

const ACTIVIDADES = [
  'Producción o manufactura',
  'Almacenamiento de materiales',
  'Uso de solventes o pinturas',
  'Lavado de vehículos o maquinaria',
  'Mantenimiento mecánico o industrial',
  'Servicios de laboratorio',
  'Generación de energía propia (planta eléctrica)',
  'Manejo de alimentos en gran escala',
  'Obras de construcción o demolición',
  'Ninguna de las anteriores',
]

const TIPOS_RESIDUOS = [
  'Residuos sólidos comunes (ordinarios)',
  'Residuos reciclables (papel, cartón, plástico, vidrio)',
  'Residuos peligrosos (RESPEL)',
  'Residuos de construcción (escombros)',
  'Residuos biosanitarios o de riesgo biológico',
  'Aceites y lubricantes usados',
  'Residuos electrónicos (e-waste)',
]

const PERMISOS = [
  'Permiso de emisiones atmosféricas',
  'Permiso de vertimientos',
  'Registro como generador RESPEL',
  'Plan de manejo ambiental (PMA)',
  'Concesión de aguas',
  'Ninguno por ahora',
]

// ─── Tipos del formulario ────────────────────────────────────

interface Step1Data {
  name: string
  nit: string
  city: string
  department: string
  sector: string
  employee_count: string
}

interface Step2Data {
  activities: string[]
  generates_hazardous_waste: boolean | null
  has_atmospheric_emissions: boolean | null
  has_water_discharge: boolean | null
  waste_types: string[]
  current_permits: string[]
}

interface Step3Data {
  current_urgencies: string
}

interface FormData extends Step1Data, Step2Data, Step3Data {}

const INITIAL_FORM: FormData = {
  // Paso 1
  name: '', nit: '', city: '', department: '', sector: '', employee_count: '',
  // Paso 2
  activities: [], generates_hazardous_waste: null,
  has_atmospheric_emissions: null, has_water_discharge: null,
  waste_types: [], current_permits: [],
  // Paso 3
  current_urgencies: '',
}

// ─── Validaciones por paso ───────────────────────────────────

function validateStep1(data: FormData): string | null {
  if (!data.name.trim() || data.name.length < 2) return 'El nombre de la empresa es obligatorio'
  if (!data.nit.trim() || data.nit.length < 9) return 'Ingresa el NIT de la empresa (mínimo 9 dígitos)'
  if (!data.city.trim() || data.city.length < 2) return 'Ingresa la ciudad'
  if (!data.department) return 'Selecciona el departamento'
  if (!data.sector) return 'Selecciona el sector de tu empresa'
  if (!data.employee_count) return 'Indica el tamaño de la empresa'
  return null
}

function validateStep2(data: FormData): string | null {
  if (data.activities.length === 0) return 'Selecciona al menos una actividad'
  if (data.generates_hazardous_waste === null) return 'Indica si generas residuos peligrosos'
  if (data.has_atmospheric_emissions === null) return 'Indica si tienes emisiones atmosféricas'
  if (data.has_water_discharge === null) return 'Indica si realizas vertimientos'
  return null
}

// ─── Componentes de apoyo ────────────────────────────────────

function ProgressBar({ step, total }: { step: number; total: number }) {
  return (
    <div className="mb-8">
      <div className="flex items-center justify-between mb-2">
        {Array.from({ length: total }).map((_, i) => (
          <div key={i} className="flex items-center flex-1">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold flex-shrink-0 transition-colors ${
              i + 1 < step ? 'bg-brand-600 text-white' :
              i + 1 === step ? 'bg-brand-600 text-white ring-4 ring-brand-100' :
              'bg-surface-100 text-surface-400'
            }`}>
              {i + 1 < step ? '✓' : i + 1}
            </div>
            {i < total - 1 && (
              <div className={`flex-1 h-0.5 mx-2 transition-colors ${
                i + 1 < step ? 'bg-brand-600' : 'bg-surface-100'
              }`} />
            )}
          </div>
        ))}
      </div>
      <div className="flex justify-between text-xs text-surface-400 mt-1">
        <span>Tu empresa</span>
        <span>Perfil ambiental</span>
        <span>Estado actual</span>
      </div>
    </div>
  )
}

function YesNoField({
  label, sublabel, value, onChange,
}: { label: string; sublabel?: string; value: boolean | null; onChange: (v: boolean) => void }) {
  return (
    <div>
      <p className="text-sm font-medium text-surface-800 mb-1">{label}</p>
      {sublabel && <p className="text-xs text-surface-400 mb-2">{sublabel}</p>}
      <div className="flex gap-3">
        <button
          type="button"
          onClick={() => onChange(true)}
          className={`flex-1 py-2.5 rounded-xl text-sm font-medium border transition-colors ${
            value === true
              ? 'bg-brand-600 text-white border-brand-600'
              : 'bg-white text-surface-700 border-surface-200 hover:border-brand-300'
          }`}
        >
          Sí
        </button>
        <button
          type="button"
          onClick={() => onChange(false)}
          className={`flex-1 py-2.5 rounded-xl text-sm font-medium border transition-colors ${
            value === false
              ? 'bg-surface-800 text-white border-surface-800'
              : 'bg-white text-surface-700 border-surface-200 hover:border-surface-400'
          }`}
        >
          No
        </button>
      </div>
    </div>
  )
}

function CheckboxGroup({
  options, selected, onChange,
}: { options: string[]; selected: string[]; onChange: (v: string[]) => void }) {
  function toggle(item: string) {
    if (selected.includes(item)) {
      onChange(selected.filter((s) => s !== item))
    } else {
      onChange([...selected, item])
    }
  }
  return (
    <div className="space-y-2">
      {options.map((opt) => (
        <label key={opt} className="flex items-start gap-3 cursor-pointer group">
          <input
            type="checkbox"
            checked={selected.includes(opt)}
            onChange={() => toggle(opt)}
            className="mt-0.5 w-4 h-4 text-brand-600 rounded border-surface-300 cursor-pointer"
          />
          <span className="text-sm text-surface-800 group-hover:text-surface-900 leading-snug">
            {opt}
          </span>
        </label>
      ))}
    </div>
  )
}

// ─── Wizard principal ────────────────────────────────────────

export default function OnboardingPage() {
  const router = useRouter()
  const [step, setStep] = useState(1)
  const [data, setData] = useState<FormData>(INITIAL_FORM)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  function update(partial: Partial<FormData>) {
    setData((prev) => ({ ...prev, ...partial }))
  }

  function handleNext() {
    setError('')
    const err = step === 1 ? validateStep1(data) : step === 2 ? validateStep2(data) : null
    if (err) { setError(err); return }
    setStep((s) => s + 1)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function handleSubmit() {
    setError('')
    setSaving(true)

    const payload = {
      // Paso 1
      name: data.name.trim(),
      nit: data.nit.trim(),
      city: data.city.trim(),
      department: data.department,
      sector: data.sector,
      employee_count: data.employee_count,
      // Paso 2
      activities: data.activities,
      generates_hazardous_waste: data.generates_hazardous_waste ?? false,
      has_atmospheric_emissions: data.has_atmospheric_emissions ?? false,
      has_water_discharge: data.has_water_discharge ?? false,
      waste_types: data.waste_types,
      current_permits: data.current_permits,
      // Paso 3
      current_urgencies: data.current_urgencies.trim(),
    }

    try {
      const res = await fetch('/api/onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const json = await res.json()

      if (!res.ok) {
        setError(json.error ?? 'Error guardando la información. Intenta de nuevo.')
        setSaving(false)
        return
      }

      // Redirigir a la pantalla de éxito con el conteo de obligaciones
      const count = json.data?.obligations_count ?? 0
      router.push(`/onboarding/completado?obligaciones=${count}`)
    } catch {
      setError('Error de conexión. Verifica tu internet e intenta de nuevo.')
      setSaving(false)
    }
  }

  return (
    <div className="min-h-screen bg-surface-50 flex items-start justify-center px-4 py-10">
      <div className="w-full max-w-xl">
        {/* Header */}
        <div className="text-center mb-8">
          <span className="text-2xl font-bold text-brand-600">Regenera</span>
          <p className="text-surface-400 text-sm mt-1">
            Configuremos tu perfil ambiental — tarda menos de 5 minutos
          </p>
        </div>

        <div className="bg-white rounded-2xl border border-surface-200 p-6 md:p-8 shadow-sm">
          <ProgressBar step={step} total={3} />

          {/* ── Paso 1: Datos de la empresa ──────────────────── */}
          {step === 1 && (
            <div className="space-y-5">
              <div>
                <h2 className="text-lg font-semibold text-surface-900">Tu empresa</h2>
                <p className="text-sm text-surface-400 mt-1">
                  Esta información nos permite contextualizar tu normativa aplicable
                </p>
              </div>

              <div>
                <label className="label">Nombre o razón social</label>
                <input type="text" className="input" placeholder="Empresa S.A.S."
                  value={data.name} onChange={(e) => update({ name: e.target.value })} autoFocus />
              </div>

              <div>
                <label className="label">NIT</label>
                <input type="text" className="input" placeholder="900123456-1"
                  value={data.nit} onChange={(e) => update({ nit: e.target.value })} />
                <p className="text-xs text-surface-400 mt-1">Con o sin dígito de verificación</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Ciudad</label>
                  <input type="text" className="input" placeholder="Medellín"
                    value={data.city} onChange={(e) => update({ city: e.target.value })} />
                </div>
                <div>
                  <label className="label">Departamento</label>
                  <select className="input" value={data.department}
                    onChange={(e) => update({ department: e.target.value })}>
                    <option value="">Seleccionar…</option>
                    {DEPARTAMENTOS.map((d) => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label className="label">Sector de tu empresa</label>
                <div className="grid grid-cols-2 gap-2 mt-1">
                  {SECTORES.map((s) => (
                    <button key={s.value} type="button"
                      onClick={() => update({ sector: s.value })}
                      className={`text-left px-3 py-2.5 rounded-xl text-sm border transition-colors ${
                        data.sector === s.value
                          ? 'bg-brand-50 border-brand-400 text-brand-800 font-medium'
                          : 'bg-white border-surface-200 text-surface-700 hover:border-brand-300'
                      }`}>
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="label">Tamaño de la empresa</label>
                <div className="space-y-2 mt-1">
                  {TAMANOS.map((t) => (
                    <button key={t.value} type="button"
                      onClick={() => update({ employee_count: t.value })}
                      className={`w-full text-left px-4 py-3 rounded-xl border flex items-center justify-between transition-colors ${
                        data.employee_count === t.value
                          ? 'bg-brand-50 border-brand-400'
                          : 'bg-white border-surface-200 hover:border-brand-300'
                      }`}>
                      <span className={`text-sm font-medium ${data.employee_count === t.value ? 'text-brand-800' : 'text-surface-800'}`}>
                        {t.label}
                      </span>
                      <span className="text-xs text-surface-400">{t.sub}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── Paso 2: Perfil ambiental ──────────────────────── */}
          {step === 2 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-lg font-semibold text-surface-900">Perfil ambiental</h2>
                <p className="text-sm text-surface-400 mt-1">
                  Esto define qué obligaciones aplican a tu empresa
                </p>
              </div>

              <div>
                <label className="label">¿Cuáles de estas actividades realiza tu empresa?</label>
                <p className="text-xs text-surface-400 mb-3">Selecciona todas las que apliquen</p>
                <CheckboxGroup
                  options={ACTIVIDADES}
                  selected={data.activities}
                  onChange={(v) => update({ activities: v })}
                />
              </div>

              <div className="space-y-4 pt-2 border-t border-surface-100">
                <p className="text-sm font-medium text-surface-700">Impactos ambientales directos:</p>

                <YesNoField
                  label="¿Generas residuos peligrosos (RESPEL)?"
                  sublabel="Baterías, aceites usados, solventes, residuos de laboratorio, etc."
                  value={data.generates_hazardous_waste}
                  onChange={(v) => update({ generates_hazardous_waste: v })}
                />

                <YesNoField
                  label="¿Tienes emisiones al aire? (fuentes fijas)"
                  sublabel="Chimeneas, calderas, hornos, plantas eléctricas de uso continuo"
                  value={data.has_atmospheric_emissions}
                  onChange={(v) => update({ has_atmospheric_emissions: v })}
                />

                <YesNoField
                  label="¿Realizas vertimientos de aguas residuales?"
                  sublabel="Descarga de aguas de proceso, lavado o producción a alcantarillado o cuerpos de agua"
                  value={data.has_water_discharge}
                  onChange={(v) => update({ has_water_discharge: v })}
                />
              </div>

              {/* Campos opcionales — se muestran siempre pero son opcionales */}
              <div className="space-y-4 pt-2 border-t border-surface-100">
                <div>
                  <label className="label">Tipos de residuos que generas <span className="text-surface-400 font-normal">(opcional)</span></label>
                  <p className="text-xs text-surface-400 mb-3">Ayuda a afinar las obligaciones</p>
                  <CheckboxGroup
                    options={TIPOS_RESIDUOS}
                    selected={data.waste_types}
                    onChange={(v) => update({ waste_types: v })}
                  />
                </div>

                <div>
                  <label className="label">Permisos ambientales que ya tienes <span className="text-surface-400 font-normal">(opcional)</span></label>
                  <CheckboxGroup
                    options={PERMISOS}
                    selected={data.current_permits}
                    onChange={(v) => update({ current_permits: v })}
                  />
                </div>
              </div>
            </div>
          )}

          {/* ── Paso 3: Estado actual ─────────────────────────── */}
          {step === 3 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-lg font-semibold text-surface-900">Estado actual</h2>
                <p className="text-sm text-surface-400 mt-1">
                  Esta información es opcional pero nos ayuda a priorizar tu acompañamiento
                </p>
              </div>

              <div className="bg-brand-50 border border-brand-100 rounded-xl p-4">
                <p className="text-sm font-medium text-brand-800 mb-1">
                  Ya casi terminamos 🎉
                </p>
                <p className="text-xs text-brand-700">
                  Con los datos que diste, ya podemos identificar tus obligaciones ambientales.
                  Esta última sección nos ayuda a personalizar aún más tu acompañamiento.
                </p>
              </div>

              <div>
                <label className="label">
                  ¿Tienes alguna urgencia o situación ambiental activa?{' '}
                  <span className="text-surface-400 font-normal">(opcional)</span>
                </label>
                <p className="text-xs text-surface-400 mb-2">
                  Por ejemplo: requerimiento de autoridad ambiental, visita pendiente, permiso por vencer, multa en curso
                </p>
                <textarea
                  className="input resize-none"
                  rows={4}
                  placeholder="Ejemplo: Recibimos una visita de la CAR el mes pasado por nuestros vertimientos. Nos dieron 30 días para presentar un plan de manejo..."
                  value={data.current_urgencies}
                  onChange={(e) => update({ current_urgencies: e.target.value })}
                  maxLength={500}
                />
                <p className="text-xs text-surface-400 mt-1 text-right">
                  {data.current_urgencies.length}/500
                </p>
              </div>

              <div className="bg-surface-50 rounded-xl p-4 text-sm text-surface-600">
                <p className="font-medium text-surface-800 mb-2">Al completar el onboarding:</p>
                <ul className="space-y-1.5">
                  <li className="flex items-start gap-2">
                    <span className="text-brand-600 mt-0.5">✓</span>
                    Identificaremos tus obligaciones ambientales aplicables
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-brand-600 mt-0.5">✓</span>
                    Nuestro asesor IA conocerá el contexto de tu empresa
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-brand-600 mt-0.5">✓</span>
                    Verás un semáforo de cumplimiento personalizado
                  </li>
                </ul>
              </div>
            </div>
          )}

          {/* ── Mensaje de error ──────────────────────────────── */}
          {error && (
            <div className="mt-4 px-4 py-3 bg-red-50 border border-red-100 rounded-xl">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          {/* ── Navegación ───────────────────────────────────── */}
          <div className="flex gap-3 mt-8">
            {step > 1 && (
              <button type="button" onClick={() => { setError(''); setStep((s) => s - 1) }}
                className="flex-1 py-3 rounded-xl border border-surface-200 text-sm font-medium text-surface-700 hover:bg-surface-50 transition-colors">
                ← Anterior
              </button>
            )}
            {step < 3 ? (
              <button type="button" onClick={handleNext}
                className="flex-1 btn-primary py-3 text-sm">
                Siguiente →
              </button>
            ) : (
              <button type="button" onClick={handleSubmit} disabled={saving}
                className="flex-1 btn-primary py-3 text-sm disabled:opacity-60">
                {saving ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Analizando tu empresa…
                  </span>
                ) : 'Completar configuración →'}
              </button>
            )}
          </div>
        </div>

        <p className="text-xs text-surface-400 text-center mt-4">
          Tu información es confidencial y solo es usada para personalizar tu asesoría ambiental
        </p>
      </div>
    </div>
  )
}
