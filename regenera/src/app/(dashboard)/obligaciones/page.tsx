import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { requireAuth, requireOrgContext } from '@/lib/auth/guards'
import { daysUntil } from '@/lib/utils'
import {
  calculateDashboardStatus,
  type ObligationItem,
} from '@/lib/dashboard'
import { ObligacionesList } from '@/components/obligaciones/ObligacionesList'

export const metadata: Metadata = { title: 'Obligaciones Ambientales' }

export default async function ObligacionesPage() {
  const user = await requireAuth()
  const ctx = await requireOrgContext(user.id)

  const supabase = await createClient()
  const { data } = await supabase
    .from('organization_obligations')
    .select('id, status, due_date, template:obligation_templates(title, authority, priority)')
    .eq('organization_id', ctx.orgId)
    .order('due_date', { ascending: true, nullsFirst: false })

  const obligations: ObligationItem[] = (data ?? []).map((ob) => {
    const template = ob.template as unknown as { title: string; authority: string; priority: string } | null
    const days = ob.due_date ? daysUntil(ob.due_date) : null

    let urgency: ObligationItem['urgency']
    if (ob.status === 'done' || ob.status === 'not_applicable') {
      urgency = 'done'
    } else if (days !== null && days < 0) {
      urgency = 'overdue'
    } else if (days !== null && days <= 7) {
      urgency = 'critical'
    } else if (days !== null && days <= 30) {
      urgency = 'warning'
    } else {
      urgency = 'ok'
    }

    return {
      id: ob.id,
      title: template?.title ?? 'Obligación',
      authority: template?.authority ?? '',
      priority: (template?.priority ?? 'medium') as ObligationItem['priority'],
      status: ob.status as ObligationItem['status'],
      due_date: ob.due_date,
      urgency,
      daysLeft: days,
    }
  })

  const status = calculateDashboardStatus(obligations)

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Header */}
      <div>
        <h1 className="text-xl font-semibold text-surface-900">Obligaciones ambientales</h1>
        <p className="text-sm text-surface-400 mt-0.5">
          {obligations.length} obligaciones identificadas para {ctx.orgName}
        </p>
      </div>

      {/* Resumen de contadores */}
      {obligations.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <SummaryCard
            label="Vencidas"
            value={status.overdueCount}
            color={status.overdueCount > 0 ? 'red' : 'neutral'}
          />
          <SummaryCard
            label="Esta semana"
            value={status.criticalCount}
            color={status.criticalCount > 0 ? 'orange' : 'neutral'}
          />
          <SummaryCard
            label="Pendientes"
            value={status.pendingCount - status.criticalCount - status.overdueCount}
            color="neutral"
          />
          <SummaryCard
            label="Cumplidas"
            value={status.doneCount}
            color="green"
          />
        </div>
      )}

      {/* Lista interactiva con filtros */}
      <ObligacionesList obligations={obligations} />
    </div>
  )
}

function SummaryCard({
  label,
  value,
  color,
}: {
  label: string
  value: number
  color: 'red' | 'orange' | 'neutral' | 'green'
}) {
  const styles: Record<string, string> = {
    red:     'bg-red-50 border-red-200 text-red-700',
    orange:  'bg-orange-50 border-orange-200 text-orange-700',
    neutral: 'bg-white border-surface-200 text-surface-800',
    green:   'bg-brand-50 border-brand-200 text-brand-700',
  }
  return (
    <div className={`rounded-xl border p-4 text-center ${styles[color]}`}>
      <p className="text-2xl font-bold">{value}</p>
      <p className="text-xs font-medium mt-0.5">{label}</p>
    </div>
  )
}
