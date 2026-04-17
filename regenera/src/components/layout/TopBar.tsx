'use client'

import { usePathname } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'

interface Props {
  onToggleSidebar: () => void
}

// Títulos de página por ruta
const PAGE_TITLES: Record<string, string> = {
  '/dashboard':    'Inicio',
  '/chat':         'Asesor ambiental',
  '/obligaciones': 'Obligaciones',
  '/cuenta':       'Mi cuenta',
}

export default function TopBar({ onToggleSidebar }: Props) {
  const { user, signOut } = useAuth()
  const pathname = usePathname()

  const displayName = user?.user_metadata?.full_name ?? user?.email ?? 'Usuario'
  const initials = displayName
    .split(' ')
    .map((n: string) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()

  // Título de la página actual
  const pageTitle = PAGE_TITLES[pathname] ??
    Object.entries(PAGE_TITLES).find(([k]) => pathname.startsWith(k + '/'))?.[1] ?? ''

  return (
    <header className="h-14 bg-white border-b border-surface-200 flex items-center px-4 gap-3 flex-shrink-0">
      {/* Hamburger — solo visible en móvil */}
      <button
        className="lg:hidden p-2 -ml-1 text-surface-600 hover:text-surface-900 hover:bg-surface-100 rounded-lg transition-colors"
        onClick={onToggleSidebar}
        aria-label="Abrir menú"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>

      {/* Título de la página — visible en móvil */}
      {pageTitle && (
        <span className="text-sm font-medium text-surface-800 lg:hidden">{pageTitle}</span>
      )}

      {/* Spacer */}
      <div className="flex-1" />

      {/* Usuario + salir */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-brand-100 text-brand-700 text-sm font-medium flex items-center justify-center flex-shrink-0">
            {initials}
          </div>
          <span className="text-sm text-surface-800 hidden sm:block truncate max-w-[150px]">
            {displayName}
          </span>
        </div>
        <button
          onClick={signOut}
          className="text-sm text-surface-400 hover:text-surface-800 transition-colors whitespace-nowrap"
        >
          Salir
        </button>
      </div>
    </header>
  )
}
