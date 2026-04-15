'use client'

import { useAuth } from '@/hooks/useAuth'

export default function TopBar() {
  const { user, signOut } = useAuth()

  const displayName = user?.user_metadata?.full_name ?? user?.email ?? 'Usuario'
  const initials = displayName
    .split(' ')
    .map((n: string) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()

  return (
    <header className="h-14 bg-white border-b border-surface-200 flex items-center justify-end px-6 gap-4">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-full bg-brand-100 text-brand-700 text-sm font-medium flex items-center justify-center">
          {initials}
        </div>
        <span className="text-sm text-surface-800 hidden sm:block">
          {displayName}
        </span>
      </div>
      <button
        onClick={signOut}
        className="text-sm text-surface-300 hover:text-surface-800 transition-colors"
      >
        Salir
      </button>
    </header>
  )
}
