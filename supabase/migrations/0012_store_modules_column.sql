-- ============================================================
-- 0012_store_modules_column.sql
-- Columna modules en stores + función apply_store_modules
-- Ejecutar después de 0011
-- ============================================================

begin;

-- 1. Agregar columna modules a stores
-- Guarda el array de módulos elegidos por el dueño en el wizard
alter table public.stores
  add column if not exists modules jsonb not null default '[]'::jsonb;

-- 2. Función apply_store_modules
-- Actualiza store_process_profiles según los módulos elegidos por el tenant
-- Se llama después de crear una tienda con módulos seleccionados
create or replace function public.apply_store_modules(
  p_store_id  text,
  p_tenant_id uuid,
  p_modules   jsonb  -- array json, ej: '["delivery","kitchen","inventory"]'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_modules text[] := array(
    select jsonb_array_elements_text(coalesce(p_modules, '[]'::jsonb))
  );
begin
  -- Guardar el array en la columna modules de stores
  update public.stores
  set modules   = coalesce(p_modules, '[]'::jsonb),
      updated_at = now()
  where id = p_store_id;

  -- Crear o actualizar store_process_profiles según módulos activos
  insert into public.store_process_profiles (
    store_id,
    tenant_id,
    branch_id,
    order_flow_type,
    catalog_mode,
    requires_preparation,
    requires_dispatch,
    enable_delivery,
    enable_pickup,
    module_products_enabled,
    module_combos_enabled,
    module_toppings_enabled,
    module_stock_enabled,
    module_coupons_enabled,
    module_loyalty_enabled,
    module_reviews_enabled,
    module_affiliates_enabled,
    module_chatbot_enabled,
    module_staff_enabled,
    module_finance_enabled,
    operational_notes
  )
  values (
    p_store_id,
    p_tenant_id,
    (
      select b.id from public.branches b
      where b.store_id = p_store_id
      order by b.is_primary desc nulls last, b.created_at asc nulls last
      limit 1
    ),
    -- order_flow_type: si tiene bookings = appointments
    case when 'bookings' = any(v_modules) then 'appointments' else 'standard' end,
    -- catalog_mode: si tiene bookings = services
    case when 'bookings' = any(v_modules) then 'services' else 'food' end,
    -- requires_preparation: si tiene kitchen
    'kitchen'   = any(v_modules),
    -- requires_dispatch: si tiene riders
    'riders'    = any(v_modules),
    -- enable_delivery: si tiene delivery
    'delivery'  = any(v_modules),
    -- enable_pickup
    'cashier'   = any(v_modules),
    -- products: siempre true (catálogo base)
    true,
    -- combos
    'delivery'  = any(v_modules),
    -- toppings
    'delivery'  = any(v_modules),
    -- stock / inventory
    'inventory' = any(v_modules),
    -- coupons: parte del módulo de fidelización o delivery
    'loyalty'   = any(v_modules) or 'delivery' = any(v_modules),
    -- loyalty
    'loyalty'   = any(v_modules),
    -- reviews
    'reviews'   = any(v_modules),
    -- affiliates
    'affiliates' = any(v_modules),
    -- chatbot
    'chatbot'   = any(v_modules),
    -- staff: siempre true (gestión de equipo)
    true,
    -- finance / cashier
    'cashier'   = any(v_modules),
    'Módulos elegidos por el dueño: ' || array_to_string(v_modules, ', ')
  )
  on conflict (store_id) do update set
    tenant_id               = excluded.tenant_id,
    order_flow_type         = excluded.order_flow_type,
    catalog_mode            = excluded.catalog_mode,
    requires_preparation    = excluded.requires_preparation,
    requires_dispatch       = excluded.requires_dispatch,
    enable_delivery         = excluded.enable_delivery,
    enable_pickup           = excluded.enable_pickup,
    module_products_enabled = excluded.module_products_enabled,
    module_combos_enabled   = excluded.module_combos_enabled,
    module_toppings_enabled = excluded.module_toppings_enabled,
    module_stock_enabled    = excluded.module_stock_enabled,
    module_coupons_enabled  = excluded.module_coupons_enabled,
    module_loyalty_enabled  = excluded.module_loyalty_enabled,
    module_reviews_enabled  = excluded.module_reviews_enabled,
    module_affiliates_enabled = excluded.module_affiliates_enabled,
    module_chatbot_enabled  = excluded.module_chatbot_enabled,
    module_staff_enabled    = excluded.module_staff_enabled,
    module_finance_enabled  = excluded.module_finance_enabled,
    updated_at              = now(),
    operational_notes       = excluded.operational_notes;

  return jsonb_build_object(
    'success',   true,
    'store_id',  p_store_id,
    'modules',   p_modules,
    'applied',   array_to_string(v_modules, ', ')
  );
end;
$$;

grant execute on function public.apply_store_modules(text, uuid, jsonb) to authenticated;

-- 3. Actualizar get_store_modules para leer TAMBIÉN de stores.modules
-- cuando store_process_profiles aún no exista
create or replace function public.get_store_modules(p_store_id text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with store_row as (
    select s.id,
           lower(coalesce(s.niche, '')) as niche,
           lower(coalesce(s.business_type, '')) as business_type,
           coalesce(s.modules, '[]'::jsonb) as wizard_modules
    from public.stores s
    where s.id = p_store_id
    limit 1
  ),
  profile as (
    select *
    from public.store_process_profiles
    where store_id = p_store_id
    limit 1
  ),
  -- Los módulos del wizard como texto[] para comparar
  wiz as (
    select array(select jsonb_array_elements_text((select wizard_modules from store_row))) as mods
  )
  select jsonb_build_object(
    'mod_catalog',      jsonb_build_object('enabled', coalesce((select module_products_enabled from profile), true), 'config', '{}'::jsonb),
    'mod_combos',       jsonb_build_object('enabled', coalesce((select module_combos_enabled   from profile), 'delivery' = any((select mods from wiz))), 'config', '{}'::jsonb),
    'mod_orders',       jsonb_build_object('enabled', coalesce((select enable_delivery          from profile), 'delivery' = any((select mods from wiz))),
                          'config', jsonb_build_object(
                            'requires_preparation', coalesce((select requires_preparation from profile), 'kitchen'  = any((select mods from wiz))),
                            'requires_dispatch',    coalesce((select requires_dispatch    from profile), 'riders'   = any((select mods from wiz)))
                          )),
    'mod_appointments', jsonb_build_object('enabled', coalesce((select order_flow_type = 'appointments' from profile), 'bookings' = any((select mods from wiz))), 'config', '{}'::jsonb),
    'mod_tables',       jsonb_build_object('enabled', coalesce((select niche = 'restaurant' from store_row), false), 'config', '{}'::jsonb),
    'mod_inventory',    jsonb_build_object('enabled', coalesce((select module_stock_enabled     from profile), 'inventory' = any((select mods from wiz))), 'config', '{}'::jsonb),
    'mod_staff',        jsonb_build_object('enabled', coalesce((select module_staff_enabled     from profile), true), 'config', '{}'::jsonb),
    'mod_loyalty',      jsonb_build_object('enabled', coalesce((select module_loyalty_enabled   from profile), 'loyalty'   = any((select mods from wiz))), 'config', '{}'::jsonb),
    'mod_affiliates',   jsonb_build_object('enabled', coalesce((select module_affiliates_enabled from profile),'affiliates'= any((select mods from wiz))), 'config', '{}'::jsonb),
    'mod_coupons',      jsonb_build_object('enabled', coalesce((select module_coupons_enabled   from profile), 'loyalty'   = any((select mods from wiz))), 'config', '{}'::jsonb),
    'mod_reviews',      jsonb_build_object('enabled', coalesce((select module_reviews_enabled   from profile), 'reviews'   = any((select mods from wiz))), 'config', '{}'::jsonb),
    'mod_finance',      jsonb_build_object('enabled', coalesce((select module_finance_enabled   from profile), 'cashier'   = any((select mods from wiz))), 'config', '{}'::jsonb),
    'mod_chatbot',      jsonb_build_object('enabled', coalesce((select module_chatbot_enabled   from profile), 'chatbot'   = any((select mods from wiz))), 'config', '{}'::jsonb),
    'mod_riders',       jsonb_build_object('enabled', coalesce((select requires_dispatch        from profile), 'riders'    = any((select mods from wiz))), 'config', '{}'::jsonb),
    'mod_kitchen',      jsonb_build_object('enabled', coalesce((select requires_preparation     from profile), 'kitchen'   = any((select mods from wiz))), 'config', '{}'::jsonb)
  );
$$;

-- Refrescar grants
grant execute on function public.get_store_modules(text) to authenticated, anon;

commit;
