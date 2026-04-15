-- ============================================================
-- Regenera Platform — Schema inicial v1.1
-- Ejecutar en: Supabase Dashboard → SQL Editor
-- ============================================================

-- ── Extensiones ──────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ── Planes de suscripción ─────────────────────────────────────
CREATE TABLE subscription_plans (
    id text PRIMARY KEY,
    name text NOT NULL,
    price_cop integer NOT NULL,
    max_users integer NOT NULL,
    ai_messages_per_month integer NOT NULL,
    ai_max_tokens_per_message integer NOT NULL,
    ai_context_messages integer NOT NULL,
    response_time_hours integer NOT NULL,
    features jsonb NOT NULL DEFAULT '{}'
);

INSERT INTO subscription_plans VALUES
('trial',        'Trial',        0,       1, 15,  2000, 3,  24, '{"docs": false, "whatsapp": false}'),
('basic',        'Básico',       89900,   1, 30,  2000, 5,  12, '{"docs": "basic", "whatsapp": false}'),
('professional', 'Profesional',  189900,  2, 100, 4000, 15, 4,  '{"docs": "all", "whatsapp": true}');

-- ── Organizaciones ────────────────────────────────────────────
-- NOTA: El estado de suscripción NO vive aquí. Leerlo siempre desde
-- subscriptions.status (fuente de verdad única). Ver migración 002.
CREATE TABLE organizations (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL DEFAULT '',
    nit text,                          -- nullable: se completa en onboarding
    sector text                        -- nullable: se completa en onboarding
        CHECK (sector IS NULL OR sector IN (
            'manufactura','alimentos','servicios','construccion',
            'salud','comercio','educacion','otro'
        )),
    city text,                         -- nullable: se completa en onboarding
    department text,                   -- nullable: se completa en onboarding
    employee_count text                -- nullable: se completa en onboarding
        CHECK (employee_count IS NULL OR employee_count IN (
            '1-10','11-50','51-200','200+'
        )),
    profile jsonb,                     -- OrgProfile completo tras onboarding
    onboarding_completed_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now()
);

-- ── Miembros de organización ──────────────────────────────────
CREATE TABLE organization_members (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role text NOT NULL DEFAULT 'member'
        CHECK (role IN ('owner', 'member')),
    status text NOT NULL DEFAULT 'active'
        CHECK (status IN ('active', 'pending', 'removed')),
    invited_by uuid REFERENCES auth.users(id),
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE(organization_id, user_id)
);

CREATE INDEX idx_org_members_user ON organization_members(user_id, status);
CREATE INDEX idx_org_members_org ON organization_members(organization_id, status);

-- ── Suscripciones ─────────────────────────────────────────────
-- Una suscripción por organización (UNIQUE). Wompi, no Stripe.
CREATE TABLE subscriptions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    plan_id text NOT NULL REFERENCES subscription_plans(id),
    status text NOT NULL DEFAULT 'trialing'
        CHECK (status IN ('trialing','active','past_due','inactive','cancelled')),
    trial_ends_at timestamptz,
    current_period_start timestamptz NOT NULL DEFAULT now(),
    current_period_end timestamptz NOT NULL DEFAULT (now() + interval '14 days'),
    wompi_transaction_id text,         -- ID de la transacción en Wompi
    amount_cop integer,                -- Valor pagado en pesos colombianos
    payment_method text
        CHECK (payment_method IS NULL OR payment_method IN ('pse','card','nequi','daviplata')),
    cancelled_at timestamptz,
    UNIQUE(organization_id)
);

-- ── Plantillas de obligaciones (catálogo Regenera) ────────────
CREATE TABLE obligation_templates (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    code text UNIQUE NOT NULL,
    title text NOT NULL,
    description text NOT NULL DEFAULT '',
    authority text NOT NULL,
    frequency text NOT NULL
        CHECK (frequency IN ('annual','quarterly','biannual','monthly','event')),
    applicable_sectors text[] NOT NULL DEFAULT '{}',
    applicable_if jsonb,               -- Condiciones adicionales para evolución futura
    regulation_reference text,
    priority text NOT NULL DEFAULT 'medium'
        CHECK (priority IN ('high','medium','low')),
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now()
);

-- Datos semilla — obligaciones más comunes en Colombia
-- Fuente: Decreto 1076/2015 (MADS), Resolución 1362/2007 (RESPEL), Ley 99/1993
INSERT INTO obligation_templates (code, title, description, authority, frequency, applicable_sectors, priority) VALUES
('PGIRSR-REGISTRO',
 'Plan de Gestión Integral de Residuos Sólidos',
 'Registro y seguimiento del manejo de residuos sólidos generados. Base: Decreto 1077/2015.',
 'Municipio / Autoridad Ambiental', 'annual',
 ARRAY['manufactura','alimentos','servicios','construccion','salud','comercio','educacion','otro'],
 'medium'),

('RUA-ANUAL',
 'Registro Único Ambiental (RUA)',
 'Reporte anual de información ambiental para el sector manufacturero. Resolución 1023/2010 IDEAM. Vence 31 de marzo.',
 'IDEAM', 'annual',
 ARRAY['manufactura','alimentos'],
 'high'),

