// POST /api/cron/notifications
//
// Endpoint llamado diariamente por un cron externo.
// Opciones de scheduler:
//   - Vercel Cron (vercel.json): "0 8 * * *"  → 8am UTC (3am Colombia)
//   - cron-job.org (gratuito)
//   - GitHub Actions con schedule
//
// Seguridad: Authorization: Bearer <CRON_SECRET>
// CRON_SECRET debe ser una cadena aleatoria ≥32 chars (nunca compartir).

import { type NextRequest, NextResponse } from 'next/server'
import { runNotificationJob } from '@/lib/notifications/send'

export const runtime = 'nodejs'        // Necesita Node.js (no Edge) por el admin client
export const maxDuration = 60          // Vercel: 60s máximo en plan Hobby

export async function POST(request: NextRequest) {
  // ── Autenticación del cron ────────────────────────────────
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET

  if (!cronSecret) {
    console.error('[cron/notifications] CRON_SECRET no configurado')
    return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 })
  }

  // Comparación constante para evitar timing attacks
  const provided = authHeader?.replace('Bearer ', '') ?? ''
  if (provided.length === 0 || provided !== cronSecret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // ── Ejecutar job ──────────────────────────────────────────
  const startedAt = Date.now()

  try {
    const result = await runNotificationJob()
    const duration = Date.now() - startedAt

    console.log(`[cron/notifications] Completado en ${duration}ms`, result)

    return NextResponse.json({
      ok: true,
      duration_ms: duration,
      result,
    })
  } catch (err) {
    const duration = Date.now() - startedAt
    console.error(`[cron/notifications] Error en ${duration}ms:`, err)

    return NextResponse.json(
      { error: 'Job failed', details: String(err) },
      { status: 500 }
    )
  }
}

// GET para verificación de salud (sin autenticación — solo confirma que el endpoint existe)
export async function GET() {
  return NextResponse.json({ status: 'ok', endpoint: 'cron/notifications' })
}
