'use client'

import { useCallback, useContext } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { AuthContext } from '@/context/AuthProvider'

// Hook para acceder al usuario autenticado y hacer logout desde componentes cliente.
// Requiere que el árbol esté envuelto en <AuthProvider>.
export function useAuth() {
  const { user, session, loading } = useContext(AuthContext)
  const router = useRouter()

  const signOut = useCallback(async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }, [router])

  return { user, session, loading, signOut }
}
