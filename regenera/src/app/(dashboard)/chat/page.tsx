import type { Metadata } from 'next'
import { requireAuth, requireOrgContext } from '@/lib/auth/guards'
import ChatInterface from '@/components/chat/ChatInterface'

export const metadata: Metadata = { title: 'Chat con Asesora' }

// Server Component: valida auth y pasa contexto de suscripción al cliente.
// Esto evita que ChatInterface tenga que hacer un fetch extra para saber
// si el chat está disponible — lo sabe desde el primer render.
export default async function ChatPage() {
  const user = await requireAuth()
  const ctx = await requireOrgContext(user.id)

  return (
    <div className="h-full flex flex-col">
      <div className="mb-4 flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold text-surface-900">Consulta ambiental</h1>
          <p className="text-sm text-surface-300">
            Resuelve tus dudas ambientales en tiempo real
          </p>
        </div>
        {/* Contador de uso — visible desde el primer render sin esperar el fetch */}
        {ctx.isActive && (
          <div className="text-right hidden sm:block">
            <p className={`text-xs font-medium ${
              ctx.aiUsage.percentage >= 90 ? 'text-red-600' :
              ctx.aiUsage.percentage >= 70 ? 'text-orange-600' : 'text-surface-300'
            }`}>
              {ctx.aiUsage.used} / {ctx.aiUsage.limit} consultas usadas
            </p>
            <div className="mt-1 h-1.5 w-32 bg-surface-100 rounded-full">
              <div
                className={`h-1.5 rounded-full transition-all ${
                  ctx.aiUsage.percentage >= 90 ? 'bg-red-500' :
                  ctx.aiUsage.percentage >= 70 ? 'bg-orange-500' : 'bg-brand-500'
                }`}
                style={{ width: `${Math.min(ctx.aiUsage.percentage, 100)}%` }}
              />
            </div>
          </div>
        )}
      </div>
      <ChatInterface
        isActive={ctx.isActive}
        subStatus={ctx.subStatus}
        messagesUsed={ctx.aiUsage.used}
        messagesLimit={ctx.aiUsage.limit}
        planId={ctx.plan.id}
      />
    </div>
  )
}
