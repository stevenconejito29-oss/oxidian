-- ============================================================
-- Prepare database for testing
-- Mirror de supabase/migrations/0005_testing_readiness.sql
-- Ejecutar despues de RESET_COMPLETE.sql
-- ============================================================

begin;

-- ------------------------------------------------------------
-- 1. Catalogo canonico de planes
-- ------------------------------------------------------------

create table if not exists public.store_plans (
  id             text primary key,
  name           text not null,
  description    text,
  color          text not null default '#2D6A4F',
  monthly_price  numeric(10,2) not null default 0,
  sort_order     integer not null default 0,
  feature_bundle jsonb not null default '{}'::jsonb,
  is_active      boolean not null default true,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

alter table public.store_plans add column if not exists description text;
alter table public.store_plans add column if not exists color text not null default '#2D6A4F';
alter table public.store_plans add column if not exists monthly_price numeric(10,2) not null default 0;
alter table public.store_plans add column if not exists sort_order integer not null default 0;
alter table public.store_plans add column if not exists feature_bundle jsonb not null default '{}'::jsonb;
alter table public.store_plans add column if not exists is_active boolean not null default true;
alter table public.store_plans add column if not exists created_at timestamptz not null default now();
alter table public.store_plans add column if not exists updated_at timestamptz not null default now();

do $$
declare
  has_feature_flags boolean := false;
begin
  if exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'saas_plans'
  ) then
    select exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'saas_plans'
        and column_name = 'feature_flags'
    ) into has_feature_flags;

    if has_feature_flags then
      execute $sql$
        insert into public.store_plans (
          id, name, monthly_price, feature_bundle, is_active, created_at, updated_at
        )
        select
          id,
          coalesce(name, initcap(id)),
          coalesce(monthly_price, 0),
          coalesce(feature_flags, '{}'::jsonb),
          coalesce(is_active, true),
          coalesce(created_at, now()),
          coalesce(updated_at, now())
        from public.saas_plans
        on conflict (id) do update
        set
          name = excluded.name,
          monthly_price = excluded.monthly_price,
          feature_bundle = excluded.feature_bundle,
          is_active = excluded.is_active,
          updated_at = now()
      $sql$;
    end if;
  end if;
end $$;

insert into public.store_plans (id, name, description, color, monthly_price, sort_order, feature_bundle, is_active)
values
  (
    'starter',
    'Starter',
    'Plan inicial para una sola tienda operando con modulos base.',
    '#334155',
    29,
    10,
    jsonb_build_object(
      'module_products_enabled', true,
      'module_combos_enabled', true,
      'module_toppings_enabled', true,
      'module_stock_enabled', true,
      'module_coupons_enabled', true,
      'module_loyalty_enabled', false,
      'module_reviews_enabled', true,
      'module_affiliates_enabled', false,
      'module_chatbot_enabled', false,
      'module_staff_enabled', true,
      'module_finance_enabled', true
    ),
    true
  ),
  (
    'growth',
    'Growth',
    'Plan recomendado para operar varias sedes con automatizacion comercial.',
    '#2D6A4F',
    79,
    20,
    jsonb_build_object(
      'module_products_enabled', true,
      'module_combos_enabled', true,
      'module_toppings_enabled', true,
      'module_stock_enabled', true,
      'module_coupons_enabled', true,
      'module_loyalty_enabled', true,
      'module_reviews_enabled', true,
      'module_affiliates_enabled', true,
      'module_chatbot_enabled', true,
      'module_staff_enabled', true,
      'module_finance_enabled', true
    ),
    true
  ),
  (
    'enterprise',
    'Enterprise',
    'Plan para operacion multi-sede con prioridad operativa y crecimiento avanzado.',
    '#7C3AED',
    199,
    30,
    jsonb_build_object(
      'module_products_enabled', true,
      'module_combos_enabled', true,
      'module_toppings_enabled', true,
      'module_stock_enabled', true,
      'module_coupons_enabled', true,
      'module_loyalty_enabled', true,
      'module_reviews_enabled', true,
      'module_affiliates_enabled', true,
      'module_chatbot_enabled', true,
      'module_staff_enabled', true,
      'module_finance_enabled', true,
      'priority_support', true,
      'multi_branch', true
    ),
    true
  )
