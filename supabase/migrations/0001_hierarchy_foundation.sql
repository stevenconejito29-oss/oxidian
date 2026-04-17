-- ============================================================
-- OXIDIAN SAAS
-- Base jerarquica inicial: super_admin -> tenant -> store -> branch
-- Fase 1: compatibilidad con la base actual y RLS por alcance
-- ============================================================

begin;

create extension if not exists pgcrypto;

do $$
begin
  create type public.app_role as enum (
    'super_admin',
    'tenant_owner',
    'tenant_admin',
    'store_admin',
    'store_operator',
    'branch_manager',
    'kitchen',
    'rider',
    'cashier'
  );
exception
  when duplicate_object then null;
end $$;

create table if not exists public.tenants (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  owner_name text,
  owner_email text unique,
  owner_phone text,
  billing_email text,
  status text not null default 'active',
  monthly_fee numeric(10,2) not null default 0,
  notes text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint tenants_status_check check (status in ('active', 'suspended', 'archived'))
);

create table if not exists public.store_templates (
  id text primary key,
  name text not null,
  category text not null,
  react_module_key text not null,
  description text,
  default_theme jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

alter table public.stores
  add column if not exists tenant_id uuid,
  add column if not exists template_id text,
  add column if not exists theme_tokens jsonb not null default '{}'::jsonb,
  add column if not exists branch_mode text not null default 'single',
  add column if not exists public_visible boolean not null default true;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'stores_tenant_id_fkey'
  ) then
    alter table public.stores
      add constraint stores_tenant_id_fkey
      foreign key (tenant_id) references public.tenants(id) on delete cascade;
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'stores_template_id_fkey'
  ) then
    alter table public.stores
      add constraint stores_template_id_fkey
      foreign key (template_id) references public.store_templates(id) on update cascade;
  end if;
end $$;

create table if not exists public.branches (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  store_id text not null references public.stores(id) on delete cascade,
  slug text not null,
  name text not null,
  code text,
  address text,
  city text,
  phone text,
  status text not null default 'active',
  is_primary boolean not null default false,
  public_visible boolean not null default true,
  open_hour integer,
  close_hour integer,
  open_days text,
  theme_override jsonb not null default '{}'::jsonb,
  operational_config jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint branches_status_check check (status in ('active', 'paused', 'archived')),
  constraint branches_store_slug_key unique (store_id, slug)
);

create unique index if not exists branches_primary_per_store_idx
  on public.branches(store_id)
  where is_primary = true;

create table if not exists public.user_memberships (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.app_role not null,
  tenant_id uuid references public.tenants(id) on delete cascade,
  store_id text references public.stores(id) on delete cascade,
  branch_id uuid references public.branches(id) on delete cascade,
  is_active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint user_memberships_scope_check check (
    (role = 'super_admin' and tenant_id is null and store_id is null and branch_id is null)
    or (role in ('tenant_owner', 'tenant_admin') and tenant_id is not null and store_id is null and branch_id is null)
    or (role in ('store_admin', 'store_operator') and tenant_id is not null and store_id is not null and branch_id is null)
    or (role in ('branch_manager', 'kitchen', 'rider', 'cashier') and tenant_id is not null and store_id is not null and branch_id is not null)
  ),
  constraint user_memberships_unique_scope unique (user_id, role, tenant_id, store_id, branch_id)
);

