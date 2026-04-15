'use client'

// Página de retorno después del pago con Wompi.
//
// Wompi redirige aquí con ?id={transaction_id}&status={status} en la URL.
// Verificamos el pago server-side con la API de Wompi antes de activar.
//
// Flujos:
//   test=true       → activación directa (modo desarrollo con claves placeholder)
//   id=TX_ID        → verificación con API de Wompi → activación si APPROVED
//   status=DECLINED → mostrar error, no activar

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'

type PaymentStatus = 'APPROVED' | 'DECLINED' | 'ERROR' | 'PENDING' | 'unknown'

export default function PagoExitosoPage() {
  const searchParams = useSearchParams()
  const [checking, setChecking] = useState(true)

  const rawStatus = (searchParams.get('status') ?? 'unknown').toUpperCase() as PaymentStatus
  const transactionId = searchParams.get('id')
  const isTest = searchParams.get('test') === 'true'
  const planId = searchParams.get('plan_id') ?? 'basic'

  useEffect(() => {
    if (rawStatus !== 'APPROVED') {
      setChecking(false)
      return
    }

    if (isTest) {
      // Modo desarrollo con claves placeholder
      fetch('/api/billing/test-activate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan_id: planId }),
      }).finally(() => setChecking(false))
      return
    }

    if (transactionId) {
      // Verificar con Wompi y activar suscripción
      fetch('/api/billing/verify-transaction', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transaction_id: transactionId }),
      }).finally(() => setChecking(false))
      return
    }

    setChecking(false)
  }, [rawStatus, isTest, planId, transactionId])

  if (rawStatus === 'APPROVED') {
    return (
      <div className="min-h-screen bg-surface-50 flex items-center justify-center px-4">
        <div className="w-full max-w-md text-center">
          <div className="card space-y-5">
            {checking ? (
              <>
                <div className="w-16 h-16 rounded-full bg-brand-100 flex items-center justify-center mx-auto">
                  <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
                </div>
                <div>
                  <h1 className="text-lg font-semibold text-surface-900">
                    Verificando tu pago...
                  </h1>
                  <p className="text-sm text-surface-300 mt-1">
                    Confirmando con Wompi y activando tu suscripción.
                  </p>
                </div>
              </>
            ) : (
              <>
                <div className="w-16 h-16 rounded-full bg-brand-100 flex items-center justify-center mx-auto">
                  <svg className="w-8 h-8 text-brand-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <div>
                  <h1 className="text-lg font-semibold text-surface-900">
                    ¡Pago exitoso!
                  </h1>
                  <p className="text-sm text-surface-300 mt-1">
                    Tu suscripción está activa. Ya puedes usar todas las funcionalidades.
                  </p>
                </div>
                <Link href="/dashboard" className="btn-primary w-full block text-center">
                  Ir al dashboard →
                </Link>
              </>
            )}
          </div>
        </div>
      </div>
    )
  }

  if (rawStatus === 'DECLINED' || rawStatus === 'ERROR') {
    return (
      <div className="min-h-screen bg-surface-50 flex items-center justify-center px-4">
        <div className="w-full max-w-md text-center">
          <div className="card space-y-5">
            <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mx-auto">
              <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <div>
              <h1 className="text-lg font-semibold text-surface-900">
                Pago no procesado
              </h1>
              <p className="text-sm text-surface-300 mt-1">
                Tu pago fue rechazado. No se realizó ningún cobro.
                Puedes intentarlo de nuevo con otro método de pago.
              </p>
            </div>
            <Link href="/cuenta" className="btn-primary w-full block text-center">
              Intentar de nuevo
            </Link>
          </div>
        </div>
      </div>
    )
  }

  // PENDING u otro estado
  return (
    <div className="min-h-screen bg-surface-50 flex items-center justify-center px-4">
      <div className="w-full max-w-md text-center">
        <div className="card space-y-5">
          <div className="w-16 h-16 rounded-full bg-yellow-100 flex items-center justify-center mx-auto">
            <svg className="w-8 h-8 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div>
            <h1 className="text-lg font-semibold text-surface-900">
              Pago en proceso
            </h1>
            <p className="text-sm text-surface-300 mt-1">
              Tu pago está siendo procesado (puede tardar unos minutos con PSE).
              Te notificaremos cuando se confirme.
            </p>
          </div>
          <Link href="/dashboard" className="btn-primary w-full block text-center">
            Ir al dashboard
          </Link>
        </div>
      </div>
    </div>
  )
}
