// Templates HTML para emails de notificación.
// Diseño inline (compatible con todos los clientes de email).
// Sin imágenes externas — no hay tracking de píxel.

import { APP_URL } from '@/lib/resend/client'

// ─── Layout base ─────────────────────────────────────────────
function layout(content: string): string {
  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
</head>
<body style="margin:0;padding:0;background:#f0fdf4;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f0fdf4;padding:40px 16px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0"
        style="max-width:560px;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #dcfce7;">

        <!-- Header verde -->
        <tr>
          <td style="background:#16a34a;padding:20px 32px;">
            <span style="color:#ffffff;font-size:18px;font-weight:700;letter-spacing:-0.3px;">Regenera</span>
            <span style="color:#86efac;font-size:13px;margin-left:8px;">Cumplimiento Ambiental</span>
          </td>
        </tr>

        <!-- Contenido -->
        <tr><td style="padding:32px;">
          ${content}
        </td></tr>

        <!-- Footer -->
        <tr>
          <td style="padding:16px 32px 24px;border-top:1px solid #f3f4f6;">
            <p style="margin:0;color:#9ca3af;font-size:12px;line-height:1.6;">
              Recibiste este correo porque eres administrador de tu organización en Regenera.<br>
              <a href="${APP_URL}/cuenta" style="color:#16a34a;text-decoration:none;">Gestionar preferencias</a>
              &nbsp;·&nbsp;
              <a href="${APP_URL}/dashboard" style="color:#16a34a;text-decoration:none;">Ir al dashboard</a>
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`
}

// ─── CTA button ───────────────────────────────────────────────
function btn(href: string, text: string, color = '#16a34a'): string {
  return `<table cellpadding="0" cellspacing="0" style="margin-top:24px;">
  <tr><td>
    <a href="${href}"
      style="display:inline-block;background:${color};color:#ffffff;font-weight:600;font-size:14px;
             padding:13px 28px;border-radius:10px;text-decoration:none;letter-spacing:-0.1px;">
      ${text}
    </a>
  </td></tr>
</table>`
}

// ─── 1. Email: obligaciones vencidas ─────────────────────────
// Máxima urgencia. CTA al dashboard con query pre-cargada.
export function overdueEmail(
  orgName: string,
  overdueCount: number
): { subject: string; html: string } {
  const n = overdueCount
  const label = n === 1 ? '1 obligación' : `${n} obligaciones`
  const dashboardUrl = `${APP_URL}/dashboard`

  const content = `
    <div style="display:inline-block;background:#fef2f2;border:1px solid #fecaca;
                border-radius:8px;padding:6px 14px;margin-bottom:20px;">
      <span style="color:#dc2626;font-weight:600;font-size:13px;">⚠ Acción urgente requerida</span>
    </div>

    <h1 style="margin:0 0 12px;font-size:22px;font-weight:700;color:#111827;line-height:1.3;">
      ${label} de ${orgName} ${n === 1 ? 'ha vencido' : 'han vencido'}
    </h1>

    <p style="margin:0 0 16px;color:#374151;font-size:15px;line-height:1.6;">
      ${n === 1
        ? 'Una obligación ambiental ya superó su fecha límite.'
        : `${n} obligaciones ambientales ya superaron su fecha límite.`
      }
      El incumplimiento puede generar multas que van desde
      <strong style="color:#dc2626;">1 hasta 300 SMMLV</strong>
      ($1.4M–$434M COP) según la Ley 1333/2009.
    </p>

    <p style="margin:0 0 8px;color:#6b7280;font-size:14px;line-height:1.5;">
      Revisa qué pasos tomar para regularizar la situación lo antes posible.
      El asesor IA ya conoce el perfil de tu empresa y puede orientarte en menos de 30 segundos.
    </p>

    ${btn(`${APP_URL}/chat?q=${encodeURIComponent('Tengo obligaciones ambientales vencidas. ¿Por cuál debo empezar y qué debo hacer?')}`, 'Gestionar con el asesor →', '#dc2626')}

    <p style="margin:20px 0 0;font-size:13px;color:#9ca3af;">
      También puedes
      <a href="${dashboardUrl}" style="color:#16a34a;text-decoration:none;font-weight:500;">ver el dashboard</a>
      para el resumen completo.
    </p>
  `

  return {
    subject: `⚠ ${label} de ${orgName} ${n === 1 ? 'venció' : 'vencieron'} — actúa ahora`,
    html: layout(content),
  }
}

// ─── 2. Email: obligaciones críticas (≤7 días) ────────────────
export function criticalEmail(
  orgName: string,
  criticalCount: number
): { subject: string; html: string } {
  const n = criticalCount
  const label = n === 1 ? '1 obligación vence' : `${n} obligaciones vencen`

  const content = `
    <div style="display:inline-block;background:#fff7ed;border:1px solid #fed7aa;
                border-radius:8px;padding:6px 14px;margin-bottom:20px;">
      <span style="color:#c2410c;font-weight:600;font-size:13px;">📅 Plazo próximo esta semana</span>
    </div>

    <h1 style="margin:0 0 12px;font-size:22px;font-weight:700;color:#111827;line-height:1.3;">
      ${label} esta semana en ${orgName}
    </h1>

    <p style="margin:0 0 16px;color:#374151;font-size:15px;line-height:1.6;">
      Tienes plazos muy próximos. Actuar ahora te da tiempo para preparar la documentación,
      coordinar con la autoridad ambiental y evitar incumplimientos.
    </p>

    <p style="margin:0;color:#6b7280;font-size:14px;line-height:1.5;">
      Entra al panel para ver cuáles son, sus fechas exactas y los pasos recomendados.
    </p>

    ${btn(`${APP_URL}/obligaciones`, 'Ver obligaciones urgentes →', '#ea580c')}
  `

  return {
    subject: `📅 ${label} esta semana — ${orgName}`,
    html: layout(content),
  }
}

// ─── 3. Email: reactivación (usuario inactivo) ────────────────
export function inactiveEmail(
  orgName: string
): { subject: string; html: string } {
  const content = `
    <h1 style="margin:0 0 12px;font-size:22px;font-weight:700;color:#111827;line-height:1.3;">
      ¿Cómo va el cumplimiento de ${orgName}?
    </h1>

    <p style="margin:0 0 16px;color:#374151;font-size:15px;line-height:1.6;">
      Hace unos días no revisas tu panel de cumplimiento ambiental.
      Mantener el seguimiento activo evita sorpresas con plazos y sanciones.
    </p>

    <p style="margin:0 0 8px;color:#6b7280;font-size:14px;line-height:1.5;">
      Tu asesor IA ya conoce el perfil de ${orgName}.
      Puedes hacer cualquier consulta sobre obligaciones, permisos o normativa en menos de un minuto.
    </p>

    ${btn(`${APP_URL}/dashboard`, 'Revisar mi panel →')}

    <p style="margin:20px 0 0;font-size:13px;color:#9ca3af;">
      ¿Tienes una duda específica?
      <a href="${APP_URL}/chat" style="color:#16a34a;text-decoration:none;font-weight:500;">
        Pregúntale al asesor →
      </a>
    </p>
  `

  return {
    subject: `¿Cómo va el cumplimiento de ${orgName}? Te actualizamos`,
    html: layout(content),
  }
}

// ─── 4. Email: límite de IA cercano ──────────────────────────
export function aiLimitEmail(
  orgName: string,
  messagesUsed: number,
  messagesLimit: number
): { subject: string; html: string } {
  const remaining = messagesLimit - messagesUsed
  const pct = Math.round((messagesUsed / messagesLimit) * 100)

  const content = `
    <div style="display:inline-block;background:#fffbeb;border:1px solid #fde68a;
                border-radius:8px;padding:6px 14px;margin-bottom:20px;">
      <span style="color:#b45309;font-weight:600;font-size:13px;">
        💬 ${pct}% de consultas usadas este mes
      </span>
    </div>

    <h1 style="margin:0 0 12px;font-size:22px;font-weight:700;color:#111827;line-height:1.3;">
      Te quedan ${remaining} consulta${remaining !== 1 ? 's' : ''} con el asesor
    </h1>

    <p style="margin:0 0 16px;color:#374151;font-size:15px;line-height:1.6;">
      Este mes ${orgName} ya usó <strong>${messagesUsed} de ${messagesLimit}</strong> consultas disponibles.
      Úsalas para resolver las obligaciones más urgentes o importantes.
    </p>

    <p style="margin:0 0 8px;color:#6b7280;font-size:14px;line-height:1.5;">
      Cuando agotes el límite, tu próxima pregunta será escalada a un asesor humano de Regenera.
    </p>

    ${btn(`${APP_URL}/chat`, 'Consultar al asesor ahora →', '#b45309')}

    <p style="margin:20px 0 0;font-size:13px;color:#9ca3af;">
      ¿Necesitas más consultas?
      <a href="${APP_URL}/cuenta" style="color:#16a34a;text-decoration:none;font-weight:500;">
        Revisa tu plan →
      </a>
    </p>
  `

  return {
    subject: `Quedan ${remaining} consultas este mes en ${orgName} — úsalas bien`,
    html: layout(content),
  }
}
