'use client'

import { useCallback, useEffect, useState } from 'react'
import type { MemberRole, OrgSector, EmployeeCount, OrgProfile } from '@/types'

// Forma que devuelve GET /api/org — refleja el join Supabase
interface OrgSubscription {
  plan_id: string
  status: string
  trial_ends_at: string | null
  current_period_start: string
  current_period_end: string
}

export interface OrgData {
  role: MemberRole
  organizations: {
    id: string
    name: string
    nit: string | null
    sector: OrgSector | null
    city: string | null
    department: string | null
    employee_count: EmployeeCount | null
    profile: OrgProfile | null
    onboarding_completed_at: string | null
    subscriptions: OrgSubscription[]
  }
}

interface UseOrganizationResult {
  org: OrgData | null
  loading: boolean
  error: string | null
  refetch: () => Promise<void>
}

// Hook para acceder a la organización del usuario autenticado.
// Llama a GET /api/org (sujeta a RLS — solo devuelve la org propia).
// Llamar refetch() si el usuario actualiza datos del perfil.
export function useOrganization(): UseOrganizationResult {
  const [org, setOrg] = useState<OrgData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchOrg = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/org')
      const body = await res.json().catch(() => null)
      if (!res.ok) {
        setError(body?.error ?? 'Error cargando organización')
        setOrg(null)
      } else {
        setOrg(body.data as OrgData)
      }
    } catch {
      setError('Error de red')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchOrg()
  }, [fetchOrg])

  return { org, loading, error, refetch: fetchOrg }
}
