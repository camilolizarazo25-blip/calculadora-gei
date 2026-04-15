-- ============================================================
-- Regenera Platform — RLS Hardening v1.3
-- Segunda iteración de seguridad — aplicar después de 002.
-- ============================================================

-- ──────────────────────────────────────────────────────────────
-- HELPER: función para obtener el rol del usuario actual
-- Necesaria para distinguir owner vs member en políticas RLS.
-- STABLE + SECURITY DEFINER: cacheable por transacción, bypasea RLS interno.
-- ──────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION get_user_role()
RETURNS text AS $$
    SELECT role
    FROM organization_members
    WHERE user_id = auth.uid() AND status = 'active'
    LIMIT 1;
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- ──────────────────────────────────────────────────────────────
-- CLEANUP: eliminar VIEW no utilizada (creada en 002)
-- El código no la usa — genera confusión innecesaria.
-- ──────────────────────────────────────────────────────────────

DROP VIEW IF EXISTS organization_subscription_status;

-- ──────────────────────────────────────────────────────────────
-- FIX: subscriptions — agregar updated_at para auditoría de webhooks
-- Permite saber cuándo Wompi actualizó la suscripción por última vez.
-- ──────────────────────────────────────────────────────────────

ALTER TABLE subscriptions
    ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

CREATE OR REPLACE FUNCTION update_subscription_timestamp()
RETURNS trigger AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_subscriptions_updated_at
    BEFORE UPDATE ON subscriptions
    FOR EACH ROW EXECUTE FUNCTION update_subscription_timestamp();

-- ──────────────────────────────────────────────────────────────
-- FIX CRÍTICO: organizations
--
-- Problema actual (FOR ALL):
--   - Cualquier member puede DELETE la org (cascade borra TODO)
--   - Cualquier member puede UPDATE datos de la org
--
-- Política correcta:
--   - SELECT: todos los miembros activos
--   - UPDATE: solo el owner (onboarding, configuración)
--   - INSERT: nunca desde cliente (el trigger SECURITY DEFINER lo hace)
--   - DELETE: nunca desde cliente (operación irreversible, solo admin interno)
-- ──────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "org_isolation" ON organizations;

CREATE POLICY "org_select" ON organizations
    FOR SELECT
    USING (id = get_user_org_id());

CREATE POLICY "org_update_owner_only" ON organizations
    FOR UPDATE
    USING (id = get_user_org_id() AND get_user_role() = 'owner')
    WITH CHECK (id = get_user_org_id());

-- No hay política para INSERT ni DELETE desde el cliente.
-- INSERT: solo el trigger handle_new_user (SECURITY DEFINER)
-- DELETE: solo desde panel admin de Regenera vía service_role

-- ──────────────────────────────────────────────────────────────
-- FIX CRÍTICO: organization_members
--
-- Problema actual (FOR ALL):
--   - Un member puede hacer UPDATE { role: 'owner' } sobre sí mismo
--   - Un member puede DELETE al owner
--   - Cualquiera puede INSERT nuevos miembros directamente
--
-- Política correcta:
--   - SELECT: todos los miembros (ver quién está en la org)
--   - INSERT/UPDATE/DELETE: nunca desde cliente
--     → La invitación usa /api/org/members con createServiceClient()
--     → El trigger handle_new_user usa SECURITY DEFINER
-- ──────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "members_isolation" ON organization_members;

CREATE POLICY "members_select" ON organization_members
    FOR SELECT
    USING (organization_id = get_user_org_id());

-- ──────────────────────────────────────────────────────────────
-- FIX CRÍTICO: chat_messages
--
-- Problema actual (FOR ALL):
--   - Un usuario puede INSERT con role='assistant' o role='human_agent'
--     → Inyección de respuestas falsas de la IA o del asesor
--   - Un usuario puede UPDATE el contenido de mensajes existentes
--   - Un usuario puede DELETE mensajes (destruir historial)
--
-- Política correcta:
--   - SELECT: todos los miembros ven el historial completo
--   - INSERT: solo role='user', user_id debe ser el propio auth.uid()
--     → Los mensajes de IA y asesor se insertan con createServiceClient()
--       en la API Route (ver api/chat/route.ts)
--   - UPDATE/DELETE: nunca desde cliente
-- ──────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "chat_isolation" ON chat_messages;

CREATE POLICY "chat_select" ON chat_messages
    FOR SELECT
    USING (organization_id = get_user_org_id());

