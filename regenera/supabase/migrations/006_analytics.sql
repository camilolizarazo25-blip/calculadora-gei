-- ============================================================
-- Regenera Platform — Analytics v1.0
-- Tracking de eventos del producto para entender el negocio.
-- Aplicar DESPUÉS de 005_notifications.sql
-- ============================================================

-- ── Tabla de eventos ─────────────────────────────────────────
CREATE TABLE analytics_events (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_name      TEXT        NOT NULL,
  user_id         UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  organization_id UUID        REFERENCES organizations(id) ON DELETE SET NULL,
  metadata        JSONB       NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_analytics_event_name    ON analytics_events (event_name, created_at DESC);
CREATE INDEX idx_analytics_org_events    ON analytics_events (organization_id, event_name, created_at DESC);
CREATE INDEX idx_analytics_user_activity ON analytics_events (user_id, created_at DESC);
CREATE INDEX idx_analytics_created_at    ON analytics_events (created_at DESC);

-- RLS habilitado — escritura solo via service role (admin client)
ALTER TABLE analytics_events ENABLE ROW LEVEL SECURITY;

-- ── Permisos explícitos ───────────────────────────────────────
-- El trigger de subscriptions corre como postgres (SECURITY DEFINER)
-- pero necesita permiso explícito sobre la tabla para INSERT.
GRANT INSERT ON analytics_events TO postgres;
GRANT INSERT ON analytics_events TO service_role;

-- ── Trigger: subscription_created ────────────────────────────
-- Vive en la tabla subscriptions (schema público) — sin restricciones de permisos.
-- El evento user_registered se trackea desde handle_new_user (ver abajo).
CREATE OR REPLACE FUNCTION track_subscription_created()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  BEGIN
    INSERT INTO analytics_events (event_name, organization_id, metadata)
    VALUES (
      'subscription_created',
      NEW.organization_id,
      jsonb_build_object(
        'plan_id', NEW.plan_id,
        'status',  NEW.status
      )
    );
  EXCEPTION WHEN OTHERS THEN
    NULL; -- Analytics nunca rompe el flujo principal
  END;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_subscription_created_analytics
  AFTER INSERT ON subscriptions
  FOR EACH ROW EXECUTE FUNCTION track_subscription_created();

-- ── user_registered: integrado en handle_new_user ────────────
-- En lugar de un trigger separado en auth.users (que requiere permisos
-- de superusuario y puede romper el signup), el evento user_registered
-- se registra directamente dentro de handle_new_user que ya corre
-- como SECURITY DEFINER con privilegios de postgres.
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger AS $$
DECLARE
    new_org_id uuid;
    invited_org_id uuid;
    org_exists boolean;
BEGIN
    -- Solo leer organization_id si es invitación legítima de Supabase
    IF NEW.invited_at IS NOT NULL THEN
        invited_org_id := (NEW.raw_user_meta_data->>'organization_id')::uuid;
    END IF;

    -- Validar que la org referenciada existe
    IF invited_org_id IS NOT NULL THEN
        SELECT EXISTS(
            SELECT 1 FROM organizations WHERE id = invited_org_id
        ) INTO org_exists;

        IF NOT org_exists THEN
            invited_org_id := NULL;
        END IF;
    END IF;

    IF invited_org_id IS NOT NULL THEN
        INSERT INTO organization_members (organization_id, user_id, role, status)
        VALUES (invited_org_id, NEW.id, 'member', 'active')
        ON CONFLICT (organization_id, user_id) DO UPDATE SET status = 'active';
    ELSE
        INSERT INTO organizations (name)
        VALUES (COALESCE(NULLIF(TRIM(NEW.raw_user_meta_data->>'full_name'), ''), 'Mi Empresa'))
        RETURNING id INTO new_org_id;

        INSERT INTO organization_members (organization_id, user_id, role, status)
        VALUES (new_org_id, NEW.id, 'owner', 'active');

        INSERT INTO subscriptions
            (organization_id, plan_id, status, trial_ends_at, current_period_start, current_period_end)
        VALUES (
            new_org_id, 'trial', 'trialing',
            now() + interval '14 days',
            now(),
            now() + interval '14 days'
        );
    END IF;

    -- Registrar evento de analytics (silencioso — nunca rompe el registro)
    BEGIN
        INSERT INTO analytics_events (event_name, user_id, metadata)
        VALUES (
            'user_registered',
            NEW.id,
            jsonb_build_object(
                'source', CASE WHEN NEW.invited_at IS NOT NULL THEN 'invite' ELSE 'direct' END
            )
        );
    EXCEPTION WHEN OTHERS THEN
        NULL;
    END;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
