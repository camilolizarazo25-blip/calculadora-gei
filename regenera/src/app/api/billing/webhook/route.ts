import { type NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { verifyWompiWebhook } from '@/lib/wompi/signature'
import { trackEvent } from '@/lib/analytics/track'

// POST /api/billing/webhook
// Recibe eventos de Wompi y actualiza la suscripción.
//
// ── Seguridad ──────────────────────────────────────────────────
// 1. Verificación de firma: Wompi incluye signature.checksum en el payload.
//    Si la firma no coincide con WOMPI_EVENTS_SECRET, rechazamos el request.
//    Esto evita que terceros activen suscripciones enviando requests falsos.
//
// 2. Idempotencia: si el mismo evento llega dos veces (Wompi puede reintentar),
//    el upsert/update con las mismas condiciones no produce efectos duplicados.
//    Guardar wompi_transaction_id permite detectar duplicados exactos.
//
// ── Eventos manejados ─────────────────────────────────────────
// transaction.updated:
//   APPROVED → activar suscripción por 30 días
//   DECLINED → marcar past_due si estaba en proceso de renovación
//   ERROR    → ídem

// Estructura del evento Wompi
interface WompiEvent {
  event: string
  data: {
    transaction: {
      id: string
      status: 'APPROVED' | 'DECLINED' | 'ERROR' | 'VOIDED' | 'PENDING'
      reference: string
      amount_in_cents: number
      currency: string
      payment_method_type?: string
    }
  }
  signature: {
    checksum: string
    properties: string[]
  }
  timestamp: number
  sent_at: string
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null)
  if (!body) {
    return NextResponse.json({ error: 'Body inválido' }, { status: 400 })
  }

  const event = body as WompiEvent

  // ── 1. Verificar firma del webhook ─────────────────────────
  // En modo desarrollo (WOMPI_EVENTS_SECRET no configurado), omitir verificación.
  const eventsSecret = process.env.WOMPI_EVENTS_SECRET
  if (eventsSecret && eventsSecret !== 'placeholder') {
    const isValid = verifyWompiWebhook(
      event.data,
      event.signature?.checksum ?? '',
      event.signature?.properties ?? []
    )
    if (!isValid) {
      console.error('Webhook Wompi: firma inválida')
      return NextResponse.json({ error: 'Firma inválida' }, { status: 401 })
    }
  }

  // ── 2. Procesar solo eventos de transacción ────────────────
  if (event.event !== 'transaction.updated') {
    // Eventos no manejados — responder 200 para que Wompi no reintente
    return NextResponse.json({ received: true })
  }

  const tx = event.data.transaction
  const { reference, status, id: transactionId, amount_in_cents, payment_method_type } = tx

  // Buscar la suscripción por referencia
  const serviceClient = await createServiceClient()
  const { data: subscription } = await serviceClient
    .from('subscriptions')
    .select('id, organization_id, plan_id, wompi_transaction_id')
    .eq('wompi_reference', reference)
    .single()

  if (!subscription) {
    // Referencia desconocida — puede ser un webhook de otro sistema o referencia expirada
    console.warn('Webhook Wompi: referencia no encontrada:', reference)
    return NextResponse.json({ received: true })
  }

  // ── 3. Idempotencia: si ya procesamos esta transacción, ignorar ─
  if (subscription.wompi_transaction_id === transactionId) {
    return NextResponse.json({ received: true, duplicate: true })
  }

  // ── 4. Determinar qué plan se compró por el monto ──────────
  // El plan_id del checkout está guardado en la referencia implícitamente
  // (la referencia fue creada cuando el usuario seleccionó el plan).
  // Para MVP: derivamos el plan del monto recibido.
  let newPlanId = subscription.plan_id
  if (amount_in_cents === 8_990_000) newPlanId = 'basic'
  else if (amount_in_cents === 18_990_000) newPlanId = 'professional'

  // ── 5. Actualizar suscripción según estado del pago ────────
  const now = new Date()

  if (status === 'APPROVED') {
    // Activar suscripción por 30 días desde hoy
    const periodEnd = new Date(now)
    periodEnd.setDate(periodEnd.getDate() + 30)

    const { error } = await serviceClient
      .from('subscriptions')
      .update({
        status: 'active',
        plan_id: newPlanId,
        current_period_start: now.toISOString(),
        current_period_end: periodEnd.toISOString(),
        wompi_transaction_id: transactionId,
        amount_cop: Math.round(amount_in_cents / 100),
        payment_method: normalizePaymentMethod(payment_method_type),
        // Limpiar trial_ends_at si estaba en prueba
        trial_ends_at: null,
      })
      .eq('id', subscription.id)

    if (error) {
      console.error('Error activando suscripción:', error)
      return NextResponse.json({ error: 'Error procesando pago' }, { status: 500 })
    }

    console.log(`Suscripción activada: org ${subscription.organization_id}, plan ${newPlanId}`)

    trackEvent('subscription_activated', {
      orgId: subscription.organization_id,
      metadata: {
        plan_id:        newPlanId,
        amount_cop:     Math.round(amount_in_cents / 100),
        payment_method: normalizePaymentMethod(payment_method_type),
      },
    })
  } else if (status === 'DECLINED' || status === 'ERROR') {
    // Pago rechazado — solo marcar past_due si estaba activa (intento de renovación fallido)
    // Si estaba en trial, no cambiar estado (el usuario simplemente no completó el pago)
    const { data: currentSub } = await serviceClient
      .from('subscriptions')
      .select('status')
      .eq('id', subscription.id)
      .single()

    if (currentSub?.status === 'active') {
      await serviceClient
        .from('subscriptions')
        .update({
          status: 'past_due',
          wompi_transaction_id: transactionId,
        })
        .eq('id', subscription.id)
    }

    console.log(`Pago ${status} para org ${subscription.organization_id}`)
  }

  return NextResponse.json({ received: true })
}

// Normalizar tipo de pago de Wompi al formato interno
function normalizePaymentMethod(type?: string): 'pse' | 'card' | 'nequi' | 'daviplata' | null {
  if (!type) return null
  const map: Record<string, 'pse' | 'card' | 'nequi' | 'daviplata'> = {
    CARD: 'card',
    PSE: 'pse',
    NEQUI: 'nequi',
    DAVIPLATA: 'daviplata',
  }
  return map[type.toUpperCase()] ?? null
}
