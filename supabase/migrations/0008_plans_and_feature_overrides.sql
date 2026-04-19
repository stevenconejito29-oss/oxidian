-- ============================================================
-- MIGRACIÓN 0008: Sistema de planes con feature overrides
-- Ejecutar en Supabase SQL Editor
-- ============================================================

-- 1. Añadir columna feature_overrides a tenant_subscriptions
ALTER TABLE public.tenant_subscriptions
  ADD COLUMN IF NOT EXISTS feature_overrides  jsonb NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS stores_limit       integer,
  ADD COLUMN IF NOT EXISTS branches_limit     integer,
  ADD COLUMN IF NOT EXISTS staff_limit        integer,
  ADD COLUMN IF NOT EXISTS notes              text;

-- 2. Insertar planes por defecto en store_plans (actualizar si existen)
INSERT INTO public.store_plans (id, name, description, monthly_price, sort_order, feature_bundle, is_active)
VALUES
  ('starter',    'Starter',    'Una tienda, funciones esenciales',           0,   0,
   '{"max_stores":1,"max_branches":1,"max_staff":3,"max_products":30,"menu_public":true,"orders":true,"kitchen_panel":true}'::jsonb,
   true),
  ('growth',     'Growth',     'Chatbot, marketing y múltiples sedes',       49,  1,
   '{"max_stores":3,"max_branches":3,"max_staff":10,"max_products":200,"menu_public":true,"menu_custom_style":true,"orders":true,"orders_realtime":true,"kitchen_panel":true,"riders_panel":true,"coupons":true,"reviews":true,"chatbot_basic":true,"chatbot_portable":true,"analytics_basic":true}'::jsonb,
   true),
  ('pro',        'Pro',        'IA, afiliados, analytics completo',          99,  2,
   '{"max_stores":10,"max_branches":10,"max_staff":50,"max_products":1000,"menu_public":true,"menu_custom_style":true,"menu_custom_theme":true,"orders":true,"orders_realtime":true,"kitchen_panel":true,"riders_panel":true,"coupons":true,"loyalty":true,"affiliates":true,"reviews":true,"chatbot_basic":true,"chatbot_ai":true,"chatbot_portable":true,"analytics_basic":true,"analytics_full":true,"stock":true,"finance":true}'::jsonb,
   true),
  ('enterprise', 'Enterprise', 'Sin límites para grandes operaciones',       299, 3,
   '{"max_stores":-1,"max_branches":-1,"max_staff":-1,"max_products":-1,"everything":true}'::jsonb,
   true)
ON CONFLICT (id) DO UPDATE SET
  name = excluded.name,
  description = excluded.description,
  monthly_price = excluded.monthly_price,
  feature_bundle = excluded.feature_bundle,
  updated_at = now();

-- 3. Vista de control de planes por tenant (para super admin)
CREATE OR REPLACE VIEW public.v_tenant_plan_status AS
SELECT
  t.id           AS tenant_id,
  t.name         AS tenant_name,
  t.owner_email,
  t.status       AS tenant_status,
  ts.plan_id,
  ts.status      AS subscription_status,
  ts.current_period_end,
  ts.feature_overrides,
  ts.notes       AS plan_notes,
  sp.monthly_price,
  (SELECT count(*) FROM public.stores s WHERE s.tenant_id = t.id) AS store_count,
  (SELECT count(*) FROM public.branches b
     JOIN public.stores s ON s.id = b.store_id
     WHERE s.tenant_id = t.id)                                    AS branch_count,
  (SELECT count(*) FROM public.user_memberships m
     WHERE m.tenant_id = t.id AND m.is_active = true
     AND m.role NOT IN ('tenant_owner','tenant_admin'))            AS staff_count
FROM public.tenants t
LEFT JOIN public.tenant_subscriptions ts ON ts.tenant_id = t.id
LEFT JOIN public.store_plans sp ON sp.id = ts.plan_id
ORDER BY t.created_at DESC;

-- 4. Función para cambiar plan de un tenant (solo super admin)
CREATE OR REPLACE FUNCTION public.change_tenant_plan(
  p_tenant_id   uuid,
  p_plan_id     text,
  p_overrides   jsonb DEFAULT '{}',
  p_notes       text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Solo el Super Admin puede cambiar planes';
  END IF;

  INSERT INTO public.tenant_subscriptions
    (tenant_id, plan_id, status, feature_overrides, notes,
     current_period_end, updated_at)
  VALUES
    (p_tenant_id, p_plan_id, 'active', p_overrides, p_notes,
     now() + interval '30 days', now())
  ON CONFLICT (tenant_id) DO UPDATE SET
    plan_id          = excluded.plan_id,
    status           = excluded.status,
    feature_overrides = excluded.feature_overrides,
    notes            = excluded.notes,
    current_period_end = excluded.current_period_end,
    updated_at       = now();

  RETURN jsonb_build_object(
    'success', true,
    'tenant_id', p_tenant_id,
    'plan_id', p_plan_id
  );
END;
$$;

-- Verificar
SELECT id, name, monthly_price FROM public.store_plans ORDER BY sort_order;
