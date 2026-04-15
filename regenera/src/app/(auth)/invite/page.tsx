'use client'

// Página de aceptación de invitación
// ─────────────────────────────────────────────────────────────────
// Flujo:
//  1. Owner invita a un miembro desde /cuenta → POST /api/org/members
//  2. Supabase envía email con link a /auth/callback?code=xxx&next=/invite
//  3. /auth/callback intercambia el código y redirige aquí
//  4. El usuario (ya autenticado) establece su nombre y contraseña
//  5. Al guardar, redirige a /dashboard (la org ya está asignada por el trigger)
//
// Nota: el trigger handle_new_user detecta invited_at IS NOT NULL y NO crea
// una org nueva, sino que agrega el usuario a la org del invitador.

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function InvitePage() {
  const router = useRouter()
  const [fullName, setFullName] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [checkingSession, setCheckingSession] = useState(true)

  useEffect(() => {
    async function checkSession() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) {
        // Sin sesión activa: el código ya fue consumido o el link expiró
        router.replace('/login?error=invite_expired')
        return
      }

      setEmail(user.email ?? '')
      // Pre-rellenar nombre si ya está en los metadatos
      setFullName(user.user_metadata?.full_name ?? '')
      setCheckingSession(false)
    }

    checkSession()
  }, [router])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (password !== confirmPassword) {
      setError('Las contraseñas no coinciden')
      return
    }
    if (password.length < 8) {
      setError('La contraseña debe tener al menos 8 caracteres')
      return
    }

    setLoading(true)
    const supabase = createClient()

    const { error: updateError } = await supabase.auth.updateUser({
      password,
      data: { full_name: fullName },
    })

    if (updateError) {
      setError('Error configurando tu cuenta. Intenta de nuevo.')
      setLoading(false)
      return
    }

    // Sesión actualizada — redirigir al dashboard
    // El trigger ya asignó la organización correcta al aceptar la invitación
    router.push('/dashboard')
    router.refresh()
  }

  if (checkingSession) {
    return (
      <div className="card flex items-center justify-center h-40">
        <div className="w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="card">
      <h1 className="text-xl font-semibold text-surface-900 mb-2">
        Bienvenido a Regenera
      </h1>
      <p className="text-sm text-surface-300 mb-6">
        Fuiste invitado a una organización. Completa tu perfil para comenzar.
      </p>

      <div className="bg-surface-50 border border-surface-200 rounded-lg px-4 py-2.5 mb-6">
        <p className="text-xs text-surface-400 mb-0.5">Cuenta</p>
        <p className="text-sm font-medium text-surface-800">{email}</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-surface-800 mb-1.5">
            Tu nombre
          </label>
          <input
            type="text"
            className="input"
            placeholder="María García"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            required
            autoComplete="name"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-surface-800 mb-1.5">
            Crear contraseña
          </label>
          <input
            type="password"
            className="input"
            placeholder="Mínimo 8 caracteres"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
            autoComplete="new-password"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-surface-800 mb-1.5">
            Confirmar contraseña
          </label>
          <input
            type="password"
            className="input"
            placeholder="Repite la contraseña"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            autoComplete="new-password"
          />
        </div>

        {error && (
          <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">
            {error}
          </p>
        )}

        <button
          type="submit"
          className="btn-primary w-full"
          disabled={loading}
        >
          {loading ? 'Guardando...' : 'Activar mi cuenta →'}
        </button>
      </form>
    </div>
  )
}