on conflict (id) do update
set
  name = excluded.name,
  description = excluded.description,
  color = excluded.color,
  monthly_price = excluded.monthly_price,
  sort_order = excluded.sort_order,
  feature_bundle = excluded.feature_bundle,
  is_active = excluded.is_active,
  updated_at = now();

-- ------------------------------------------------------------
-- 2. Suscripciones por tenant
-- ------------------------------------------------------------

create table if not exists public.tenant_subscriptions (
  id                    uuid primary key default gen_random_uuid(),
  tenant_id             uuid not null references public.tenants(id) on delete cascade,
  plan_id               text not null references public.store_plans(id) on update cascade,
  status                text not null default 'active'
                          check (status in ('trialing','active','paused','past_due','canceled')),
  current_period_start  timestamptz not null default now(),
  current_period_end    timestamptz,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

alter table public.tenant_subscriptions add column if not exists tenant_id uuid references public.tenants(id) on delete cascade;
alter table public.tenant_subscriptions add column if not exists plan_id text;
alter table public.tenant_subscriptions add column if not exists status text not null default 'active';
alter table public.tenant_subscriptions add column if not exists current_period_start timestamptz not null default now();
alter table public.tenant_subscriptions add column if not exists current_period_end timestamptz;
alter table public.tenant_subscriptions add column if not exists created_at timestamptz not null default now();
alter table public.tenant_subscriptions add column if not exists updated_at timestamptz not null default now();

do $$
declare
  fk record;
begin
  for fk in
    select c.conname
    from pg_constraint c
    join pg_class t on t.oid = c.conrelid
    join pg_namespace n on n.oid = t.relnamespace
    where n.nspname = 'public'
      and t.relname = 'tenant_subscriptions'
      and c.contype = 'f'
      and pg_get_constraintdef(c.oid) like '%(plan_id)%'
  loop
    execute format('alter table public.tenant_subscriptions drop constraint if exists %I', fk.conname);
  end loop;
end $$;

alter table public.tenant_subscriptions
  add constraint tenant_subscriptions_plan_id_fkey
  foreign key (plan_id) references public.store_plans(id) on update cascade;

create unique index if not exists tenant_subscriptions_tenant_uidx
  on public.tenant_subscriptions(tenant_id);

create index if not exists tenant_subscriptions_plan_idx
  on public.tenant_subscriptions(plan_id);

update public.stores
set plan_id = 'growth'
where plan_id is null
   or btrim(plan_id) = ''
   or plan_id not in (select id from public.store_plans);

insert into public.tenant_subscriptions (
  tenant_id,
  plan_id,
  status,
  current_period_start,
  current_period_end
)
select
  t.id,
  'growth',
  'active',
  now(),
  now() + interval '30 days'
from public.tenants t
left join public.tenant_subscriptions ts on ts.tenant_id = t.id
where ts.tenant_id is null;

-- ------------------------------------------------------------
-- 3. Pipeline de landing y onboarding comercial
-- ------------------------------------------------------------

create table if not exists public.landing_requests (
  id              uuid primary key default gen_random_uuid(),
  full_name       text not null,
  email           text not null,
  phone           text,
  business_name   text,
  business_niche  text,
  city            text,
  source          text not null default 'landing',
  message         text,
  status          text not null default 'pending'
                    check (status in ('pending','contacted','demo_scheduled','onboarding','converted','rejected','ghosted')),
  contacted_at    timestamptz,
  converted_at    timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

alter table public.landing_requests add column if not exists full_name text;
alter table public.landing_requests add column if not exists email text;
alter table public.landing_requests add column if not exists phone text;
alter table public.landing_requests add column if not exists business_name text;
alter table public.landing_requests add column if not exists business_niche text;
alter table public.landing_requests add column if not exists city text;
alter table public.landing_requests add column if not exists source text not null default 'landing';
alter table public.landing_requests add column if not exists message text;
alter table public.landing_requests add column if not exists status text not null default 'pending';
alter table public.landing_requests add column if not exists contacted_at timestamptz;
alter table public.landing_requests add column if not exists converted_at timestamptz;
alter table public.landing_requests add column if not exists created_at timestamptz not null default now();
alter table public.landing_requests add column if not exists updated_at timestamptz not null default now();

create index if not exists landing_requests_status_idx
  on public.landing_requests(status, created_at desc);

create index if not exists landing_requests_email_idx
  on public.landing_requests(lower(email));

-- ------------------------------------------------------------
-- 4. Backfills estructurales necesarios para login y vistas
-- ------------------------------------------------------------

update public.stores
set slug = id
where slug is null or btrim(slug) = '';

update public.branches
set slug = lower(regexp_replace('branch-' || substr(id::text, 1, 8), '[^a-z0-9-]+', '-', 'g'))
where slug is null or btrim(slug) = '';

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
select
  s.id,
  s.tenant_id,
  (
    select b.id
    from public.branches b
    where b.store_id = s.id
    order by b.is_primary desc nulls last, b.created_at asc nulls last
    limit 1
  ),
  'standard',
  case
    when lower(coalesce(s.niche, '')) in ('barbershop', 'beauty', 'salon', 'spa') then 'services'
    when lower(coalesce(s.niche, '')) in ('clothing', 'fashion', 'ropa', 'moda') then 'retail'
    else 'food'
  end,
  case when lower(coalesce(s.niche, '')) in ('barbershop', 'beauty', 'salon', 'spa') then false else true end,
  case when lower(coalesce(s.niche, '')) in ('barbershop', 'beauty', 'salon', 'spa') then false else true end,
  case when lower(coalesce(s.niche, '')) in ('barbershop', 'beauty', 'salon', 'spa') then false else true end,
  false,
  true,
  true,
  true,
  true,
  true,
  true,
  true,
  true,
  true,
  true,
  true,
  'Perfil operativo canonico creado por prepare_database_for_testing.sql'
from public.stores s
left join public.store_process_profiles p on p.store_id = s.id
where p.store_id is null;

-- ------------------------------------------------------------
-- 5. RPCs canonicas usadas por el frontend
-- ------------------------------------------------------------

create or replace function public.get_store_modules(p_store_id text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with store_row as (
    select s.id, lower(coalesce(s.niche, '')) as niche, lower(coalesce(s.business_type, '')) as business_type
    from public.stores s
    where s.id = p_store_id
    limit 1
  ),
  profile as (
    select *
    from public.store_process_profiles
    where store_id = p_store_id
    limit 1
  )
  select jsonb_build_object(
    'mod_catalog',      jsonb_build_object('enabled', coalesce((select module_products_enabled from profile), true), 'config', jsonb_build_object()),
    'mod_combos',       jsonb_build_object('enabled', coalesce((select module_combos_enabled from profile), true), 'config', jsonb_build_object()),
    'mod_orders',       jsonb_build_object(
                          'enabled', true,
                          'config', jsonb_build_object(
                            'requires_preparation', coalesce((select requires_preparation from profile), true),
                            'requires_dispatch', coalesce((select requires_dispatch from profile), true)
                          )
                        ),
    'mod_appointments', jsonb_build_object(
                          'enabled',
                          coalesce((select niche in ('barbershop', 'beauty', 'salon', 'spa') from store_row), false),
                          'config',
                          jsonb_build_object()
                        ),
    'mod_tables',       jsonb_build_object(
                          'enabled',
                          coalesce((select niche = 'restaurant' from store_row), false),
                          'config',
                          jsonb_build_object()
                        ),
    'mod_inventory',    jsonb_build_object('enabled', coalesce((select module_stock_enabled from profile), true), 'config', jsonb_build_object()),
    'mod_variants',     jsonb_build_object(
                          'enabled',
                          coalesce((select niche in ('clothing', 'fashion', 'ropa', 'moda') from store_row), false),
                          'config',
                          jsonb_build_object()
                        ),
    'mod_staff',        jsonb_build_object('enabled', coalesce((select module_staff_enabled from profile), true), 'config', jsonb_build_object()),
    'mod_loyalty',      jsonb_build_object('enabled', coalesce((select module_loyalty_enabled from profile), true), 'config', jsonb_build_object()),
    'mod_affiliates',   jsonb_build_object('enabled', coalesce((select module_affiliates_enabled from profile), true), 'config', jsonb_build_object()),
    'mod_coupons',      jsonb_build_object('enabled', coalesce((select module_coupons_enabled from profile), true), 'config', jsonb_build_object()),
    'mod_reviews',      jsonb_build_object('enabled', coalesce((select module_reviews_enabled from profile), true), 'config', jsonb_build_object()),
    'mod_finance',      jsonb_build_object('enabled', coalesce((select module_finance_enabled from profile), true), 'config', jsonb_build_object()),
    'mod_chatbot',      jsonb_build_object('enabled', coalesce((select module_chatbot_enabled from profile), true), 'config', jsonb_build_object())
  );
$$;

grant execute on function public.get_store_modules(text) to authenticated;

create or replace function public.get_store_features(p_store_id text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with store_row as (
    select id, tenant_id, plan_id
    from public.stores
    where id = p_store_id
    limit 1
  ),
  subscription_row as (
    select ts.plan_id
    from public.tenant_subscriptions ts
    join store_row s on s.tenant_id = ts.tenant_id
    where ts.status in ('trialing', 'active')
    order by ts.updated_at desc nulls last, ts.created_at desc nulls last
    limit 1
  ),
  plan_row as (
    select p.feature_bundle
    from public.store_plans p
    where p.id = coalesce((select plan_id from subscription_row), (select plan_id from store_row), 'growth')
    limit 1
  ),
  profile as (
    select *
    from public.store_process_profiles
    where store_id = p_store_id
    limit 1
  )
  select coalesce((select feature_bundle from plan_row), '{}'::jsonb) || jsonb_build_object(
    'module_products_enabled',   coalesce((select module_products_enabled from profile), true),
    'module_combos_enabled',     coalesce((select module_combos_enabled from profile), true),
    'module_toppings_enabled',   coalesce((select module_toppings_enabled from profile), true),
    'module_stock_enabled',      coalesce((select module_stock_enabled from profile), true),
    'module_coupons_enabled',    coalesce((select module_coupons_enabled from profile), true),
    'module_loyalty_enabled',    coalesce((select module_loyalty_enabled from profile), true),
    'module_reviews_enabled',    coalesce((select module_reviews_enabled from profile), true),
    'module_affiliates_enabled', coalesce((select module_affiliates_enabled from profile), true),
    'module_chatbot_enabled',    coalesce((select module_chatbot_enabled from profile), true),
    'module_staff_enabled',      coalesce((select module_staff_enabled from profile), true),
    'module_finance_enabled',    coalesce((select module_finance_enabled from profile), true)
  );
$$;

grant execute on function public.get_store_features(text) to authenticated;

create or replace function public.apply_niche_preset(
  p_store_id text,
  p_tenant_id uuid,
  p_niche_id text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_niche text := lower(coalesce(nullif(trim(p_niche_id), ''), 'universal'));
  v_requires_preparation boolean := true;
  v_requires_dispatch boolean := true;
  v_enable_delivery boolean := true;
  v_catalog_mode text := 'food';
  v_order_flow_type text := 'standard';
begin
  if v_niche in ('barbershop', 'beauty', 'salon', 'spa') then
    v_requires_preparation := false;
    v_requires_dispatch := false;
    v_enable_delivery := false;
    v_catalog_mode := 'services';
    v_order_flow_type := 'appointments';
  elsif v_niche in ('clothing', 'fashion', 'ropa', 'moda') then
    v_catalog_mode := 'retail';
    v_requires_dispatch := false;
  elsif v_niche = 'restaurant' then
    v_catalog_mode := 'restaurant';
  end if;

  update public.stores
  set niche = v_niche,
      tenant_id = coalesce(p_tenant_id, tenant_id),
      updated_at = now()
  where id = p_store_id;

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
    operational_notes
  )
  values (
    p_store_id,
    p_tenant_id,
    (
      select b.id
      from public.branches b
      where b.store_id = p_store_id
      order by b.is_primary desc nulls last, b.created_at asc nulls last
      limit 1
    ),
    v_order_flow_type,
    v_catalog_mode,
    v_requires_preparation,
    v_requires_dispatch,
    v_enable_delivery,
    false,
    'Preset canonico aplicado para niche=' || v_niche
  )
  on conflict (store_id) do update
  set tenant_id = excluded.tenant_id,
      order_flow_type = excluded.order_flow_type,
      catalog_mode = excluded.catalog_mode,
      requires_preparation = excluded.requires_preparation,
      requires_dispatch = excluded.requires_dispatch,
      enable_delivery = excluded.enable_delivery,
      updated_at = now(),
      operational_notes = excluded.operational_notes;

  return jsonb_build_object(
    'success', true,
    'store_id', p_store_id,
    'tenant_id', p_tenant_id,
    'niche_id', v_niche
  );
end;
$$;

grant execute on function public.apply_niche_preset(text, uuid, text) to authenticated;

-- ------------------------------------------------------------
-- 6. Grants y RLS
-- ------------------------------------------------------------

grant select on public.store_plans to anon, authenticated;
grant select, insert, update on public.tenant_subscriptions to authenticated;
grant insert on public.landing_requests to anon, authenticated;
grant select, update, delete on public.landing_requests to authenticated;

alter table public.store_plans enable row level security;
alter table public.tenant_subscriptions enable row level security;
alter table public.landing_requests enable row level security;

drop policy if exists store_plans_public_read on public.store_plans;
create policy store_plans_public_read on public.store_plans
  for select to anon, authenticated
  using (is_active = true or public.is_super_admin());

drop policy if exists store_plans_super_admin on public.store_plans;
create policy store_plans_super_admin on public.store_plans
  for all to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());

drop policy if exists tenant_subscriptions_super_admin_all on public.tenant_subscriptions;
create policy tenant_subscriptions_super_admin_all on public.tenant_subscriptions
  for all to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());

drop policy if exists tenant_subscriptions_tenant_scope_read on public.tenant_subscriptions;
create policy tenant_subscriptions_tenant_scope_read on public.tenant_subscriptions
  for select to authenticated
  using (
    public.is_super_admin()
    or public.current_request_tenant_id() = tenant_id
    or exists (
      select 1
      from public.user_memberships m
      where m.user_id = auth.uid()
        and m.is_active
        and m.tenant_id = tenant_subscriptions.tenant_id
        and m.role in ('tenant_owner', 'tenant_admin')
    )
  );

drop policy if exists tenant_subscriptions_tenant_scope_insert on public.tenant_subscriptions;
create policy tenant_subscriptions_tenant_scope_insert on public.tenant_subscriptions
  for insert to authenticated
  with check (
    public.is_super_admin()
    or exists (
      select 1
      from public.user_memberships m
      where m.user_id = auth.uid()
        and m.is_active
        and m.tenant_id = tenant_subscriptions.tenant_id
        and m.role in ('tenant_owner', 'tenant_admin')
    )
  );

drop policy if exists tenants_owner_self_insert on public.tenants;
create policy tenants_owner_self_insert on public.tenants
  for insert to authenticated
  with check (
    coalesce(lower(owner_email), '') = coalesce(lower(auth.jwt() ->> 'email'), '')
  );

drop policy if exists landing_requests_public_insert on public.landing_requests;
create policy landing_requests_public_insert on public.landing_requests
  for insert to anon, authenticated
  with check (true);

drop policy if exists landing_requests_super_admin_all on public.landing_requests;
create policy landing_requests_super_admin_all on public.landing_requests
  for all to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());

drop table if exists public.saas_plans cascade;

commit;