insert into public.store_templates (id, name, category, react_module_key, description, default_theme)
values
  (
    'delivery',
    'Brutalist Delivery',
    'food',
    'delivery',
    'Template agresivo para restaurantes y conversion rapida.',
    jsonb_build_object(
      'theme_primary_color', '#151515',
      'theme_secondary_color', '#F4D85B',
      'theme_accent_color', '#E55B2D',
      'theme_surface_color', '#F7F0E7',
      'theme_text_color', '#151515',
      'theme_font_display', 'Syne',
      'theme_font_body', 'Space Grotesk',
      'theme_button_radius', '0px'
    )
  ),
  (
    'vitrina',
    'Luxury Vitrina',
    'boutique',
    'vitrina',
    'Template elegante para retail premium y catalogos curados.',
    jsonb_build_object(
      'theme_primary_color', '#111111',
      'theme_secondary_color', '#1F1B17',
      'theme_accent_color', '#D2B48C',
      'theme_surface_color', '#F5EEE4',
      'theme_text_color', '#161616',
      'theme_font_display', 'Fraunces',
      'theme_font_body', 'DM Sans',
      'theme_button_radius', '8px'
    )
  ),
  (
    'portfolio',
    'Retro Neon',
    'food',
    'portfolio',
    'Template con identidad fuerte para marcas audaces.',
    jsonb_build_object(
      'theme_primary_color', '#9B2CFF',
      'theme_secondary_color', '#1A1038',
      'theme_accent_color', '#FF4FD8',
      'theme_surface_color', '#130B2B',
      'theme_text_color', '#F7F3FF',
      'theme_font_display', 'Syne',
      'theme_font_body', 'IBM Plex Sans',
      'theme_button_radius', '18px'
    )
  ),
  (
    'minimal',
    'Zen Commerce',
    'wellness',
    'minimal',
    'Template limpio y silencioso para compras guiadas.',
    jsonb_build_object(
      'theme_primary_color', '#5C6B5E',
      'theme_secondary_color', '#DCCEB8',
      'theme_accent_color', '#9C7B5B',
      'theme_surface_color', '#F3F0E8',
      'theme_text_color', '#273127',
      'theme_font_display', 'Libre Baskerville',
      'theme_font_body', 'Outfit',
      'theme_button_radius', '999px'
    )
  )
on conflict (id) do update
set
  name = excluded.name,
  category = excluded.category,
  react_module_key = excluded.react_module_key,
  description = excluded.description,
  default_theme = excluded.default_theme,
  is_active = true,
  updated_at = timezone('utc', now());

do $$
declare
  table_name text;
  scoped_tables text[] := array[
    'settings',
    'config_tienda',
    'store_settings',
    'store_process_profiles',
    'store_runtime_profiles',
    'products',
    'combos',
    'toppings',
    'topping_categories',
    'orders',
    'stock_items',
    'stock_item_products',
    'coupons',
    'affiliates',
    'affiliate_applications',
    'staff_users',
    'cash_entries',
    'daily_sales_summary',
    'loyalty_rewards',
    'reviews',
    'visitors',
    'chatbot_notifications',
    'chatbot_conversations',
    'oxidian_checkout_sessions',
    'domain_mappings',
    'store_niche_templates'
  ];
begin
  foreach table_name in array scoped_tables loop
    execute format('alter table if exists public.%I add column if not exists tenant_id uuid', table_name);
    execute format('alter table if exists public.%I add column if not exists store_id text', table_name);
    execute format('alter table if exists public.%I add column if not exists branch_id uuid', table_name);
  end loop;
end $$;

do $$
declare
  table_name text;
  fk_tenant_name text;
  fk_store_name text;
  fk_branch_name text;
  scoped_tables text[] := array[
    'settings',
    'config_tienda',
    'store_settings',
    'store_process_profiles',
    'store_runtime_profiles',
    'products',
    'combos',
    'toppings',
    'topping_categories',
    'orders',
    'stock_items',
    'stock_item_products',
    'coupons',
    'affiliates',
    'affiliate_applications',
    'staff_users',
    'cash_entries',
    'daily_sales_summary',
    'loyalty_rewards',
    'reviews',
    'visitors',
    'chatbot_notifications',
    'chatbot_conversations',
    'oxidian_checkout_sessions',
    'domain_mappings',
    'store_niche_templates'
  ];
begin
  foreach table_name in array scoped_tables loop
    fk_tenant_name := table_name || '_tenant_id_fkey';
    fk_store_name := table_name || '_store_id_fkey';
    fk_branch_name := table_name || '_branch_id_fkey';

    if not exists (select 1 from pg_constraint where conname = fk_tenant_name) then
      execute format(
        'alter table if exists public.%I add constraint %I foreign key (tenant_id) references public.tenants(id) on delete cascade',
        table_name,
        fk_tenant_name
      );
    end if;

    if not exists (select 1 from pg_constraint where conname = fk_store_name) then
      execute format(
        'alter table if exists public.%I add constraint %I foreign key (store_id) references public.stores(id) on delete cascade',
        table_name,
        fk_store_name
      );
    end if;

    if not exists (select 1 from pg_constraint where conname = fk_branch_name) then
      execute format(
        'alter table if exists public.%I add constraint %I foreign key (branch_id) references public.branches(id) on delete set null',
        table_name,
        fk_branch_name
      );
    end if;
  end loop;
