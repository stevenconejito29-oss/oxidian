-- ============================================================
-- MIGRACIÓN 0010: Backfill tenant_subscriptions
-- Ejecutar en Supabase SQL Editor UNA sola vez.
--
-- Propósito:
--   El error "Could not find the 'plan_id' column of 'tenants'"
--   ocurría porque plan_id vive en tenant_subscriptions, no en tenants.
--   Esta migración asegura que TODOS los tenants existentes tengan
--   al menos un registro en tenant_subscriptions, para que el JOIN
--   del backend nunca devuelva plan_id = NULL.
-- ============================================================

-- 1. Insertar suscripción 'starter' para tenants sin plan asignado
INSERT INTO public.tenant_subscriptions (tenant_id, plan_id, status, current_period_end)
SELECT
  t.id,
  'starter',
  'active',
  now() + interval '999 years'
FROM public.tenants t
WHERE NOT EXISTS (
  SELECT 1 FROM public.tenant_subscriptions ts WHERE ts.tenant_id = t.id
)
ON CONFLICT DO NOTHING;

-- 2. Verificar resultado — deberías ver un plan_id por cada tenant
SELECT
  t.name          AS tenant_name,
  t.status        AS tenant_status,
  ts.plan_id,
  ts.status       AS subscription_status
FROM public.tenants t
LEFT JOIN public.tenant_subscriptions ts ON ts.tenant_id = t.id
ORDER BY t.created_at DESC;
