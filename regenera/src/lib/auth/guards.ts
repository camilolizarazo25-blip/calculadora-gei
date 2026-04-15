// ─── Guards de autenticación y autorización server-side ──────
//
// CUÁNDO usar cada helper:
//
// En Server Components / layouts:
//   requireAuth()          → valida sesión, redirige a /login si falla
//   requireOrgContext()    → valida org, redirige a /sin-organizacion si falta
//   requireOwner()         → valida rol owner, redirige a /dashboard si falla
//
// En API Routes:
//   requireAuthApi()       → devuelve { user, error } — nunca hace redirect
//   requireOrgContextApi() → devuelve { ctx, error }
//   requireOwnerApi()      → devuelve Response | null
//
// Patrón para API Routes:
//   const { user, error } = await requireAuthApi()
//   if (error) return error
//   const { ctx, error: ctxError } = await requireOrgContextApi(user.id)
//   if (ctxError) return ctxError

import { redirect } from 'next/navigation'
import { getAuthUser, getOrgContext } from '@/lib/supabase/queries'
import { apiError } from '@/lib/utils'
import type { OrgContext } from '@/types'
import type { User } from '@supabase/supabase-js'

// ─── Server Components ────────────────────────────────────────

export async function requireAuth(): Promise<User> {
  const user = await getAuthUser()
  if (!user) redirect('/login')
  return user
}

export async function requireOrgContext(userId: string): Promise<OrgContext> {
  const ctx = await getOrgContext(userId)
  if (!ctx) redirect('/sin-organizacion')
  return ctx
}

// Redirige al dashboard si el usuario no es owner.
// Usar DESPUÉS de requireOrgContext.
export function requireOwner(ctx: OrgContext): void {
  if (ctx.role !== 'owner') redirect('/dashboard')
}

// ─── API Routes ───────────────────────────────────────────────

type AuthApiResult =
  | { user: User; error: null }
  | { user: null; error: Response }

export async function requireAuthApi(): Promise<AuthApiResult> {
  const user = await getAuthUser()
  if (!user) return { user: null, error: apiError('No autenticado', 401) }
  return { user, error: null }
}

type OrgApiResult =
  | { ctx: OrgContext; error: null }
  | { ctx: null; error: Response }

export async function requireOrgContextApi(userId: string): Promise<OrgApiResult> {
  const ctx = await getOrgContext(userId)
  if (!ctx) return { ctx: null, error: apiError('Organización no encontrada', 404) }
  return { ctx, error: null }
}

// Devuelve un Response de error si el usuario no es owner, null si sí lo es.
export function requireOwnerApi(ctx: OrgContext): Response | null {
  if (ctx.role !== 'owner') {
    return apiError('Solo el administrador puede realizar esta acción', 403)
  }
  return null
}