end $$;

create index if not exists stores_tenant_id_idx on public.stores(tenant_id);
create index if not exists stores_template_id_idx on public.stores(template_id);
create index if not exists branches_tenant_id_idx on public.branches(tenant_id);
create index if not exists branches_store_id_idx on public.branches(store_id);
create index if not exists user_memberships_user_id_idx on public.user_memberships(user_id);
create index if not exists user_memberships_tenant_id_idx on public.user_memberships(tenant_id);
create index if not exists user_memberships_store_id_idx on public.user_memberships(store_id);
create index if not exists user_memberships_branch_id_idx on public.user_memberships(branch_id);

do $$
declare
  table_name text;
  scoped_tables text[] := array[
    'settings',
    'config_tienda',
    'store_settings',
    'store_process_profiles',
    'store_runtime_profiles',
    'products',
    'combos',
    'toppings',
    'topping_categories',
    'orders',
    'stock_items',
    'stock_item_products',
    'coupons',
    'affiliates',
    'affiliate_applications',
    'staff_users',
    'cash_entries',
    'daily_sales_summary',
    'loyalty_rewards',
    'reviews',
    'visitors',
    'chatbot_notifications',
    'chatbot_conversations',
    'oxidian_checkout_sessions',
    'domain_mappings',
    'store_niche_templates'
  ];
begin
  foreach table_name in array scoped_tables loop
    execute format('create index if not exists %I on public.%I(tenant_id)', table_name || '_tenant_idx', table_name);
    execute format('create index if not exists %I on public.%I(store_id)', table_name || '_store_idx', table_name);
    execute format('create index if not exists %I on public.%I(branch_id)', table_name || '_branch_idx', table_name);
  end loop;
end $$;

create or replace function public.current_request_claim(claim_key text)
returns text
language sql
stable
as $$
  select nullif(current_setting('request.jwt.claims', true)::jsonb ->> claim_key, '')
$$;

create or replace function public.current_request_app_role()
returns text
language sql
stable
as $$
  select coalesce(
    public.current_request_claim('app_role'),
    public.current_request_claim('user_role'),
    public.current_request_claim('role')
  )
$$;

create or replace function public.current_request_tenant_id()
returns uuid
language sql
stable
as $$
  select nullif(public.current_request_claim('tenant_id'), '')::uuid
$$;

create or replace function public.current_request_store_id()
returns text
language sql
stable
as $$
  select public.current_request_claim('store_id')
$$;

create or replace function public.current_request_branch_id()
returns uuid
language sql
stable
as $$
  select nullif(public.current_request_claim('branch_id'), '')::uuid
$$;

create or replace function public.is_super_admin()
returns boolean
language sql
stable
as $$
  select
    auth.role() = 'service_role'
    or public.current_request_app_role() = 'super_admin'
    or exists (
      select 1
      from public.user_memberships m
      where m.user_id = auth.uid()
        and m.role = 'super_admin'
        and m.is_active
    )
$$;

create or replace function public.can_access_scope(
  target_tenant_id uuid,
  target_store_id text default null,
  target_branch_id uuid default null
)
returns boolean
language sql
stable
as $$
  select
    public.is_super_admin()
    or (
      public.current_request_tenant_id() is not null
      and public.current_request_tenant_id() = target_tenant_id
      and (
        public.current_request_app_role() in ('tenant_owner', 'tenant_admin')
        or (
          target_store_id is not null
          and public.current_request_store_id() = target_store_id
          and public.current_request_app_role() in ('store_admin', 'store_operator', 'branch_manager')
        )
        or (
          target_branch_id is not null
          and public.current_request_branch_id() = target_branch_id
          and public.current_request_app_role() in ('branch_manager', 'kitchen', 'rider', 'cashier')
        )
      )
    )
    or exists (
      select 1
      from public.user_memberships m
      where m.user_id = auth.uid()
        and m.is_active
        and m.tenant_id = target_tenant_id
        and (
          m.role in ('tenant_owner', 'tenant_admin')
          or (
            target_store_id is not null
            and m.store_id = target_store_id
            and m.role in ('store_admin', 'store_operator')
          )
          or (
            target_branch_id is not null
            and m.branch_id = target_branch_id
            and m.role in ('branch_manager', 'kitchen', 'rider', 'cashier')
          )
        )
    )
