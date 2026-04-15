// Anillo de cumplimiento — muestra el porcentaje visualmente.
// Server Component puro — sin estado ni interacción.

interface Props {
  percent: number
  doneCount: number
  totalCount: number
}

export function ComplianceRing({ percent, doneCount, totalCount }: Props) {
  // Parámetros del círculo SVG
  const radius = 32
  const circumference = 2 * Math.PI * radius
  const filled = circumference * (percent / 100)
  const gap = circumference - filled

  const color = percent >= 80 ? '#22c55e' : percent >= 50 ? '#eab308' : '#ef4444'

  return (
    <div className="flex items-center gap-4">
      {/* SVG anillo */}
      <div className="relative w-20 h-20 flex-shrink-0">
        <svg viewBox="0 0 80 80" className="w-20 h-20 -rotate-90">
          {/* Fondo */}
          <circle cx="40" cy="40" r={radius} fill="none" stroke="#f1f5f9" strokeWidth="8" />
          {/* Progreso */}
          <circle
            cx="40" cy="40" r={radius}
            fill="none"
            stroke={color}
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={`${filled} ${gap}`}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-lg font-bold text-surface-900">{percent}%</span>
        </div>
      </div>

      <div>
        <p className="text-sm font-semibold text-surface-900">Cumplimiento</p>
        <p className="text-xs text-surface-400 mt-0.5">
          {doneCount} de {totalCount} obligaciones cumplidas
        </p>
        {percent < 50 && (
          <p className="text-xs text-red-600 font-medium mt-1">
            Necesita atención
          </p>
        )}
        {percent >= 50 && percent < 80 && (
          <p className="text-xs text-yellow-600 font-medium mt-1">
            En progreso
          </p>
        )}
        {percent >= 80 && (
          <p className="text-xs text-brand-600 font-medium mt-1">
            Buen cumplimiento
          </p>
        )}
      </div>
    </div>
  )
}
