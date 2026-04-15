'use client'

// CheckoutButton — inicia el pago en Wompi Widget
//
// Flujo:
//  1. Clic → POST /api/billing/checkout → recibe params firmados
//  2. Carga el Wompi Widget Script dinámicamente
//  3. El script renderiza un botón/modal de pago de Wompi
//  4. Wompi maneja PSE, Nequi, tarjeta, Daviplata
//  5. Al completar, redirige a /pago/exitoso?ref={reference}
//  6. Wompi notifica al webhook en background
//
// Por qué Widget y no API directa:
//  - Wompi Widget maneja todos los métodos de pago sin código adicional
//  - El formulario de tarjeta lo maneja Wompi (PCI compliance)
//  - Mucho más simple para MVP

import { useState } from 'react'
import { formatCurrencyCOP } from '@/lib/utils'

interface CheckoutButtonProps {
  planId: 'basic' | 'professional'
  planName: string
  priceCop: number
  className?: string
}

interface CheckoutParams {
  public_key: string
  reference: string
  amount_in_cents: number
  currency: string
  integrity: string
  redirect_url: string
  customer_email: string
}

export function CheckoutButton({ planId, planName, priceCop, className }: CheckoutButtonProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleCheckout() {
    setLoading(true)
    setError('')

    try {
      const res = await fetch('/api/billing/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan_id: planId }),
      })

      const body = await res.json()
      if (!res.ok) {
        setError(body.error ?? 'Error iniciando el pago')
        return
      }

      const params: CheckoutParams = body.data

      // Wompi no acepta localhost como redirect_url — usar flujo de prueba en local
      const isLocal = params.redirect_url.includes('localhost') ||
                      params.redirect_url.includes('127.0.0.1')
      const isPlaceholder = params.public_key.includes('placeholder')

      if (isLocal || isPlaceholder) {
        window.location.href = `${params.redirect_url}&status=APPROVED&test=true&plan_id=${planId}`
        return
      }

      // Producción (dominio real): redirigir al checkout alojado de Wompi
      redirectToWompi(params)
    } catch {
      setError('Error de conexión. Intenta de nuevo.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <button
        onClick={handleCheckout}
        disabled={loading}
        className={className ?? 'btn-primary w-full'}
      >
        {loading
          ? 'Preparando pago...'
          : `Suscribirse a ${planName} — ${formatCurrencyCOP(priceCop)}/mes`}
      </button>
      {error && (
        <p className="text-sm text-red-600 mt-2">{error}</p>
      )}
      <p className="text-xs text-surface-300 text-center mt-2">
        Pago seguro con Wompi · PSE, Nequi, Tarjeta
      </p>
    </div>
  )
}

// Redirige al checkout alojado de Wompi (más confiable que el widget embebido).
// Wompi Hosted Checkout: https://checkout.wompi.co/p/?...
function redirectToWompi(params: CheckoutParams) {
  const url = new URL('https://checkout.wompi.co/p/')
  url.searchParams.set('public-key', params.public_key)
  url.searchParams.set('currency', params.currency)
  url.searchParams.set('amount-in-cents', String(params.amount_in_cents))
  url.searchParams.set('reference', params.reference)
  url.searchParams.set('signature:integrity', params.integrity)
  url.searchParams.set('redirect-url', params.redirect_url)
  url.searchParams.set('customer-data:email', params.customer_email)
  window.location.href = url.toString()
}