('RESPEL-REGISTRO',
 'Registro como Generador de Residuos Peligrosos',
 'Inscripción obligatoria ante la autoridad ambiental regional. Resolución 1362/2007 MAVDT.',
 'Autoridad Ambiental Regional', 'event',
 ARRAY['manufactura','alimentos','servicios','construccion','salud','comercio','educacion','otro'],
 'high'),

('RESPEL-INFORME-ANUAL',
 'Informe Anual de Residuos Peligrosos',
 'Reporte anual del inventario y manejo de RESPEL generados. Resolución 1362/2007.',
 'IDEAM', 'annual',
 ARRAY['manufactura','alimentos','servicios','construccion','salud','comercio','educacion','otro'],
 'high'),

('RESPEL-MOVIMIENTO',
 'Manifiesto de Almacenamiento y Transporte RESPEL',
 'Documento de seguimiento (cadena de custodia) para RESPEL. Decreto 1076/2015 Art. 2.2.6.1.3.3.',
 'Autoridad Ambiental Regional', 'event',
 ARRAY['manufactura','alimentos','servicios','construccion','salud','comercio','educacion','otro'],
 'high'),

('EMISIONES-PERMISO',
 'Permiso de Emisiones Atmosféricas',
 'Permiso para descarga de contaminantes al aire por fuentes fijas. Resolución 619/1997 MADS.',
 'Autoridad Ambiental Regional', 'event',
 ARRAY['manufactura','alimentos','construccion'],
 'high'),

('EMISIONES-REPORTE',
 'Reporte de Monitoreo de Emisiones Atmosféricas',
 'Reporte periódico de resultados de monitoreo a la autoridad ambiental competente.',
 'Autoridad Ambiental Regional', 'annual',
 ARRAY['manufactura','alimentos','construccion'],
 'medium'),

('VERTIMIENTOS-PERMISO',
 'Permiso de Vertimientos',
 'Permiso para vertimiento de aguas residuales. Decreto 3930/2010, incorporado en Decreto 1076/2015.',
 'Autoridad Ambiental Regional', 'event',
 ARRAY['manufactura','alimentos','construccion','salud'],
 'high'),

('VERTIMIENTOS-TASA-RETRIBUTIVA',
 'Pago Tasa Retributiva por Vertimientos',
 'Cobro económico por uso del recurso hídrico como receptor. Decreto 2667/2012.',
 'Autoridad Ambiental Regional', 'quarterly',
 ARRAY['manufactura','alimentos','construccion','salud'],
 'medium'),

('PMA-CONSTRUCCION',
 'Plan de Manejo Ambiental para Obras',
 'Documento de gestión ambiental requerido antes de iniciar obras de construcción.',
 'Autoridad Ambiental Regional', 'event',
 ARRAY['construccion'],
 'high'),

('ESCOMBROS-MANEJO',
 'Gestión y Disposición de Residuos de Construcción (RCDs)',
 'Manejo adecuado de escombros y residuos de demolición. Resolución 472/2017 MADS.',
 'Municipio', 'event',
 ARRAY['construccion'],
 'medium'),

('MATRIZ-LEGAL-AMBIENTAL',
 'Matriz de Requisitos Legales Ambientales',
 'Identificación, seguimiento y cumplimiento de obligaciones legales aplicables. Recomendada en SG-SST.',
 'Interno', 'annual',
 ARRAY['manufactura','alimentos','servicios','construccion','salud','comercio','educacion','otro'],
 'medium');

-- ── Obligaciones por organización ─────────────────────────────
CREATE TABLE organization_obligations (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    template_id uuid NOT NULL REFERENCES obligation_templates(id),
    status text NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending','in_progress','done','not_applicable')),
    due_date date,
    completed_at timestamptz,
    notes text,
    is_custom boolean NOT NULL DEFAULT false,
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE(organization_id, template_id)
);

CREATE INDEX idx_obligations_org_status ON organization_obligations(organization_id, status);
CREATE INDEX idx_obligations_due_date ON organization_obligations(due_date) WHERE status != 'done';

