'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function RegisterPage() {
  const router = useRouter()
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [emailSent, setEmailSent] = useState(false)

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    if (password.length < 8) {
      setError('La contraseña debe tener al menos 8 caracteres')
      setLoading(false)
      return
    }

    const supabase = createClient()
    const { data, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName },
        emailRedirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback`,
      },
    })

    if (authError) {
      setError(authError.message === 'User already registered'
        ? 'Este email ya está registrado. ¿Quieres iniciar sesión?'
        : 'Error al crear la cuenta. Intenta de nuevo.'
      )
      setLoading(false)
      return
    }

    // Si hay sesión activa, la confirmación de email está desactivada en Supabase
    // → redirigir directo al onboarding
    if (data.session) {
      router.push('/onboarding')
      router.refresh()
      return
    }

    // Si no hay sesión, Supabase envió un email de confirmación
    // → mostrar pantalla de "revisa tu correo"
    setEmailSent(true)
    setLoading(false)
  }

  // ── Estado: email de confirmación enviado ────────────────────
  if (emailSent) {
    return (
      <div className="card text-center">
        <div className="w-14 h-14 rounded-full bg-brand-50 flex items-center justify-center mx-auto mb-4">
          <svg className="w-7 h-7 text-brand-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
        </div>
        <h1 className="text-xl font-semibold text-surface-900 mb-2">
          Revisa tu correo
        </h1>
        <p className="text-sm text-surface-400 mb-2">
          Te enviamos un enlace de confirmación a:
        </p>
        <p className="text-sm font-semibold text-surface-800 mb-4">{email}</p>
        <p className="text-sm text-surface-400 mb-6">
          Haz clic en el enlace del correo para activar tu cuenta y continuar con el onboarding.
        </p>
        <p className="text-xs text-surface-300">
          ¿No llegó el correo? Revisa tu carpeta de spam.
        </p>
      </div>
    )
  }

  return (
    <div className="card">
      <h1 className="text-xl font-semibold text-surface-900 mb-2">
        Crea tu cuenta gratis
      </h1>
      <p className="text-sm text-surface-300 mb-6">
        14 días de prueba, sin tarjeta de crédito
      </p>

      <form onSubmit={handleRegister} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-surface-800 mb-1.5">
            Tu nombre
          </label>
          <input
            type="text"
            className="input"
            placeholder="Carlos Pérez"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-surface-800 mb-1.5">
            Email corporativo
          </label>
          <input
            type="email"
            className="input"
            placeholder="carlos@tuempresa.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-surface-800 mb-1.5">
            Contraseña
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
          {loading ? 'Creando cuenta...' : 'Crear cuenta gratis →'}
        </button>

        <p className="text-xs text-surface-300 text-center">
          Al registrarte aceptas nuestros{' '}
          <Link href="/terminos" className="underline">Términos de servicio</Link>
          {' '}y{' '}
          <Link href="/privacidad" className="underline">Política de privacidad</Link>
        </p>
      </form>

      <p className="text-sm text-surface-300 text-center mt-6">
        ¿Ya tienes cuenta?{' '}
        <Link href="/login" className="text-brand-600 hover:underline font-medium">
          Iniciar sesión
        </Link>
      </p>
    </div>
  )
}
