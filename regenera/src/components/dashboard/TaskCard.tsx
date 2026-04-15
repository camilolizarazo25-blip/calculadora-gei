'use client'

import { useState } from 'react'
import Link from 'next/link'
import type { ObligationItem } from '@/lib/dashboard'
import { getActionText, getChatQuestion } from '@/lib/dashboard'
import { formatDueDate } from '@/lib/utils'

interface Props {
  item: ObligationItem
  rank: number
  highlight?: boolean  // true para el "wow moment" en primera visita
}

const URGENCY_CONFIG = {
  overdue:  { bar: 'bg-red-500',    badge: 'bg-red-50 text-red-700 border-red-200' },
  critical: { bar: 'bg-orange-500', badge: 'bg-orange-50 text-orange-700 border-orange-200' },
  warning:  { bar: 'bg-yellow-500', badge: 'bg-yellow-50 text-yellow-700 border-yellow-200' },
  ok:       { bar: 'bg-brand-400',  badge: 'bg-surface-50 text-surface-600 border-surface-200' },
  done:     { bar: 'bg-surface-300',badge: 'bg-surface-50 text-surface-400 border-surface-200' },
}

type TaskStatus = 'pending' | 'in_progress' | 'done' | 'not_applicable'

export function TaskCard({ item, rank, highlight = false }: Props) {
  const [status, setStatus] = useState<TaskStatus>(item.status)
  const [saving, setSaving] = useState(false)
  const [dismissed, setDismissed] = useState(false)  // ocultar si se marca como done

  const cfg = URGENCY_CONFIG[item.urgency]
  const chatQ = encodeURIComponent(getChatQuestion(item))
  const dueDateText = formatDueDate(item.due_date, item.daysLeft)

  async function updateStatus(newStatus: TaskStatus) {
    if (saving || newStatus === status) return
    setSaving(true)

    // Optimistic UI — actualizar inmediatamente
    const prev = status
    setStatus(newStatus)

    try {
      const res = await fetch(`/api/obligations/${item.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      })

      if (!res.ok) {
        setStatus(prev)  // revertir si falla
      } else if (newStatus === 'done') {
        // Animar y ocultar tras marcar como cumplida
        setTimeout(() => setDismissed(true), 800)
      }
    } catch {
      setStatus(prev)
    } finally {
      setSaving(false)
    }
  }

  if (dismissed) return null

  const isDone = status === 'done'
  const isInProgress = status === 'in_progress'

  return (
    <div className={`group bg-white rounded-xl border transition-all overflow-hidden ${
      highlight
        ? 'border-brand-300 ring-1 ring-brand-200 shadow-sm'
        : 'border-surface-200 hover:border-surface-300 hover:shadow-sm'
    } ${isDone ? 'opacity-60' : ''}`}>
      <div className="flex">
        {/* Barra lateral de urgencia */}
        <div className={`w-1 flex-shrink-0 transition-colors ${isDone ? 'bg-brand-400' : cfg.bar}`} />

        <div className="flex-1 p-4">
          {/* Fila 1: número + título + badge */}
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <span className="text-xs font-bold text-surface-400 w-4 flex-shrink-0">{rank}</span>
                <p className={`text-sm font-semibold leading-snug ${isDone ? 'line-through text-surface-400' : 'text-surface-900'}`}>
                  {item.title}
                </p>
              </div>
              <p className="text-xs text-surface-400 ml-6">{item.authority}</p>
            </div>

            <span className={`text-xs font-medium px-2 py-0.5 rounded-full border flex-shrink-0 ${
              isDone ? 'bg-brand-50 text-brand-700 border-brand-200' : cfg.badge
            }`}>
              {isDone ? '✓ Cumplida' :
               isInProgress ? 'En curso' :
               item.urgency === 'overdue' ? 'Vencida' :
               item.daysLeft !== null ? `${item.daysLeft}d` : 'Pendiente'}
            </span>
          </div>

          {/* Fila 2: fecha humanizada */}
          {dueDateText && !isDone && (
            <p className={`text-xs mt-1.5 ml-6 ${
              item.urgency === 'overdue'  ? 'text-red-600 font-medium' :
              item.urgency === 'critical' ? 'text-orange-600 font-medium' :
              item.urgency === 'warning'  ? 'text-yellow-700' : 'text-surface-400'
            }`}>
              {dueDateText}
            </p>
          )}

          {/* Fila 3: acciones */}
          {!isDone && (
            <div className="mt-3 ml-6 flex items-center justify-between gap-3 flex-wrap">
              {/* Botones de micro-interacción */}
              <div className="flex items-center gap-2">
                {!isInProgress && (
                  <button
                    onClick={() => updateStatus('in_progress')}
                    disabled={saving}
                    className="text-xs px-2.5 py-1 rounded-lg border border-surface-200 text-surface-600 hover:border-brand-300 hover:text-brand-700 transition-colors disabled:opacity-50"
                  >
                    {saving ? '…' : '↗ En progreso'}
                  </button>
                )}
                {isInProgress && (
                  <span className="text-xs text-brand-600 font-medium">↗ En progreso</span>
                )}
                <button
                  onClick={() => updateStatus('done')}
                  disabled={saving}
                  className="text-xs px-2.5 py-1 rounded-lg border border-surface-200 text-surface-600 hover:border-brand-500 hover:bg-brand-50 hover:text-brand-700 transition-colors disabled:opacity-50"
                >
                  {saving ? '…' : '✓ Marcar cumplida'}
                </button>
              </div>

              {/* CTA chat — siempre visible (no solo en hover) */}
              <Link
                href={`/chat?q=${chatQ}`}
                className="text-xs text-brand-600 hover:text-brand-800 font-medium hover:underline flex-shrink-0"
              >
                Preguntar al asesor →
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
