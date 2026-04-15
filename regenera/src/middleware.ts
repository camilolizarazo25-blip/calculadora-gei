import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// ─── Clasificación de rutas ──────────────────────────────────
//
// PÚBLICA:      sin sesión → dejar pasar
// AUTH:         sin sesión → dejar pasar | con sesión → redirigir a /dashboard
// PROBLEMA:     con o sin sesión → dejar pasar (estados inválidos)
// DASHBOARD:    sin sesión → redirigir a /login
// ADMIN:        sin sesión → /login | sin email admin → /dashboard
//
// El middleware SOLO valida sesión y email admin.
// La validación de org y rol queda en layouts y API Routes.
// (Consultar DB en Edge Runtime es costoso y lento)

const AUTH_ROUTES = ['/login', '/register']
const PUBLIC_ROUTES = ['/', '/sin-organizacion']
const ADMIN_ROUTES = ['/admin']
const ADMIN_EMAILS = (process.env.REGENERA_ADMIN_EMAILS ?? '').split(',').filter(Boolean)

export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname

  // Construir headers modificados para pasar x-pathname a layouts
  // (patrón oficial Next.js para compartir datos entre middleware y Server Components)
  const requestHeaders = new Headers(request.headers)
  requestHeaders.set('x-pathname', path)

  let supabaseResponse = NextResponse.next({
    request: { headers: requestHeaders },
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({
            request: { headers: requestHeaders },
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // Refrescar sesión si está próxima a expirar (obligatorio en middleware Supabase)
  const { data: { user } } = await supabase.auth.getUser()

  // ── /auth/* — dejar pasar siempre (callback de OAuth/invitaciones) ──
  if (path.startsWith('/auth/')) return supabaseResponse

  // ── Rutas públicas — dejar pasar siempre ──────────────────────
  const isPublic = PUBLIC_ROUTES.some((r) => path === r)
  if (isPublic) return supabaseResponse

  // ── Rutas de auth (login, register, invite) ─────────────────
  // Sin sesión: dejar pasar para que el usuario pueda autenticarse
  // Con sesión: redirigir al dashboard (ya está autenticado)
  const isAuthRoute = AUTH_ROUTES.some((r) => path === r) || path === '/invite'
  if (isAuthRoute) {
    if (user) {
      const dashboardUrl = request.nextUrl.clone()
      dashboardUrl.pathname = '/dashboard'
      return NextResponse.redirect(dashboardUrl)
    }
    return supabaseResponse
  }

  // ── Sin sesión → redirigir a login ────────────────────────────
  if (!user) {
    const loginUrl = request.nextUrl.clone()
    loginUrl.pathname = '/login'
    // Preservar destino original para redirigir después del login
    // No preservar si es una ruta admin (seguridad)
    if (!ADMIN_ROUTES.some((r) => path.startsWith(r))) {
      loginUrl.searchParams.set('redirect', path)
    }
    return NextResponse.redirect(loginUrl)
  }

  // ── Rutas admin — verificar email del equipo Regenera ─────────
  const isAdminRoute = ADMIN_ROUTES.some((r) => path.startsWith(r))
  if (isAdminRoute) {
    if (!ADMIN_EMAILS.includes(user.email ?? '')) {
      const dashboardUrl = request.nextUrl.clone()
      dashboardUrl.pathname = '/dashboard'
      return NextResponse.redirect(dashboardUrl)
    }
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
