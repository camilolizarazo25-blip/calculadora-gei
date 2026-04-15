'use client'

import { useState } from 'react'
import Link from 'next/link'
import { TaskCard } from '@/components/dashboard/TaskCard'
import type { ObligationItem } from '@/lib/dashboard'

type FilterKey = 'all' | 'overdue' | 'critical' | 'pending' | 'done'

const FILTER_LABELS: Record<FilterKey, string> = {
  all:      'Todas',
  overdue:  'Vencidas',
  critical: 'Esta semana',
  pending:  'Pendientes',
  done:     'Cumplidas',
}

interface Props {
  obligations: ObligationItem[]
}

export function ObligacionesList({ obligations }: Props) {
  const [filter, setFilter] = useState<FilterKey>('all')

  const filtered = obligations.filter((o) => {
    if (filter === 'all') return true
    if (filter === 'overdue')  return o.urgency === 'overdue'
    if (filter === 'critical') return o.urgency === 'critical'
    if (filter === 'pending')  return o.urgency === 'warning' || o.urgency === 'ok'
    if (filter === 'done')     return o.urgency === 'done'
    return true
  })

  // Contadores para las pestañas
  const counts: Record<FilterKey, number> = {
    all:      obligations.length,
    overdue:  obligations.filter(o => o.urgency === 'overdue').length,
    critical: obligations.filter(o => o.urgency === 'critical').length,
    pending:  obligations.filter(o => o.urgency === 'warning' || o.urgency === 'ok').length,
    done:     obligations.filter(o => o.urgency === 'done').length,
  }

  if (obligations.length === 0) {
    return (
      <div className="bg-white border border-surface-200 rounded-2xl p-8 text-center">
        <p className="text-3xl mb-3">🌱</p>
        <p className="font-semibold text-surface-900">No tienes obligaciones registradas aún</p>
        <p className="text-sm text-surface-400 mt-1 mb-5">
          Completa el onboarding para que identifiquemos las obligaciones que aplican a tu empresa.
        </p>
        <Link href="/onboarding" className="btn-primary text-sm">
          Configurar mi empresa →
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Pestañas de filtro */}
      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {(Object.keys(FILTER_LABELS) as FilterKey[]).map((key) => {
          const isActive = filter === key
          const hasItems = counts[key] > 0
          return (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className={`
                flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium
                whitespace-nowrap transition-colors flex-shrink-0
                ${isActive
                  ? 'bg-brand-600 text-white'
                  : hasItems
                  ? 'bg-white border border-surface-200 text-surface-800 hover:border-surface-300'
                  : 'bg-white border border-surface-100 text-surface-400 cursor-default'
                }
              `}
              disabled={!hasItems && key !== 'all'}
            >
              {FILTER_LABELS[key]}
              <span className={`
                text-xs px-1.5 py-0.5 rounded-full font-semibold
                ${isActive ? 'bg-white/20 text-white' : 'bg-surface-100 text-surface-600'}
              `}>
                {counts[key]}
              </span>
            </button>
          )
        })}
      </div>

      {/* Lista */}
      {filtered.length === 0 ? (
        <div className="text-center py-10 text-surface-400 text-sm">
          No hay obligaciones en esta categoría
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((item, i) => (
            <TaskCard
              key={item.id}
              item={item}
              rank={i + 1}
            />
          ))}
        </div>
      )}
    </div>
  )
}
