// Página para usuarios autenticados sin organización válida.
//
// Casos que llegan aquí:
//  - El trigger handle_new_user falló y el usuario no tiene organization_members
//  - La membresía está en estado 'removed' o 'pending' (no 'active')
//  - El usuario fue invitado a una org que luego fue eliminada
//  - Metadata de invitación corrupta
//
// Esta página NO redirige en bucle — es el destino final para estados inválidos.
// El usuario debe contactar soporte o intentar registrarse de nuevo.

import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export default async function SinOrganizacionPage() {
  // Verificar que el usuario SÍ está autenticado (si no, no debería estar aquí)
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  return (
    <div className="min-h-screen bg-surface-50 flex items-center justify-center px-4">
      <div className="w-full max-w-md text-center">
        <div className="mb-6">
          <span className="text-2xl font-bold text-brand-600">Regenera</span>
        </div>

        <div className="card space-y-4">
          <div className="w-12 h-12 rounded-full bg-yellow-100 flex items-center justify-center mx-auto">
            <svg className="w-6 h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.464 0L4.35 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>

          <div>
            <h1 className="text-lg font-semibold text-surface-900">
              Problema con tu acceso
            </h1>
            <p className="text-sm text-surface-300 mt-2">
              Tu cuenta está activa pero no pudimos encontrar tu organización.
              Esto puede ocurrir si la invitación expiró o hubo un error al configurar tu cuenta.
            </p>
          </div>

          <div className="bg-surface-50 rounded-xl px-4 py-3 text-left">
            <p className="text-xs text-surface-400 mb-0.5">Sesión activa como</p>
            <p className="text-sm font-medium text-surface-800">{user.email}</p>
          </div>

          <div className="space-y-2 pt-2">
            <p className="text-sm font-medium text-surface-800">¿Qué puedes hacer?</p>
            <ul className="text-sm text-surface-300 space-y-1 text-left">
              <li>• Pide al administrador de tu empresa que te invite de nuevo</li>
              <li>• O crea una cuenta nueva si eres el responsable ambiental</li>
            </ul>
          </div>

          <div className="flex flex-col gap-2 pt-2">
            <Link href="/register" className="btn-primary text-center text-sm">
              Crear una cuenta nueva
            </Link>
            <form action="/api/auth/signout" method="POST">
              <button
                type="submit"
                className="w-full text-sm text-surface-300 hover:text-surface-800 transition-colors py-2"
              >
                Cerrar sesión
              </button>
            </form>
          </div>
        </div>

        <p className="text-xs text-surface-300 mt-4">
          ¿Necesitas ayuda?{' '}
          <a href="mailto:soporte@regenera.com.co" className="text-brand-600 hover:underline">
            soporte@regenera.com.co
          </a>
        </p>
      </div>
    </div>
  )
}
