'use client'

import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { cn } from '@/lib/utils'
import type { ChatMessage } from '@/types'

type DisplayMessage = Pick<ChatMessage, 'id' | 'role' | 'content' | 'created_at'>

interface ChatInterfaceProps {
  isActive: boolean
  subStatus: string
  messagesUsed: number
  messagesLimit: number
  planId: string
}

export default function ChatInterface({
  isActive,
  subStatus,
  messagesUsed,
  messagesLimit,
  planId,
}: ChatInterfaceProps) {
  const searchParams = useSearchParams()
  const prefilledQ = searchParams.get('q') ?? ''

  const [messages, setMessages] = useState<DisplayMessage[]>([])
  const [input, setInput] = useState(prefilledQ ? decodeURIComponent(prefilledQ) : '')
  const [loading, setLoading] = useState(false)
  const [loadingHistory, setLoadingHistory] = useState(true)
  const [error, setError] = useState('')
  const [remaining, setRemaining] = useState(messagesLimit - messagesUsed)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Cargar historial al montar
  useEffect(() => {
    if (!isActive) {
      setLoadingHistory(false)
      return
    }
    async function loadHistory() {
      try {
        const res = await fetch('/api/chat')
        if (!res.ok) return
        const json = await res.json()
        if (json.data && Array.isArray(json.data)) {
          setMessages(json.data)
        }
      } catch {
        // Fallo silencioso — el chat sigue funcionando sin historial previo
      } finally {
        setLoadingHistory(false)
      }
    }
    loadHistory()
  }, [isActive])

  useEffect(() => {
    if (!loadingHistory) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages, loadingHistory])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!input.trim() || loading || remaining <= 0) return

    const userMessage: DisplayMessage = {
      id: `temp-${Date.now()}`,
      role: 'user',
      content: input.trim(),
      created_at: new Date().toISOString(),
    }

    setMessages((prev) => [...prev, userMessage])
    setInput('')
    setLoading(true)
    setError('')

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userMessage.content }),
      })

      const json = await res.json()

      if (!res.ok) {
        setMessages((prev) => prev.filter((m) => m.id !== userMessage.id))

        if (json.code === 'AI_LIMIT_REACHED') {
          setError(json.error)
          setRemaining(0)
        } else if (json.code === 'SUBSCRIPTION_INACTIVE') {
          setError('Tu suscripción está inactiva. Activa un plan para continuar.')
        } else if (json.code === 'RATE_LIMITED') {
          setError('Enviaste muchas consultas seguidas. Espera unos minutos.')
        } else {
          setError(json.error ?? 'Error procesando tu consulta. Intenta de nuevo.')
        }
        return
      }

      const aiMessage: DisplayMessage = {
        id: `temp-ai-${Date.now()}`,
        role: json.data.role,
        content: json.data.message,
        created_at: new Date().toISOString(),
      }

      setMessages((prev) => [...prev, aiMessage])
      setRemaining(json.data.messages_remaining ?? remaining - 1)
      setTimeout(() => inputRef.current?.focus(), 100)
    } catch {
      setMessages((prev) => prev.filter((m) => m.id !== userMessage.id))
      setError('Error de conexión. Verifica tu internet e intenta de nuevo.')
    } finally {
      setLoading(false)
    }
  }

  // ── Estado: suscripción inactiva ─────────────────────────────
  if (!isActive) {
    return (
      <div className="flex flex-col flex-1 bg-white rounded-2xl border border-surface-200 overflow-hidden items-center justify-center p-8 text-center">
        <div className="w-16 h-16 rounded-full bg-surface-100 flex items-center justify-center mb-4">
          <svg className="w-8 h-8 text-surface-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
        </div>
        <h3 className="font-semibold text-surface-900 mb-2">
          {subStatus === 'trialing'
            ? 'Tu período de prueba venció'
            : 'Suscripción inactiva'}
        </h3>
        <p className="text-sm text-surface-300 mb-6 max-w-sm">
          Activa un plan para continuar accediendo al asesor ambiental IA y obtener respuestas ilimitadas sobre cumplimiento en Colombia.
        </p>
        <Link href="/cuenta" className="btn-primary">
          Ver planes y suscribirse →
        </Link>
      </div>
    )
  }

  // ── Estado: límite de mensajes agotado ───────────────────────
  if (remaining <= 0 && messages.length > 0) {
    return (
      <div className="flex flex-col flex-1 bg-white rounded-2xl border border-surface-200 overflow-hidden">
        {/* Mostrar historial */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.map((msg) => <MessageBubble key={msg.id} message={msg} />)}
          <div ref={bottomRef} />
        </div>
        {/* Banner de límite */}
        <div className="p-4 bg-orange-50 border-t border-orange-100 text-center">
          <p className="text-sm font-medium text-orange-800">
            Alcanzaste tu límite de {messagesLimit} consultas este mes
          </p>
          <p className="text-xs text-orange-600 mt-1 mb-3">
            Tu última pregunta fue enviada a un asesor de Regenera.
            {planId !== 'professional' && ' Actualiza tu plan para tener más consultas.'}
          </p>
          {planId !== 'professional' && (
            <Link href="/cuenta" className="text-sm font-medium text-orange-700 underline hover:text-orange-900">
              Actualizar plan →
            </Link>
          )}
        </div>
      </div>
    )
  }

  // ── Chat normal ───────────────────────────────────────────────
  return (
    <div className="flex flex-col flex-1 bg-white rounded-2xl border border-surface-200 overflow-hidden">
      {/* Área de mensajes */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {loadingHistory && (
          <div className="flex justify-center py-8">
            <p className="text-sm text-surface-300">Cargando historial...</p>
          </div>
        )}

        {!loadingHistory && messages.length === 0 && (
          <div className="text-center py-12">
            <p className="text-3xl mb-3">🌿</p>
            <p className="text-surface-800 font-medium">¿En qué puedo ayudarte hoy?</p>
            <p className="text-sm text-surface-300 mt-1 mb-6">
              Pregunta sobre obligaciones, permisos, normativa o cualquier tema ambiental
            </p>
            <div className="flex flex-wrap gap-2 justify-center">
              {QUICK_QUESTIONS.map((q) => (
                <button
                  key={q}
                  onClick={() => setInput(q)}
                  className="text-xs bg-surface-100 hover:bg-surface-200 text-surface-800 px-3 py-1.5 rounded-full transition-colors"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {!loadingHistory && messages.map((msg) => (
          <MessageBubble key={msg.id} message={msg} />
        ))}

        {loading && (
          <div className="flex justify-start">
            <div className="bg-surface-100 px-4 py-3 rounded-2xl rounded-bl-md">
              <div className="flex gap-1 items-center h-4">
                <div className="w-2 h-2 bg-surface-400 rounded-full animate-bounce [animation-delay:0ms]" />
                <div className="w-2 h-2 bg-surface-400 rounded-full animate-bounce [animation-delay:150ms]" />
                <div className="w-2 h-2 bg-surface-400 rounded-full animate-bounce [animation-delay:300ms]" />
              </div>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Error */}
      {error && (
        <div className="px-4 py-2.5 bg-red-50 border-t border-red-100 flex items-start justify-between gap-2">
          <p className="text-sm text-red-600">{error}</p>
          <button onClick={() => setError('')} className="text-red-400 hover:text-red-600 flex-shrink-0 text-xs">
            ✕
          </button>
        </div>
      )}

      {/* Contador de mensajes */}
      {remaining <= 10 && remaining > 0 && (
        <div className="px-4 py-1.5 bg-orange-50 border-t border-orange-100">
          <p className="text-xs text-orange-600">
            Quedan {remaining} consulta{remaining !== 1 ? 's' : ''} este mes
            {planId !== 'professional' && (
              <Link href="/cuenta" className="ml-2 underline hover:text-orange-800">
                Actualizar plan
              </Link>
            )}
          </p>
        </div>
      )}

      {/* Input */}
      <form onSubmit={handleSubmit} className="p-4 border-t border-surface-200 flex gap-3">
        <input
          ref={inputRef}
          type="text"
          className="input flex-1"
          placeholder="Escribe tu consulta ambiental..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={loading || loadingHistory}
          autoComplete="off"
          maxLength={2000}
        />
        <button
          type="submit"
          className="btn-primary px-5 disabled:opacity-50"
          disabled={loading || loadingHistory || !input.trim()}
        >
          {loading ? (
            <span className="flex items-center gap-2">
              <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            </span>
          ) : 'Enviar'}
        </button>
      </form>
    </div>
  )
}

// ─── Burbuja de mensaje ───────────────────────────────────────
function MessageBubble({ message }: { message: DisplayMessage }) {
  const isUser = message.role === 'user'
  const isAgent = message.role === 'human_agent'

  return (
    <div className={cn('flex', isUser ? 'justify-end' : 'justify-start')}>
      <div
        className={cn(
          'max-w-[82%] px-4 py-3 rounded-2xl text-sm leading-relaxed',
          isUser
            ? 'bg-brand-600 text-white rounded-br-md'
            : isAgent
            ? 'bg-blue-50 text-surface-900 rounded-bl-md border border-blue-200'
            : 'bg-surface-100 text-surface-900 rounded-bl-md'
        )}
      >
        {isAgent && (
          <p className="text-xs text-blue-600 font-semibold mb-1.5 flex items-center gap-1">
            <span>👤</span> Asesor Regenera
          </p>
        )}
        {/* Renderizar _cursiva_ de la nota de escalación */}
        <p className="whitespace-pre-wrap">
          {message.content.split(/(_[^_]+_)/g).map((part, i) =>
            part.startsWith('_') && part.endsWith('_') ? (
              <em key={i} className={cn(
                'not-italic text-xs block mt-2',
                isUser ? 'text-brand-200' : 'text-surface-400'
              )}>
                {part.slice(1, -1)}
              </em>
            ) : (
              <span key={i}>{part}</span>
            )
          )}
        </p>
      </div>
    </div>
  )
}

const QUICK_QUESTIONS = [
  '¿Qué es el RUA y quién debe presentarlo?',
  '¿Cómo registro mi empresa como generador de RESPEL?',
  '¿Qué permisos necesito para mis vertimientos?',
  '¿Cuándo debo presentar el informe anual de residuos peligrosos?',
]
