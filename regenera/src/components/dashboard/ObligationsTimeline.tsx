// Timeline de obligaciones agrupadas por mes
// Componente de servidor — no necesita estado ni hooks

import Link from 'next/link'
import type { ObligationItem } from '@/lib/dashboard'

interface Props {
  obligations: ObligationItem[]
}

const MONTH_NAMES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
]

const URGENCY_DOT: Record<string, string> = {
  overdue:  'bg-red-500',
  critical: 'bg-orange-500',
  warning:  'bg-yellow-500',
  ok:       'bg-brand-500',
  done:     'bg-surface-300',
}

const URGENCY_LABEL: Record<string, string> = {
  overdue:  'Vencida',
  critical: 'Esta semana',
  warning:  'Este mes',
  ok:       'Pendiente',
  done:     'Cumplida',
}

interface MonthGroup {
  year: number
  month: number       // 0-indexed
  label: string
  obligations: ObligationItem[]
}

function groupByMonth(obligations: ObligationItem[]): MonthGroup[] {
  const map = new Map<string, MonthGroup>()
  const now = new Date()
  const currentYear = now.getFullYear()

  for (const ob of obligations) {
    let key: string
    let year: number
    let month: number

    if (!ob.due_date) {
      // Sin fecha → bucket "Sin fecha"
      key = 'no-date'
      year = 9999
      month = 0
    } else {
      const d = new Date(ob.due_date + 'T00:00:00') // evitar timezone shift
      year = d.getFullYear()
      month = d.getMonth()
      key = `${year}-${month}`
    }

    if (!map.has(key)) {
      const label = key === 'no-date'
        ? 'Sin fecha'
        : year === currentYear
          ? MONTH_NAMES[month]!
          : `${MONTH_NAMES[month]} ${year}`

      map.set(key, { year, month, label, obligations: [] })
    }
    map.get(key)!.obligations.push(ob)
  }

  return Array.from(map.values()).sort((a, b) => {
    if (a.year !== b.year) return a.year - b.year
    return a.month - b.month
  })
}

export function ObligationsTimeline({ obligations }: Props) {
  // Sólo mostrar las no-cumplidas (las cumplidas no necesitan planificación)
  const active = obligations.filter(o => o.urgency !== 'done')

  if (active.length === 0) return null

  const groups = groupByMonth(active)
  if (groups.length === 0) return null

  // Mostrar máx 4 meses para no saturar el dashboard
  const visibleGroups = groups.slice(0, 4)
  const hasMore = groups.length > 4

  return (
    <section>
      <div className="flex items-center justify-between mb-3">
        <div>
          <h2 className="font-semibold text-surface-900">Calendario de cumplimiento</h2>
          <p className="text-xs text-surface-400 mt-0.5">Tus próximas obligaciones por mes</p>
        </div>
        <Link href="/obligaciones" className="text-xs text-brand-600 hover:underline font-medium">
          Gestionar →
        </Link>
      </div>

      <div className="space-y-3">
        {visibleGroups.map((group) => {
          const overdueCount  = group.obligations.filter(o => o.urgency === 'overdue').length
          const criticalCount = group.obligations.filter(o => o.urgency === 'critical').length
          const isPast = group.year < new Date().getFullYear() ||
            (group.year === new Date().getFullYear() && group.month < new Date().getMonth())

          return (
            <div key={`${group.year}-${group.month}`} className="card py-4">
              {/* Cabecera del mes */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className={`text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                    overdueCount > 0  ? 'bg-red-100 text-red-700' :
                    criticalCount > 0 ? 'bg-orange-100 text-orange-700' :
                    isPast            ? 'bg-surface-100 text-surface-500' :
                                        'bg-brand-50 text-brand-700'
                  }`}>
                    {group.label}
                  </span>
                  <span className="text-xs text-surface-400">
                    {group.obligations.length} obligación{group.obligations.length !== 1 ? 'es' : ''}
                  </span>
                </div>
                {(overdueCount > 0 || criticalCount > 0) && (
                  <span className="text-xs font-medium text-red-600">
                    {overdueCount > 0 ? `${overdueCount} vencida${overdueCount > 1 ? 's' : ''}` : `${criticalCount} urgente${criticalCount > 1 ? 's' : ''}`}
                  </span>
                )}
              </div>

              {/* Lista de obligaciones */}
              <div className="space-y-1.5">
                {group.obligations.map((ob) => (
                  <div key={ob.id} className="flex items-start gap-2.5 group/item">
                    <span className={`w-2 h-2 rounded-full mt-1 flex-shrink-0 ${URGENCY_DOT[ob.urgency] ?? 'bg-surface-300'}`} />
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm leading-snug truncate ${
                        ob.urgency === 'overdue' ? 'font-medium text-red-800' :
                        ob.urgency === 'critical' ? 'font-medium text-orange-800' :
                        'text-surface-700'
                      }`}>
                        {ob.title}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5">
                        {ob.due_date && (
                          <span className="text-xs text-surface-400">
                            {new Date(ob.due_date + 'T00:00:00').toLocaleDateString('es-CO', {
                              day: 'numeric',
                              month: 'short',
                            })}
                          </span>
                        )}
                        {ob.authority && (
                          <>
                            <span className="text-xs text-surface-300">·</span>
                            <span className="text-xs text-surface-400 truncate">{ob.authority}</span>
                          </>
                        )}
                        {ob.urgency === 'overdue' && (
                          <span className="text-xs font-medium text-red-500 ml-auto flex-shrink-0">
                            {URGENCY_LABEL[ob.urgency]}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )
        })}

        {hasMore && (
          <Link
            href="/obligaciones"
            className="block text-center text-sm text-surface-400 hover:text-brand-600 transition-colors py-1"
          >
            + {groups.length - 4} mes{groups.length - 4 > 1 ? 'es' : ''} más con obligaciones →
          </Link>
        )}
      </div>
    </section>
  )
}
