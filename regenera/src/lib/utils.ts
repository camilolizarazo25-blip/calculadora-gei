import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { NextResponse } from 'next/server'
import type { ApiError } from '@/types/api'

// ─── Utilidad para clases condicionales de Tailwind ──────────
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// ─── Respuestas estandarizadas de API Routes ─────────────────
export function apiSuccess<T>(data: T, status = 200) {
  return NextResponse.json({ data, error: null }, { status })
}

export function apiError(message: string, status = 400, code?: string) {
  const body: ApiError = { error: message, code }
  return NextResponse.json(body, { status })
}

// ─── Formateo de fechas para Colombia ────────────────────────
export function formatDateCO(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('es-CO', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'America/Bogota',
  })
}

export function formatCurrencyCOP(amount: number): string {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

// ─── Calcular días restantes hasta una fecha ─────────────────
export function daysUntil(dateStr: string): number {
  const target = new Date(dateStr)
  const today = new Date()
  const diff = target.getTime() - today.getTime()
  return Math.ceil(diff / (1000 * 60 * 60 * 24))
}

// ─── Determinar urgencia de una obligación ───────────────────
export function getObligationUrgency(
  dueDateStr: string | null,
  status: string
): 'done' | 'ok' | 'warning' | 'critical' | 'overdue' {
  if (status === 'done') return 'done'
  if (status === 'not_applicable') return 'done'
  if (!dueDateStr) return 'ok'

  const days = daysUntil(dueDateStr)
  if (days < 0)  return 'overdue'
  if (days <= 7)  return 'critical'
  if (days <= 30) return 'warning'
  return 'ok'
}

// ─── Fecha legible con contexto de urgencia ──────────────────
// "Vence en 5 días (12 de mayo)" / "Venció hace 3 días (5 de abril)"
export function formatDueDate(dateStr: string | null, daysLeft: number | null): string {
  if (!dateStr || daysLeft === null) return ''
  const date = new Date(dateStr)
  const dayMonth = date.toLocaleDateString('es-CO', {
    day: 'numeric',
    month: 'long',
    timeZone: 'America/Bogota',
  })
  if (daysLeft < 0) {
    const ago = Math.abs(daysLeft)
    return `Venció hace ${ago} día${ago !== 1 ? 's' : ''} (${dayMonth})`
  }
  if (daysLeft === 0) return `Vence hoy (${dayMonth})`
  if (daysLeft === 1) return `Vence mañana (${dayMonth})`
  return `Vence en ${daysLeft} días (${dayMonth})`
}

// ─── Obtener primer día del período de facturación ───────────
export function getCurrentBillingPeriodStart(): string {
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth(), 1)
    .toISOString()
    .split('T')[0]!
}
