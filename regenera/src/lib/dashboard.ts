// ─── Lógica de priorización del dashboard ────────────────────
// Encapsulada aquí para ser testeable de forma aislada.

import { daysUntil } from '@/lib/utils'

export type ObligationUrgency = 'overdue' | 'critical' | 'warning' | 'ok' | 'done'

export interface ObligationItem {
  id: string
  title: string
  authority: string
  priority: 'high' | 'medium' | 'low'
  status: 'pending' | 'in_progress' | 'done' | 'not_applicable'
  due_date: string | null
  urgency: ObligationUrgency
  daysLeft: number | null
}

// ─── Estado general (semáforo) ────────────────────────────────
// Responde la pregunta: "¿Cómo está mi empresa ambientalmente?"
// Rojo > Amarillo > Verde — el peor estado domina.

export type TrafficLight = 'red' | 'yellow' | 'green'

export interface DashboardStatus {
  light: TrafficLight
  label: string
  description: string
  overdueCount: number
  criticalCount: number
  pendingCount: number
  doneCount: number
  totalActive: number
  compliancePercent: number
}

export function calculateDashboardStatus(items: ObligationItem[]): DashboardStatus {
  const overdueCount  = items.filter(o => o.urgency === 'overdue').length
  const criticalCount = items.filter(o => o.urgency === 'critical').length
  const warningCount  = items.filter(o => o.urgency === 'warning').length
  const doneCount     = items.filter(o => o.urgency === 'done').length
  const totalActive   = items.filter(o => o.urgency !== 'done').length

  const compliancePercent = items.length > 0
    ? Math.round((doneCount / items.length) * 100)
    : 100

  let light: TrafficLight
  let label: string
  let description: string

  if (overdueCount > 0) {
    light = 'red'
    label = overdueCount === 1 ? '1 obligación vencida' : `${overdueCount} obligaciones vencidas`
    description = 'Hay obligaciones que ya pasaron su fecha límite. Requieren atención urgente.'
  } else if (criticalCount > 0) {
    light = 'yellow'
    label = criticalCount === 1
      ? '1 obligación vence en menos de 7 días'
      : `${criticalCount} obligaciones vencen esta semana`
    description = 'Tienes plazos muy próximos. Actúa esta semana para evitar incumplimientos.'
  } else if (warningCount > 0) {
    light = 'yellow'
    label = `${warningCount} obligación${warningCount > 1 ? 'es' : ''} próxima${warningCount > 1 ? 's' : ''} a vencer`
    description = 'Todo bajo control por ahora. Atiende las próximas en los próximos 30 días.'
  } else if (totalActive > 0) {
    light = 'green'
    label = 'Al día'
    description = 'No tienes vencimientos próximos. Mantén el seguimiento periódico.'
  } else {
    light = 'green'
    label = 'Sin obligaciones activas'
    description = 'Completa tu onboarding para identificar tus obligaciones ambientales.'
  }

  return {
    light, label, description,
    overdueCount, criticalCount,
    pendingCount: totalActive,
    doneCount, totalActive,
    compliancePercent,
  }
}

// ─── Priorización de tareas para "Qué hacer hoy" ─────────────
// Orden: vencidas → urgentes → warning + alta prioridad → resto
// Máximo 5 tareas para no saturar la pantalla.

export function getPriorityTasks(items: ObligationItem[]): ObligationItem[] {
  const active = items.filter(o => o.urgency !== 'done')

  // Score de prioridad — número menor = más urgente
  function score(o: ObligationItem): number {
    const urgencyScore: Record<ObligationUrgency, number> = {
      overdue:  0,
      critical: 1,
      warning:  2,
      ok:       3,
      done:     99,
    }
    const priorityBonus: Record<string, number> = { high: 0, medium: 0.5, low: 1 }
    return urgencyScore[o.urgency] + (priorityBonus[o.priority] ?? 1)
  }

  return active
    .slice()
    .sort((a, b) => score(a) - score(b))
    .slice(0, 5)
}

// ─── Texto accionable por obligación ─────────────────────────
// "¿Qué debo hacer?" en primera persona, no etiqueta técnica.

export function getActionText(item: ObligationItem): string {
  if (item.urgency === 'overdue') {
    return `Gestionar urgente (venció hace ${Math.abs(item.daysLeft ?? 0)} días)`
  }
  if (item.urgency === 'critical') {
    return `Actuar esta semana (${item.daysLeft === 0 ? 'hoy' : `${item.daysLeft} días`})`
  }
  if (item.urgency === 'warning' && item.daysLeft !== null) {
    return `Preparar en los próximos ${item.daysLeft} días`
  }
  if (item.status === 'in_progress') {
    return 'Continuar gestión en curso'
  }
  return 'Iniciar gestión'
}

// ─── Mensaje del chat sugerido por obligación ─────────────────
// Pre-llena el input del chat para que el usuario llegue directo al tema.

export function getChatQuestion(item: ObligationItem): string {
  return `¿Cómo gestiono "${item.title}"? ¿Cuáles son los pasos concretos y plazos?`
}