CREATE POLICY "chat_insert_user_messages" ON chat_messages
    FOR INSERT
    WITH CHECK (
        organization_id = get_user_org_id()
        AND role = 'user'
        AND user_id = auth.uid()
    );

-- ──────────────────────────────────────────────────────────────
-- FIX CRÍTICO: ai_usage
--
-- Problema actual (FOR ALL):
--   - Un usuario puede hacer UPDATE { messages_used: 0 } para
--     resetear su contador y obtener acceso IA ilimitado sin pagar.
--   - Impacto directo en costos de OpenAI.
--
-- Política correcta:
--   - SELECT: el owner puede ver el uso del período (para mostrar en UI)
--   - INSERT/UPDATE: solo via función increment_ai_usage() (SECURITY DEFINER)
--   - DELETE: nunca
--
-- Nota: el member no necesita ver ai_usage, solo el owner en /cuenta
-- ──────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "ai_usage_isolation" ON ai_usage;

CREATE POLICY "ai_usage_select_owner" ON ai_usage
    FOR SELECT
    USING (
        organization_id = get_user_org_id()
        AND get_user_role() = 'owner'
    );

-- No hay política de INSERT/UPDATE/DELETE.
-- Todas las escrituras van por increment_ai_usage() que es SECURITY DEFINER.

-- ──────────────────────────────────────────────────────────────
-- FIX IMPORTANTE: escalations
--
-- Problema actual (FOR ALL):
--   - Un usuario puede UPDATE { status: 'resolved', response: 'OK' }
--     sin que un asesor real haya respondido
--   - Un usuario puede DELETE escalaciones (borrar evidencia)
--   - Un usuario puede INSERT escalaciones con status='resolved'
--     directamente, sin que pasen por la lógica de negocio
--
-- Política correcta:
--   - SELECT: todos los miembros (ver estado de sus escalaciones)
--   - INSERT/UPDATE/DELETE: solo vía API Routes con createServiceClient()
--     → /api/chat/route.ts usa service client para crear escalaciones
-- ──────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "escalations_isolation" ON escalations;

CREATE POLICY "escalations_select" ON escalations
    FOR SELECT
    USING (organization_id = get_user_org_id());

-- ──────────────────────────────────────────────────────────────
-- FIX IMPORTANTE: organization_obligations
--
-- Problema actual (FOR ALL):
--   - Un usuario puede INSERT obligaciones con status='done'
--     directamente, sin pasar por el onboarding
--   - Un usuario puede DELETE obligaciones (no hay audit trail)
--
-- Política correcta:
--   - SELECT: todos los miembros
--   - UPDATE: todos los miembros (actualizar status, notas, due_date)
--     → Esta es la operación legítima del usuario: marcar su progreso
--   - INSERT: solo vía /api/onboarding con createServiceClient()
--   - DELETE: nunca desde cliente
-- ──────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "obligations_isolation" ON organization_obligations;

CREATE POLICY "obligations_select" ON organization_obligations
    FOR SELECT
    USING (organization_id = get_user_org_id());

CREATE POLICY "obligations_update_status" ON organization_obligations
    FOR UPDATE
    USING (organization_id = get_user_org_id())
    WITH CHECK (organization_id = get_user_org_id());

-- ──────────────────────────────────────────────────────────────
-- FIX TRIGGER: handle_new_user — manejar invited_org_id inválido
--
-- Problema: si invited_org_id no existe en organizations, el INSERT
-- falla con FK violation → excepción no manejada → rollback de
-- auth.users INSERT → usuario huérfano que no puede registrarse.
--
-- Solución: validar que la org existe antes de insertar.
-- Si no existe, crear una org nueva como fallback seguro.
-- ──────────────────────────────────────────────────────────────

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

    -- Validar que la org referenciada existe antes de insertar
    IF invited_org_id IS NOT NULL THEN
        SELECT EXISTS(
            SELECT 1 FROM organizations WHERE id = invited_org_id
        ) INTO org_exists;

        IF NOT org_exists THEN
            -- La org fue eliminada entre la invitación y el registro.
            -- Fallback: tratar como registro normal para no bloquear al usuario.
            invited_org_id := NULL;
        END IF;
    END IF;

    IF invited_org_id IS NOT NULL THEN
        -- Usuario invitado a org existente
        INSERT INTO organization_members (organization_id, user_id, role, status)
        VALUES (invited_org_id, NEW.id, 'member', 'active')
        ON CONFLICT (organization_id, user_id) DO UPDATE SET status = 'active';
    ELSE
        -- Registro normal o fallback: crear org propia
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

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