-- ── Mensajes de chat ──────────────────────────────────────────
CREATE TABLE chat_messages (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id uuid REFERENCES auth.users(id),
    role text NOT NULL
        CHECK (role IN ('user','assistant','human_agent')),
    content text NOT NULL,
    escalation_id uuid,                -- FK se agrega tras crear tabla escalations
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_chat_org_date ON chat_messages(organization_id, created_at DESC);

-- ── Escalaciones ──────────────────────────────────────────────
CREATE TABLE escalations (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    triggered_by uuid NOT NULL REFERENCES auth.users(id),
    user_question text NOT NULL,
    reason text NOT NULL
        CHECK (reason IN ('ai_low_confidence','user_requested','limit_reached')),
    chat_session_context jsonb NOT NULL DEFAULT '[]',
    status text NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending','in_progress','resolved')),
    assigned_to text,                  -- email del consultor de Regenera
    response text,
    response_at timestamptz,
    resolved_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now()
);

-- Índice compuesto: el panel admin filtra por status y fecha
CREATE INDEX idx_escalations_org_status ON escalations(organization_id, status, created_at DESC);
-- Índice para la vista admin de Regenera (todas las pendientes sin filtro de org)
CREATE INDEX idx_escalations_pending ON escalations(status, created_at DESC) WHERE status = 'pending';

-- Agregar FK de chat_messages → escalations
ALTER TABLE chat_messages
    ADD CONSTRAINT fk_chat_escalation
    FOREIGN KEY (escalation_id) REFERENCES escalations(id);

-- ── Uso de IA ─────────────────────────────────────────────────
CREATE TABLE ai_usage (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id uuid REFERENCES auth.users(id),   -- nullable: control es por org, no por usuario
    period_start date NOT NULL,
    period_end date NOT NULL,
    messages_used integer NOT NULL DEFAULT 0 CHECK (messages_used >= 0),
    tokens_used integer NOT NULL DEFAULT 0 CHECK (tokens_used >= 0),
    last_message_at timestamptz,
    UNIQUE(organization_id, period_start)
);

-- ── Función: incrementar uso de IA (upsert atómico) ──────────
-- SECURITY DEFINER para que RLS no interfiera con el upsert interno
CREATE OR REPLACE FUNCTION increment_ai_usage(
    p_organization_id uuid,
    p_user_id uuid,
    p_period_start date,
    p_period_end date,
    p_tokens integer
) RETURNS void AS $$
BEGIN
    INSERT INTO ai_usage
        (organization_id, user_id, period_start, period_end, messages_used, tokens_used, last_message_at)
    VALUES
        (p_organization_id, p_user_id, p_period_start, p_period_end, 1, p_tokens, now())
    ON CONFLICT (organization_id, period_start)
    DO UPDATE SET
        messages_used  = ai_usage.messages_used + 1,
        tokens_used    = ai_usage.tokens_used + p_tokens,
        last_message_at = now();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ── Trigger: al registrarse → crear org + membresía + suscripción trial ──
-- NOTA: si el usuario fue invitado (raw_user_meta_data contiene organization_id),
-- debe asociarse a la org existente en lugar de crear una nueva.
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger AS $$
DECLARE
    new_org_id uuid;
    invited_org_id uuid;
BEGIN
    -- Solo leer organization_id de metadata si es una invitación real
    -- (invited_at NOT NULL indica que fue generada por auth.admin.inviteUserByEmail)
    IF NEW.invited_at IS NOT NULL THEN
        invited_org_id := (NEW.raw_user_meta_data->>'organization_id')::uuid;
    END IF;

    IF invited_org_id IS NOT NULL THEN
        -- Usuario invitado → asociar a org existente
        INSERT INTO organization_members (organization_id, user_id, role, status)
        VALUES (
            invited_org_id,
            NEW.id,
            'member',
            'active'
        )
        ON CONFLICT (organization_id, user_id) DO UPDATE SET status = 'active';
    ELSE
        -- Usuario nuevo → crear organización propia
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

CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ── Row Level Security ────────────────────────────────────────
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_obligations ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE escalations ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE obligation_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscription_plans ENABLE ROW LEVEL SECURITY;

-- Función helper: obtener org_id del usuario activo
-- SECURITY DEFINER para que RLS no llame recursivamente sobre organization_members
CREATE OR REPLACE FUNCTION get_user_org_id()
RETURNS uuid AS $$
    SELECT organization_id
    FROM organization_members
    WHERE user_id = auth.uid() AND status = 'active'
    LIMIT 1;
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- Políticas de aislamiento por organización
CREATE POLICY "org_isolation" ON organizations
    FOR ALL USING (id = get_user_org_id());

CREATE POLICY "members_isolation" ON organization_members
    FOR ALL USING (organization_id = get_user_org_id());

-- subscriptions: solo SELECT para usuarios — INSERT/UPDATE vía service role (webhook Wompi)
CREATE POLICY "subscriptions_select" ON subscriptions
    FOR SELECT USING (organization_id = get_user_org_id());

CREATE POLICY "obligations_isolation" ON organization_obligations
    FOR ALL USING (organization_id = get_user_org_id());

CREATE POLICY "chat_isolation" ON chat_messages
    FOR ALL USING (organization_id = get_user_org_id());

CREATE POLICY "escalations_isolation" ON escalations
    FOR ALL USING (organization_id = get_user_org_id());

CREATE POLICY "ai_usage_isolation" ON ai_usage
    FOR ALL USING (organization_id = get_user_org_id());

-- Plantillas y planes son públicos de solo lectura para usuarios autenticados
-- Nota: auth.uid() IS NOT NULL es la forma correcta en Supabase moderno
-- (auth.role() = 'authenticated' está deprecado desde Supabase v2.x)
CREATE POLICY "templates_read_authenticated" ON obligation_templates
    FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "plans_read_public" ON subscription_plans
    FOR SELECT USING (true);
