'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'

const NAV_ITEMS = [
  { href: '/dashboard', label: 'Inicio', icon: '🏠' },
  { href: '/chat', label: 'Consultar', icon: '💬' },
  { href: '/obligaciones', label: 'Obligaciones', icon: '📋' },
  { href: '/cuenta', label: 'Mi cuenta', icon: '⚙️' },
]

export default function Sidebar() {
  const pathname = usePathname()

  return (
    <aside className="w-56 bg-white border-r border-surface-200 flex flex-col py-6 px-3">
      {/* Logo */}
      <div className="px-3 mb-8">
        <span className="text-lg font-bold text-brand-600">Regenera</span>
      </div>

      {/* Navegación */}
      <nav className="flex-1 space-y-1">
        {NAV_ITEMS.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors',
                isActive
                  ? 'bg-brand-50 text-brand-700'
                  : 'text-surface-800 hover:bg-surface-100'
              )}
            >
              <span>{item.icon}</span>
              {item.label}
            </Link>
          )
        })}
      </nav>

      {/* Footer del sidebar */}
      <div className="px-3 pt-4 border-t border-surface-100">
        <p className="text-xs text-surface-300">
          Regenera Consultoría S.A.S.
        </p>
      </div>
    </aside>
  )
}
