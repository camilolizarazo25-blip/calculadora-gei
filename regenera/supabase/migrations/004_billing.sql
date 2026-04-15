-- ============================================================
-- Regenera Platform — Billing v1.0
-- Agrega soporte para integración Wompi (pagos Colombia).
-- Aplicar DESPUÉS de 003_rls_hardening.sql
-- ============================================================

-- ──────────────────────────────────────────────────────────────
-- Campo wompi_reference
--
-- Referencia única que generamos al iniciar el checkout.
-- Se guarda ANTES del pago para poder identificar la suscripción
-- cuando llega el webhook de Wompi (idempotencia).
--
-- Formato: regen_{org_id_short}_{timestamp}
-- Ejemplo: regen_abc12345_1710000000000
-- ──────────────────────────────────────────────────────────────
ALTER TABLE subscriptions
    ADD COLUMN IF NOT EXISTS wompi_reference text UNIQUE;

-- ──────────────────────────────────────────────────────────────
-- Índice para lookup rápido del webhook
-- Wompi envía reference en el evento → debemos encontrar la sub
-- ──────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_subscriptions_wompi_ref
    ON subscriptions(wompi_reference)
    WHERE wompi_reference IS NOT NULL;

-- ──────────────────────────────────────────────────────────────
-- Normalizar status: 'inactive' → 'cancelled'
--
-- El schema actual permite ambos. Para simplificar el estado
-- de suscripción en el MVP usamos solo:
--   trialing / active / past_due / cancelled
-- 'inactive' queda disponible para migraciones futuras.
-- ──────────────────────────────────────────────────────────────
UPDATE subscriptions SET status = 'cancelled' WHERE status = 'inactive';
