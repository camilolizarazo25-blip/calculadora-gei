'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'

interface Props {
  isOpen: boolean
  onClose: () => void
}

const NAV_ITEMS = [
  { href: '/dashboard',    label: 'Inicio',       icon: '🏠' },
  { href: '/chat',         label: 'Consultar',    icon: '💬' },
  { href: '/obligaciones', label: 'Obligaciones', icon: '📋' },
  { href: '/cuenta',       label: 'Mi cuenta',    icon: '⚙️' },
]

export default function Sidebar({ isOpen, onClose }: Props) {
  const pathname = usePathname()

  return (
    <aside
      className={cn(
        // En móvil: posición fija, se muestra/oculta con translate
        // En desktop (lg+): posición estática, siempre visible
        'fixed inset-y-0 left-0 z-30 w-56 bg-white border-r border-surface-200',
        'flex flex-col py-6 px-3',
        'transition-transform duration-200 ease-in-out',
        'lg:static lg:translate-x-0 lg:z-auto',
        isOpen ? 'translate-x-0' : '-translate-x-full'
      )}
    >
      {/* Logo */}
      <div className="px-3 mb-8 flex items-center justify-between">
        <span className="text-lg font-bold text-brand-600">Regenera</span>
        {/* Botón cerrar — solo visible en móvil */}
        <button
          className="lg:hidden p-1 text-surface-400 hover:text-surface-800 rounded-lg"
          onClick={onClose}
          aria-label="Cerrar menú"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Navegación */}
      <nav className="flex-1 space-y-1">
        {NAV_ITEMS.map((item) => {
          const isActive =
            pathname === item.href ||
            (item.href !== '/dashboard' && pathname.startsWith(item.href + '/'))
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onClose}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors',
                isActive
                  ? 'bg-brand-50 text-brand-700'
                  : 'text-surface-800 hover:bg-surface-100'
              )}
            >
              <span className="text-base">{item.icon}</span>
              {item.label}
            </Link>
          )
        })}
      </nav>

      {/* Footer */}
      <div className="px-3 pt-4 border-t border-surface-100">
        <p className="text-xs text-surface-300">Regenera Consultoría S.A.S.</p>
      </div>
    </aside>
  )
}
