'use client'

import type { MemberRole } from '@/types'
import { useOrganization } from '@/hooks/useOrganization'

interface RequireRoleProps {
  // Rol mínimo requerido para ver el contenido
  role: MemberRole
  children: React.ReactNode
  // Qué mostrar si el usuario no tiene el rol (null = nada)
  fallback?: React.ReactNode
}

// Wrapper de protección por rol en el cliente.
// Usar para ocultar secciones de la UI (invitar miembros, cambiar plan, etc.)
// que solo el owner puede ver/usar.
//
// ⚠️ ESTO ES PROTECCIÓN DE UI, NO DE SEGURIDAD.
// Las API Routes tienen sus propias verificaciones de rol en el servidor.
//
// Uso:
//   <RequireRole role="owner" fallback={<p>Solo el administrador puede hacer esto</p>}>
//     <InviteMemberButton />
//   </RequireRole>
export function RequireRole({ role, children, fallback = null }: RequireRoleProps) {
  const { org, loading } = useOrganization()

  // Durante la carga no mostrar nada — evita flash de contenido no autorizado
  if (loading) return null

  if (!org || org.role !== role) {
    return <>{fallback}</>
  }

  return <>{children}</>
}