$$;

alter table public.tenants enable row level security;
alter table public.stores enable row level security;
alter table public.branches enable row level security;
alter table public.user_memberships enable row level security;

drop policy if exists tenants_super_admin_all on public.tenants;
create policy tenants_super_admin_all
  on public.tenants
  for all
  to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());

drop policy if exists tenants_self_read on public.tenants;
create policy tenants_self_read
  on public.tenants
  for select
  to authenticated
  using (public.can_access_scope(id, null, null));

drop policy if exists stores_public_read on public.stores;
create policy stores_public_read
  on public.stores
  for select
  to anon, authenticated
  using (public_visible = true and status in ('active', 'draft', 'paused'));

drop policy if exists stores_scoped_manage on public.stores;
create policy stores_scoped_manage
  on public.stores
  for all
  to authenticated
  using (public.can_access_scope(tenant_id, id, null))
  with check (public.can_access_scope(tenant_id, id, null));

drop policy if exists branches_public_read on public.branches;
create policy branches_public_read
  on public.branches
  for select
  to anon, authenticated
  using (public_visible = true and status = 'active');

drop policy if exists branches_scoped_manage on public.branches;
create policy branches_scoped_manage
  on public.branches
  for all
  to authenticated
  using (public.can_access_scope(tenant_id, store_id, id))
  with check (public.can_access_scope(tenant_id, store_id, id));

drop policy if exists user_memberships_super_admin_all on public.user_memberships;
create policy user_memberships_super_admin_all
  on public.user_memberships
  for all
  to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());

drop policy if exists user_memberships_tenant_owner_manage on public.user_memberships;
create policy user_memberships_tenant_owner_manage
  on public.user_memberships
  for all
  to authenticated
  using (
    exists (
      select 1
      from public.user_memberships owner_membership
      where owner_membership.user_id = auth.uid()
        and owner_membership.role = 'tenant_owner'
        and owner_membership.is_active
        and owner_membership.tenant_id = public.user_memberships.tenant_id
    )
  )
  with check (
    exists (
      select 1
      from public.user_memberships owner_membership
      where owner_membership.user_id = auth.uid()
        and owner_membership.role = 'tenant_owner'
        and owner_membership.is_active
        and owner_membership.tenant_id = public.user_memberships.tenant_id
    )
  );

do $$
declare
  table_name text;
  scoped_tables text[] := array[
    'settings',
    'config_tienda',
    'store_settings',
    'store_process_profiles',
    'store_runtime_profiles',
    'products',
    'combos',
    'toppings',
    'topping_categories',
    'orders',
    'stock_items',
    'stock_item_products',
    'coupons',
    'affiliates',
    'affiliate_applications',
    'staff_users',
    'cash_entries',
    'daily_sales_summary',
    'loyalty_rewards',
    'reviews',
    'visitors',
    'chatbot_notifications',
    'chatbot_conversations',
    'oxidian_checkout_sessions',
    'domain_mappings',
    'store_niche_templates'
  ];
begin
  foreach table_name in array scoped_tables loop
    execute format('alter table if exists public.%I enable row level security', table_name);
    execute format('drop policy if exists %I on public.%I', table_name || '_super_admin_all', table_name);
    execute format('drop policy if exists %I on public.%I', table_name || '_scoped_manage', table_name);
    execute format(
      'create policy %I on public.%I for all to authenticated using (public.can_access_scope(tenant_id, store_id, branch_id)) with check (public.can_access_scope(tenant_id, store_id, branch_id))',
      table_name || '_scoped_manage',
      table_name
    );
    execute format(
      'create policy %I on public.%I for all to authenticated using (public.is_super_admin()) with check (public.is_super_admin())',
      table_name || '_super_admin_all',
      table_name
    );
  end loop;
end $$;

comment on table public.user_memberships is
'Tabla de control de acceso jerarquico. Reemplaza la dependencia exclusiva en claims estaticos del JWT.';

comment on column public.stores.theme_tokens is
'Tokens visuales base de la marca. El frontend resuelve template_id + theme_tokens + branch.theme_override.';

comment on column public.branches.theme_override is
'Overrides visuales por sede. Util para menus locales, colores o mensajes operativos.';

commit;
