-- ============================================================
-- Regenera Platform — Migración de hardening v1.2
-- Aplicar DESPUÉS de 001_initial_schema.sql
-- ============================================================

-- ──────────────────────────────────────────────────────────────
-- FIX P1: Eliminar organizations.subscription_status (campo redundante)
-- y reemplazarlo por una vista calculada desde subscriptions.
--
-- El estado de suscripción vive en subscriptions.status (fuente de verdad).
-- organizations.subscription_status se desincronizaba en producción
-- porque el webhook de Wompi solo actualizaba subscriptions.
-- ──────────────────────────────────────────────────────────────

ALTER TABLE organizations DROP COLUMN IF EXISTS subscription_status;

-- Vista que expone el estado actual de suscripción sin campo duplicado.
-- Las API Routes y el frontend consultarán esta vista cuando necesiten
-- el estado junto con datos de la organización.
CREATE OR REPLACE VIEW organization_subscription_status AS
SELECT
    o.id AS organization_id,
    s.status AS subscription_status,
    s.plan_id,
    s.trial_ends_at,
    s.current_period_end
FROM organizations o
LEFT JOIN subscriptions s ON s.organization_id = o.id;

-- ──────────────────────────────────────────────────────────────
-- FIX P2: Proteger trigger de invitaciones contra inyección de org_id
--
-- Problema: cualquier usuario podía pasar organization_id en signUp()
-- y el trigger lo asignaba sin verificar. Solución: solo usar
-- raw_user_meta_data cuando Supabase generó la invitación (invited_at NOT NULL).
-- ──────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger AS $$
DECLARE
    new_org_id uuid;
    invited_org_id uuid;
BEGIN
    -- Solo confiar en organization_id de metadata si es una invitación
    -- real generada por auth.admin.inviteUserByEmail (invited_at IS NOT NULL).
    -- Un signup normal nunca tendrá invited_at, así que este branch no
    -- puede ser explotado por usuarios externos.
    IF NEW.invited_at IS NOT NULL THEN
        invited_org_id := (NEW.raw_user_meta_data->>'organization_id')::uuid;
    END IF;

    IF invited_org_id IS NOT NULL THEN
        -- Usuario invitado legítimo → asociar a la org existente
        INSERT INTO organization_members (organization_id, user_id, role, status)
        VALUES (invited_org_id, NEW.id, 'member', 'active')
        ON CONFLICT (organization_id, user_id) DO UPDATE SET status = 'active';
    ELSE
        -- Registro normal → crear organización propia con trial
        INSERT INTO organizations (name)
        VALUES (COALESCE(NEW.raw_user_meta_data->>'full_name', 'Mi Empresa'))
        RETURNING id INTO new_org_id;

        INSERT INTO organization_members (organization_id, user_id, role, status)
        VALUES (new_org_id, NEW.id, 'owner', 'active');

        INSERT INTO subscriptions
            (organization_id, plan_id, status, trial_ends_at, current_period_start, current_period_end)
        VALUES (
            new_org_id,
            'trial',
            'trialing',
            now() + interval '14 days',
            now(),
            now() + interval '14 days'
        );
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ──────────────────────────────────────────────────────────────
-- FIX P3: Separar políticas RLS en subscriptions
--
-- Problema: FOR ALL permitía UPDATE desde el cliente, lo que podría
-- usarse para cambiar plan_id o status directamente sin pagar.
-- Solución: SELECT permitido para el usuario, el resto solo via
-- service role (webhook de Wompi). Las API Routes que actualizan
-- suscripciones deben usar createServiceClient().
-- ──────────────────────────────────────────────────────────────

-- Eliminar política permisiva existente
DROP POLICY IF EXISTS "subscriptions_isolation" ON subscriptions;

-- Solo lectura para usuarios autenticados (ver su propia suscripción)
DROP POLICY IF EXISTS "subscriptions_select" ON subscriptions;
CREATE POLICY "subscriptions_select" ON subscriptions
    FOR SELECT USING (organization_id = get_user_org_id());

-- INSERT y UPDATE solo via service role (RLS bypaseado).
-- Las API Routes que crean/actualizan suscripciones deben usar
-- createServiceClient() que usa SUPABASE_SERVICE_ROLE_KEY.
-- Nota: el trigger handle_new_user ya es SECURITY DEFINER, no necesita esta política.

-- ──────────────────────────────────────────────────────────────
-- FIX P4: Hacer ai_usage.user_id nullable
--
-- El modelo es por organización (UNIQUE organization_id + period_start).
-- Guardar user_id era engañoso: en orgs con 2 usuarios, quedaba
-- el último que envió un mensaje. Se hace nullable para no perder
-- el campo si en el futuro se quiere registrar por usuario.
-- ──────────────────────────────────────────────────────────────

ALTER TABLE ai_usage ALTER COLUMN user_id DROP NOT NULL;

-- Actualizar la función de incremento para que user_id sea opcional
CREATE OR REPLACE FUNCTION increment_ai_usage(
    p_organization_id uuid,
    p_user_id uuid,      -- puede ser NULL en llamadas futuras
    p_period_start date,
    p_period_end date,
    p_tokens integer
) RETURNS void AS $$
BEGIN
    INSERT INTO ai_usage
        (organization_id, user_id, period_start, period_end,
         messages_used, tokens_used, last_message_at)
    VALUES
        (p_organization_id, p_user_id, p_period_start, p_period_end,
         1, p_tokens, now())
    ON CONFLICT (organization_id, period_start)
    DO UPDATE SET
        messages_used   = ai_usage.messages_used + 1,
        tokens_used     = ai_usage.tokens_used + p_tokens,
        last_message_at = now();
        -- Nota: user_id no se actualiza en el UPDATE para no sobreescribir
        -- con el último usuario (el dato ya no es confiable en orgs multi-usuario)
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ──────────────────────────────────────────────────────────────
-- FIX P5: CHECK constraint en organizations.sector
--
-- El tipo OrgSector en TypeScript define 8 valores válidos.
-- Sin este CHECK, una inserción con sector inválido no fallaba en DB.
-- ──────────────────────────────────────────────────────────────

ALTER TABLE organizations
    ADD CONSTRAINT chk_org_sector
    CHECK (sector IS NULL OR sector IN (
        'manufactura', 'alimentos', 'servicios', 'construccion',
        'salud', 'comercio', 'educacion', 'otro'
    ));

ALTER TABLE organizations
    ADD CONSTRAINT chk_org_employee_count
    CHECK (employee_count IS NULL OR employee_count IN (
        '1-10', '11-50', '51-200', '200+'
    ));

-- ──────────────────────────────────────────────────────────────
-- MEJORA P6: Índice en subscriptions para el cron job de renovaciones
-- ──────────────────────────────────────────────────────────────

CREATE INDEX idx_subscriptions_period_end
    ON subscriptions(current_period_end)
    WHERE status IN ('active', 'trialing');

-- ──────────────────────────────────────────────────────────────
-- MEJORA P8: Índice en chat_messages para buscar por escalación
-- ──────────────────────────────────────────────────────────────

CREATE INDEX idx_chat_escalation
    ON chat_messages(escalation_id)
    WHERE escalation_id IS NOT NULL;
