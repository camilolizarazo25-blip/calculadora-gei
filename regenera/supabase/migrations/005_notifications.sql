-- ============================================================
-- Regenera Platform — Notificaciones v1.0
-- Sistema anti-spam con cooldowns por tipo.
-- Aplicar DESPUÉS de 004_billing.sql
-- ============================================================

-- ── Registro de notificaciones enviadas (anti-spam) ───────────
-- Permite verificar si ya se envió un tipo específico recientemente.
-- No necesita RLS de usuario — solo accede el service role (cron).
CREATE TABLE notification_logs (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id     UUID        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id    UUID        NOT NULL,   -- destinatario (owner)
  type       TEXT        NOT NULL
    CHECK (type IN ('overdue', 'critical', 'inactive', 'ai_limit')),
  sent_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índice para lookup de cooldown: "¿se envió este tipo para esta org en los últimos N días?"
CREATE INDEX idx_notification_logs_cooldown
  ON notification_logs (org_id, type, sent_at DESC);

ALTER TABLE notification_logs ENABLE ROW LEVEL SECURITY;
-- Sin políticas de usuario: solo service role accede (cron job)


-- ── Función: orgs con obligaciones vencidas ───────────────────
CREATE OR REPLACE FUNCTION get_overdue_notification_targets()
RETURNS TABLE(
  org_id        UUID,
  org_name      TEXT,
  user_id       UUID,
  user_email    TEXT,
  overdue_count BIGINT
) LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT
    o.id,
    o.name,
    om.user_id,
    u.email,
    COUNT(oo.id)
  FROM organizations o
  JOIN organization_members om
    ON om.organization_id = o.id AND om.role = 'owner' AND om.status = 'active'
  JOIN auth.users u ON u.id = om.user_id
  JOIN subscriptions s
    ON s.organization_id = o.id AND s.status IN ('active', 'trialing')
  JOIN organization_obligations oo
    ON oo.organization_id = o.id
    AND oo.due_date < CURRENT_DATE
    AND oo.status NOT IN ('done', 'not_applicable')
  WHERE o.onboarding_completed_at IS NOT NULL
  GROUP BY o.id, o.name, om.user_id, u.email
  HAVING COUNT(oo.id) > 0;
$$;


-- ── Función: orgs con obligaciones que vencen en ≤7 días ──────
CREATE OR REPLACE FUNCTION get_critical_notification_targets()
RETURNS TABLE(
  org_id         UUID,
  org_name       TEXT,
  user_id        UUID,
  user_email     TEXT,
  critical_count BIGINT
) LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT
    o.id,
    o.name,
    om.user_id,
    u.email,
    COUNT(oo.id)
  FROM organizations o
  JOIN organization_members om
    ON om.organization_id = o.id AND om.role = 'owner' AND om.status = 'active'
  JOIN auth.users u ON u.id = om.user_id
  JOIN subscriptions s
    ON s.organization_id = o.id AND s.status IN ('active', 'trialing')
  JOIN organization_obligations oo
    ON oo.organization_id = o.id
    AND oo.due_date BETWEEN CURRENT_DATE AND (CURRENT_DATE + INTERVAL '7 days')
    AND oo.status NOT IN ('done', 'not_applicable')
  WHERE o.onboarding_completed_at IS NOT NULL
  GROUP BY o.id, o.name, om.user_id, u.email
  HAVING COUNT(oo.id) > 0;
$$;


-- ── Función: owners inactivos (sin login en N días) ───────────
-- Solo notifica si la org tiene obligaciones pendientes (hay algo que revisar).
CREATE OR REPLACE FUNCTION get_inactive_notification_targets(
  days_inactive INT DEFAULT 4
)
RETURNS TABLE(
  org_id       UUID,
  org_name     TEXT,
  user_id      UUID,
  user_email   TEXT,
  last_seen_at TIMESTAMPTZ
) LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT
    o.id,
    o.name,
    om.user_id,
    u.email,
    u.last_sign_in_at
  FROM organizations o
  JOIN organization_members om
    ON om.organization_id = o.id AND om.role = 'owner' AND om.status = 'active'
  JOIN auth.users u ON u.id = om.user_id
  JOIN subscriptions s
    ON s.organization_id = o.id AND s.status IN ('active', 'trialing')
  WHERE o.onboarding_completed_at IS NOT NULL
    -- Sin login reciente
    AND (
      u.last_sign_in_at IS NULL
      OR u.last_sign_in_at < (NOW() - (days_inactive || ' days')::INTERVAL)
    )
    -- Tiene obligaciones que justifican volver
    AND EXISTS (
      SELECT 1 FROM organization_obligations oo
      WHERE oo.organization_id = o.id
        AND oo.status NOT IN ('done', 'not_applicable')
    );
$$;


-- ── Función: orgs con uso de IA ≥ umbral en el mes actual ─────
-- No notifica cuando ya alcanzaron el límite (ya lo ven en el UI).
CREATE OR REPLACE FUNCTION get_high_ai_usage_targets(
  threshold_pct INT DEFAULT 80
)
RETURNS TABLE(
  org_id         UUID,
  org_name       TEXT,
  user_id        UUID,
  user_email     TEXT,
  messages_used  INT,
  messages_limit INT,
  usage_pct      INT
) LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT
    o.id,
    o.name,
    om.user_id,
    u.email,
    au.messages_used::INT,
    sp.ai_messages_per_month::INT,
    ROUND((au.messages_used::NUMERIC / sp.ai_messages_per_month::NUMERIC) * 100)::INT
  FROM organizations o
  JOIN organization_members om
    ON om.organization_id = o.id AND om.role = 'owner' AND om.status = 'active'
  JOIN auth.users u ON u.id = om.user_id
  JOIN subscriptions s
    ON s.organization_id = o.id AND s.status IN ('active', 'trialing')
  JOIN subscription_plans sp ON sp.id = s.plan_id
  JOIN ai_usage au
    ON au.organization_id = o.id
    AND au.period_start = DATE_TRUNC('month', CURRENT_DATE)::DATE
  WHERE ROUND((au.messages_used::NUMERIC / sp.ai_messages_per_month::NUMERIC) * 100) >= threshold_pct
    -- No notificar si ya llegó al límite (UI ya lo muestra)
    AND au.messages_used < sp.ai_messages_per_month;
$$;
