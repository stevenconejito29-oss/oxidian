-- ============================================================
-- OXIDIAN SAAS - SETUP UNICO PARA SUPABASE
-- Archivo consolidado para SQL Editor
-- Incluye:
--   1. RESET_COMPLETE.sql
--   2. 0005_testing_readiness.sql
--   3. 0006_fix_rls_auth_errors.sql
--
-- Nota importante:
--   Este repo no contiene 0007_modules_engine.sql.
--   Por tanto este archivo consolida todo el SQL real disponible
--   y verificable dentro del proyecto actual.
-- ============================================================


-- ================================================================
-- OXIDIAN SAAS â€” SETUP COMPLETO DESDE CERO
-- Ejecutar en: Supabase Dashboard â†’ SQL Editor
-- BORRA TODO y recrea limpio. Verificado contra el cÃ³digo real.
-- ================================================================

-- â”€â”€ 0. BORRAR TODO LO EXISTENTE â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
do $$ declare
  r record;
begin
  -- Eliminar todas las polÃ­ticas RLS
  for r in (select schemaname, tablename, policyname
            from pg_policies where schemaname = 'public') loop
    execute format('drop policy if exists %I on %I.%I',
      r.policyname, r.schemaname, r.tablename);
  end loop;

  -- Eliminar todas las vistas
  for r in (select table_name from information_schema.views
            where table_schema = 'public') loop
    execute format('drop view if exists public.%I cascade', r.table_name);
  end loop;

  -- Eliminar todas las tablas del schema pÃºblico
  for r in (select tablename from pg_tables
            where schemaname = 'public') loop
    execute format('drop table if exists public.%I cascade', r.tablename);
  end loop;

  -- Eliminar funciones propias
  for r in (select routine_name, specific_name
            from information_schema.routines
            where routine_schema = 'public'
              and routine_type = 'FUNCTION') loop
    execute format('drop function if exists public.%I cascade', r.routine_name);
  end loop;

  -- Eliminar tipos
  for r in (select typname from pg_type
            where typnamespace = (select oid from pg_namespace where nspname='public')
              and typtype = 'e') loop
    execute format('drop type if exists public.%I cascade', r.typname);
  end loop;
end $$;

-- â”€â”€ 1. EXTENSIONES â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
create extension if not exists pgcrypto;

-- â”€â”€ 2. TIPOS ENUM â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

-- â”€â”€ 3. TABLAS DE JERARQUÃA â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

-- 3.1 Tenants (dueÃ±os de negocio que pagan el SaaS)
create table public.tenants (
  id            uuid primary key default gen_random_uuid(),
  slug          text not null unique,
  name          text not null,
  owner_name    text,
  owner_email   text unique,
  owner_phone   text,
  billing_email text,
  status        text not null default 'active'
                  check (status in ('active','suspended','archived')),
  monthly_fee   numeric(10,2) not null default 0,
  notes         text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- 3.2 Store Templates
create table public.store_templates (
  id              text primary key,
  name            text not null,
  category        text not null,
  react_module_key text not null,
  description     text,
  default_theme   jsonb not null default '{}',
  is_active       boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- 3.3 Stores (marcas/tiendas)
create table public.stores (
  id                  text primary key,          -- slug-style, ej: "oxidian-store"
  slug                text,
  code                text,
  name                text not null,
  status              text not null default 'draft'
                        check (status in ('draft','active','paused','archived')),
  plan_id             text not null default 'growth',
  business_type       text not null default 'food',
  niche               text,
  owner_name          text,
  owner_phone         text,
  owner_email         text,
  city                text,
  country             text,
  portable_folder_name text,
  public_url          text,
  notes               text,
  -- Multitenant
  tenant_id           uuid references public.tenants(id) on delete cascade,
  -- Theming
  template_id         text references public.store_templates(id) on update cascade,
  theme_tokens        jsonb not null default '{}',
  -- Visibilidad
  branch_mode         text not null default 'single',
  public_visible      boolean not null default true,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index stores_tenant_id_idx on public.stores(tenant_id);
create index stores_template_id_idx on public.stores(template_id);

-- 3.4 Branches (sedes/sucursales)
create table public.branches (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references public.tenants(id) on delete cascade,
  store_id        text not null references public.stores(id) on delete cascade,
  slug            text not null,
  name            text not null,
  code            text,
  address         text,
  city            text,
  phone           text,
  status          text not null default 'active'
                    check (status in ('active','paused','archived')),
  is_primary      boolean not null default false,
  public_visible  boolean not null default true,
  open_hour       integer default 10,
  close_hour      integer default 22,
  open_days       text default 'L-D',
  theme_override  jsonb not null default '{}',
  operational_config jsonb not null default '{}',
  -- Chatbot portable
  chatbot_authorized    boolean not null default false,
  chatbot_authorized_at timestamptz,
  chatbot_authorized_by uuid references auth.users(id),
  chatbot_store_id      text,
  chatbot_wa_secret     text,
  chatbot_last_seen     timestamptz,
  chatbot_version       text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (store_id, slug)
);

create unique index branches_primary_per_store_idx on public.branches(store_id)
  where is_primary = true;
create index branches_tenant_id_idx on public.branches(tenant_id);
create index branches_store_id_idx on public.branches(store_id);

-- 3.5 MembresÃ­as de usuario (control de acceso)
create table public.user_memberships (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  role        public.app_role not null,
  tenant_id   uuid references public.tenants(id) on delete cascade,
  store_id    text references public.stores(id) on delete cascade,
  branch_id   uuid references public.branches(id) on delete cascade,
  is_active   boolean not null default true,
  metadata    jsonb not null default '{}',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint user_memberships_scope_check check (
    (role = 'super_admin' and tenant_id is null and store_id is null and branch_id is null)
    or (role in ('tenant_owner','tenant_admin') and tenant_id is not null and store_id is null and branch_id is null)
    or (role in ('store_admin','store_operator') and tenant_id is not null and store_id is not null and branch_id is null)
    or (role in ('branch_manager','kitchen','rider','cashier') and tenant_id is not null and store_id is not null and branch_id is not null)
  ),
  unique (user_id, role, tenant_id, store_id, branch_id)
);

create index user_memberships_user_id_idx on public.user_memberships(user_id);
create index user_memberships_tenant_id_idx on public.user_memberships(tenant_id);
create index user_memberships_store_id_idx on public.user_memberships(store_id);
create index user_memberships_hook_idx on public.user_memberships(user_id, is_active, role)
  where is_active = true;

-- â”€â”€ 4. CONFIGURACIÃ“N â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

-- 4.1 Config global (legacy, una sola fila por tienda 'default')
create table public.config_tienda (
  id                      text primary key default 'default',
  store_code              text default 'default',
  -- Negocio
  business_name           text default 'Mi tienda',
  tagline                 text,
  address                 text,
  logo_url                text,
  whatsapp_number         text,
  support_phone           text,
  instagram_url           text,
  instagram_handle        text,
  maps_url                text,
  open_hour               text default '10',
  close_hour              text default '22',
  open_days               text default '1,2,3,4,5,6,0',
  store_hours_text        text,
  admin_phone             text,
  system_prompt           text,
  business_values         text,
  business_type           text default 'food',
  plan_slug               text default 'growth',
  -- Flujos
  order_flow_type         text default 'standard',
  catalog_mode            text default 'food',
  requires_preparation    boolean default true,
  requires_dispatch       boolean default true,
  enable_delivery         boolean default true,
  enable_pickup           boolean default false,
  -- MÃ³dulos
  module_products_enabled  boolean default true,
  module_combos_enabled    boolean default true,
  module_toppings_enabled  boolean default true,
  module_stock_enabled     boolean default true,
  module_coupons_enabled   boolean default true,
  module_loyalty_enabled   boolean default true,
  module_reviews_enabled   boolean default true,
  module_affiliates_enabled boolean default true,
  module_chatbot_enabled   boolean default true,
  module_staff_enabled     boolean default true,
  module_finance_enabled   boolean default true,
  -- Tema
  theme_primary_color     text default '#2D6A4F',
  theme_secondary_color   text default '#40916C',
  theme_accent_color      text default '#E8607A',
  theme_surface_color     text default '#FFF5EE',
  theme_text_color        text default '#2D1F1A',
  theme_font_display      text default 'Pacifico',
  theme_font_body         text default 'Nunito',
  theme_button_radius     text default '14px',
  theme_daisy_theme       text default 'oxidian',
  menu_layout             text default 'delivery',
  -- Storefront
  storefront_badge_text        text,
  storefront_announcement      text,
  storefront_search_placeholder text,
  storefront_intro_eyebrow     text,
  storefront_intro_title       text,
  storefront_intro_text        text,
  storefront_story_quote       text,
  storefront_story_author      text,
  storefront_primary_cta_label text,
  storefront_secondary_cta_label text,
  -- Multitenant (nullable para compatibilidad legacy)
  tenant_id   uuid references public.tenants(id) on delete cascade,
  store_id    text references public.stores(id) on delete cascade,
  branch_id   uuid references public.branches(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- 4.2 Settings key-value globales
create table public.settings (
  id         uuid primary key default gen_random_uuid(),
  key        text not null unique,
  value      text not null default '',
  tenant_id  uuid references public.tenants(id) on delete cascade,
  store_id   text references public.stores(id) on delete cascade,
  branch_id  uuid references public.branches(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 4.3 Store settings (scoped por store_id)
create table public.store_settings (
  id         uuid primary key default gen_random_uuid(),
  store_id   text not null references public.stores(id) on delete cascade,
  key        text not null,
  value      text not null default '',
  tenant_id  uuid references public.tenants(id) on delete cascade,
  branch_id  uuid references public.branches(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (store_id, key)
);

-- 4.4 Store process profiles
create table public.store_process_profiles (
  id                        uuid primary key default gen_random_uuid(),
  store_id                  text not null unique references public.stores(id) on delete cascade,
  tenant_id                 uuid references public.tenants(id) on delete cascade,
  branch_id                 uuid references public.branches(id) on delete set null,
  order_flow_type           text default 'standard',
  catalog_mode              text default 'food',
  requires_preparation      boolean default true,
  requires_dispatch         boolean default true,
  enable_delivery           boolean default true,
  enable_pickup             boolean default false,
  module_products_enabled   boolean default true,
  module_combos_enabled     boolean default true,
  module_toppings_enabled   boolean default true,
  module_stock_enabled      boolean default true,
  module_coupons_enabled    boolean default true,
  module_loyalty_enabled    boolean default true,
  module_reviews_enabled    boolean default true,
  module_affiliates_enabled boolean default true,
  module_chatbot_enabled    boolean default true,
  module_staff_enabled      boolean default true,
  module_finance_enabled    boolean default true,
  operational_notes         text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- 4.5 Store runtime profiles
create table public.store_runtime_profiles (
  id                    uuid primary key default gen_random_uuid(),
  store_id              text not null unique references public.stores(id) on delete cascade,
  tenant_id             uuid references public.tenants(id) on delete cascade,
  branch_id             uuid references public.branches(id) on delete set null,
  portable_root_hint    text,
  chatbot_url           text default 'http://127.0.0.1:3001',
  chatbot_port          integer default 3001,
  chatbot_autostart     boolean default true,
  admin_desktop_enabled boolean default true,
  qr_mode               text default 'embedded',
  ai_provider           text default 'gemini',
  ai_model              text default 'gemini-2.5-flash',
  ai_key_label          text,
  ai_key_last4          text,
  runtime_notes         text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- 4.6 Store niche templates (plantillas por nicho)
create table public.store_niche_templates (
  id            text primary key,
  name          text not null,
  niche         text,
  category      text,
  react_module_key text,
  description   text,
  default_theme jsonb not null default '{}',
  is_active     boolean not null default true,
  sort_order    integer default 0,
  tenant_id     uuid references public.tenants(id) on delete cascade,
  store_id      text references public.stores(id) on delete cascade,
  branch_id     uuid references public.branches(id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- â”€â”€ 5. CATÃLOGO â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

-- 5.1 Productos
create table public.products (
  id                      uuid primary key default gen_random_uuid(),
  store_id                text not null references public.stores(id) on delete cascade,
  tenant_id               uuid references public.tenants(id) on delete cascade,
  branch_id               uuid references public.branches(id) on delete set null,
  name                    text not null,
  description             text,
  price                   numeric(10,2) not null default 0,
  category                text default 'general',
  emoji                   text default 'ðŸ½ï¸',
  sort_order              integer default 0,
  available               boolean not null default true,   -- visibilidad pÃºblica
  is_active               boolean not null default true,   -- activo en el sistema
  out_of_stock            boolean not null default false,
  topping_category_ids    jsonb default '[]',
  allowed_topping_ids     jsonb default '[]',
  tags                    jsonb default '[]',
  sold_today              integer default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index products_store_id_idx on public.products(store_id);
create index products_store_active_idx on public.products(store_id, is_active) where is_active = true;
create index products_store_tenant_idx on public.products(store_id, tenant_id);

-- 5.2 CategorÃ­as de toppings
create table public.topping_categories (
  id              uuid primary key default gen_random_uuid(),
  store_id        text not null references public.stores(id) on delete cascade,
  tenant_id       uuid references public.tenants(id) on delete cascade,
  branch_id       uuid references public.branches(id) on delete set null,
  name            text not null,
  sort_order      integer default 0,
  required        boolean default false,
  max_selections  integer default 1,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index topping_categories_store_idx on public.topping_categories(store_id);

-- 5.3 Toppings
create table public.toppings (
  id          uuid primary key default gen_random_uuid(),
  store_id    text not null references public.stores(id) on delete cascade,
  tenant_id   uuid references public.tenants(id) on delete cascade,
  branch_id   uuid references public.branches(id) on delete set null,
  category_id uuid references public.topping_categories(id) on delete set null,
  name        text not null,
  price       numeric(10,2) default 0,
  sort_order  integer default 0,
  is_active   boolean not null default true,
  available   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index toppings_store_idx on public.toppings(store_id);

-- 5.4 Combos
create table public.combos (
  id          uuid primary key default gen_random_uuid(),
  store_id    text not null references public.stores(id) on delete cascade,
  tenant_id   uuid references public.tenants(id) on delete cascade,
  branch_id   uuid references public.branches(id) on delete set null,
  name        text not null,
  description text,
  price       numeric(10,2) not null default 0,
  emoji       text default 'ðŸŽ',
  sort_order  integer default 0,
  available   boolean not null default true,
  is_active   boolean not null default true,
  combo_slots jsonb default '[]',   -- slots configurables
  items       jsonb default '[]',   -- Ã­tems directos
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index combos_store_idx on public.combos(store_id);

-- â”€â”€ 6. PEDIDOS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
create table public.orders (
  id               uuid primary key default gen_random_uuid(),
  store_id         text not null references public.stores(id) on delete cascade,
  tenant_id        uuid references public.tenants(id) on delete cascade,
  branch_id        uuid references public.branches(id) on delete set null,
  order_number     text,
  status           text not null default 'pending'
                     check (status in ('pending','preparing','ready','delivering','delivered','cancelled')),
  customer_name    text,
  customer_phone   text,
  address          text,
  delivery_address text,
  notes            text,
  items            jsonb default '[]',
  total            numeric(10,2) default 0,
  delivery_fee     numeric(10,2) default 0,
  delivery_type    text default 'delivery',
  payment_method   text default 'cash',
  coupon_code      text,
  affiliate_code   text,
  rider_id         uuid,
  delivered_at     timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index orders_store_id_idx on public.orders(store_id);
create index orders_branch_status_idx on public.orders(branch_id, status, created_at desc);
create index orders_store_date_idx on public.orders(store_id, created_at desc);
create index orders_customer_phone_idx on public.orders(store_id, customer_phone);

-- â”€â”€ 7. STOCK â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
create table public.stock_items (
  id             uuid primary key default gen_random_uuid(),
  store_id       text not null references public.stores(id) on delete cascade,
  tenant_id      uuid references public.tenants(id) on delete cascade,
  branch_id      uuid references public.branches(id) on delete set null,
  product_id     uuid references public.products(id) on delete set null,
  name           text not null,
  quantity       numeric(10,3) default 0,
  min_quantity   numeric(10,3) default 5,
  unit           text default 'unidades',
  cost_per_unit  numeric(10,4) default 0,
  deleted_at     timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index stock_items_store_idx on public.stock_items(store_id);

create table public.stock_item_products (
  id             uuid primary key default gen_random_uuid(),
  store_id       text not null references public.stores(id) on delete cascade,
  tenant_id      uuid references public.tenants(id) on delete cascade,
  branch_id      uuid references public.branches(id) on delete set null,
  stock_item_id  uuid not null references public.stock_items(id) on delete cascade,
  product_id     uuid not null references public.products(id) on delete cascade,
  quantity_used  numeric(10,3) default 1,
  created_at     timestamptz not null default now()
);

create index stock_item_products_store_idx on public.stock_item_products(store_id);

-- â”€â”€ 8. MARKETING â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

-- 8.1 Cupones
create table public.coupons (
  id           uuid primary key default gen_random_uuid(),
  store_id     text not null references public.stores(id) on delete cascade,
  tenant_id    uuid references public.tenants(id) on delete cascade,
  branch_id    uuid references public.branches(id) on delete set null,
  code         text not null,
  type         text default 'percentage' check (type in ('percentage','fixed','free_delivery')),
  value        numeric(10,2) default 10,
  min_order    numeric(10,2) default 0,
  max_uses     integer,
  uses_count   integer default 0,
  valid_from   timestamptz,
  valid_until  timestamptz,
  is_active    boolean default true,
  description  text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (store_id, code)
);

create index coupons_store_idx on public.coupons(store_id);

-- 8.2 Afiliados
create table public.affiliates (
  id               uuid primary key default gen_random_uuid(),
  store_id         text not null references public.stores(id) on delete cascade,
  tenant_id        uuid references public.tenants(id) on delete cascade,
  branch_id        uuid references public.branches(id) on delete set null,
  name             text not null,
  email            text,
  phone            text,
  code             text not null,
  password_hash    text,
  setup_token      text,
  setup_token_used boolean default false,
  commission_pct   numeric(5,2) default 10,
  discount_pct     numeric(5,2) default 5,
  is_active        boolean default true,
  balance          numeric(10,2) default 0,
  total_earned     numeric(10,2) default 0,
  total_orders     integer default 0,
  instagram_handle text,
  city             text,
  notes            text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (store_id, code)
);

create index affiliates_store_idx on public.affiliates(store_id);
create index affiliates_code_idx on public.affiliates(store_id, code);

-- 8.3 Solicitudes de afiliados
create table public.affiliate_applications (
  id                       uuid primary key default gen_random_uuid(),
  store_id                 text not null references public.stores(id) on delete cascade,
  tenant_id                uuid references public.tenants(id) on delete cascade,
  branch_id                uuid references public.branches(id) on delete set null,
  affiliate_id             uuid references public.affiliates(id) on delete set null,
  full_name                text,
  phone                    text,
  email                    text,
  instagram_handle         text,
  city                     text,
  primary_channel          text,
  audience_size            text,
  requested_code           text,
  requested_affiliate_name text,
  motivation               text,
  status                   text default 'pending' check (status in ('pending','approved','rejected')),
  reviewed_by              uuid references auth.users(id),
  reviewed_at              timestamptz,
  created_at               timestamptz not null default now()
);

-- â”€â”€ 9. FIDELIDAD â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
create table public.loyalty_rewards (
  id              uuid primary key default gen_random_uuid(),
  store_id        text not null references public.stores(id) on delete cascade,
  tenant_id       uuid references public.tenants(id) on delete cascade,
  branch_id       uuid references public.branches(id) on delete set null,
  name            text not null default 'Premio de fidelidad',
  points_required integer default 100,
  reward_type     text default 'discount' check (reward_type in ('discount','free_product','free_delivery')),
  reward_value    numeric(10,2) default 10,
  description     text,
  is_active       boolean default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index loyalty_rewards_store_idx on public.loyalty_rewards(store_id);

-- â”€â”€ 10. RESEÃ‘AS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
create table public.reviews (
  id              uuid primary key default gen_random_uuid(),
  store_id        text not null references public.stores(id) on delete cascade,
  tenant_id       uuid references public.tenants(id) on delete cascade,
  branch_id       uuid references public.branches(id) on delete set null,
  order_id        uuid references public.orders(id) on delete set null,
  customer_name   text,
  customer_phone  text,
  rating          integer default 5 check (rating between 1 and 5),
  comment         text,
  approved        boolean default false,
  reply           text,
  replied_at      timestamptz,
  created_at      timestamptz not null default now()
);

create index reviews_store_idx on public.reviews(store_id);

-- â”€â”€ 11. STAFF â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
create table public.staff_users (
  id          uuid primary key default gen_random_uuid(),
  store_id    text not null references public.stores(id) on delete cascade,
  tenant_id   uuid references public.tenants(id) on delete cascade,
  branch_id   uuid references public.branches(id) on delete set null,
  user_id     uuid references auth.users(id) on delete set null,
  name        text not null,
  role        text default 'cashier',
  phone       text,
  email       text,
  pin         text,
  is_active   boolean default true,
  is_online   boolean default false,
  is_rider    boolean default false,
  last_seen_at timestamptz,
  metadata    jsonb default '{}',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index staff_users_store_idx on public.staff_users(store_id);
create index staff_users_online_idx on public.staff_users(store_id, is_online) where is_online = true;

-- â”€â”€ 12. PLANES â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
create table public.store_plans (
  id             text primary key,
  name           text not null,
  description    text,
  color          text default '#2D6A4F',
  monthly_price  numeric(10,2) default 0,
  sort_order     integer default 0,
  feature_bundle jsonb default '{}',
  is_active      boolean default true,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

-- â”€â”€ 13. FINANZAS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
create table public.cash_entries (
  id          uuid primary key default gen_random_uuid(),
  store_id    text not null references public.stores(id) on delete cascade,
  tenant_id   uuid references public.tenants(id) on delete cascade,
  branch_id   uuid references public.branches(id) on delete set null,
  date        text not null default to_char(now(), 'YYYY-MM-DD'),
  type        text not null default 'income' check (type in ('ingreso','gasto','retiro','income','expense')),
  category    text default 'otro',
  concept     text not null default 'Entrada manual',
  amount      numeric(10,2) not null default 0,
  notes       text,
  created_by  uuid references auth.users(id),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index cash_entries_store_date_idx on public.cash_entries(store_id, date);

create table public.daily_sales_summary (
  id               uuid primary key default gen_random_uuid(),
  store_id         text not null references public.stores(id) on delete cascade,
  tenant_id        uuid references public.tenants(id) on delete cascade,
  branch_id        uuid references public.branches(id) on delete set null,
  date             text not null,
  orders_count     integer default 0,
  delivered_count  integer default 0,
  confirmed_revenue numeric(10,2) default 0,
  avg_ticket       numeric(10,2) default 0,
  created_at       timestamptz not null default now(),
  unique (store_id, date)
);

-- â”€â”€ 14. CHATBOT â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
create table public.chatbot_conversations (
  id                uuid primary key default gen_random_uuid(),
  store_id          text not null references public.stores(id) on delete cascade,
  tenant_id         uuid references public.tenants(id) on delete cascade,
  branch_id         uuid references public.branches(id) on delete set null,
  phone             text not null,
  escalation_reason text,
  last_message      text,
  resolved          boolean default false,
  admin_takeover    boolean default false,
  updated_at        timestamptz not null default now(),
  created_at        timestamptz not null default now(),
  unique (store_id, phone)
);

create index chatbot_conversations_store_idx on public.chatbot_conversations(store_id);

create table public.chatbot_notifications (
  id          uuid primary key default gen_random_uuid(),
  store_id    text not null references public.stores(id) on delete cascade,
  tenant_id   uuid references public.tenants(id) on delete cascade,
  branch_id   uuid references public.branches(id) on delete set null,
  type        text,
  payload     jsonb default '{}',
  sent_at     timestamptz,
  created_at  timestamptz not null default now()
);

create table public.chatbot_portable_pings (
  id              uuid primary key default gen_random_uuid(),
  branch_id       uuid not null references public.branches(id) on delete cascade,
  tenant_id       uuid not null references public.tenants(id) on delete cascade,
  store_id        text not null,
  wa_connected    boolean default false,
  chatbot_version text,
  ai_provider     text,
  ping_at         timestamptz not null default now()
);

create index chatbot_pings_branch_idx on public.chatbot_portable_pings(branch_id);
create index chatbot_pings_at_idx on public.chatbot_portable_pings(ping_at desc);

create table public.chatbot_authorization_log (
  id          uuid primary key default gen_random_uuid(),
  branch_id   uuid not null references public.branches(id) on delete cascade,
  action      text not null check (action in ('authorized','revoked','regenerated_secret')),
  performed_by uuid references auth.users(id),
  note        text,
  created_at  timestamptz not null default now()
);

-- â”€â”€ 15. VISITANTES / ANALYTICS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
create table public.visitors (
  id          uuid primary key default gen_random_uuid(),
  store_id    text not null references public.stores(id) on delete cascade,
  tenant_id   uuid references public.tenants(id) on delete cascade,
  branch_id   uuid references public.branches(id) on delete set null,
  session_id  text,
  page        text,
  referrer    text,
  ip_hash     text,
  metadata    jsonb default '{}',
  created_at  timestamptz not null default now()
);

-- â”€â”€ 16. CHECKOUT SESSIONS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
create table public.oxidian_checkout_sessions (
  id          uuid primary key default gen_random_uuid(),
  store_id    text not null references public.stores(id) on delete cascade,
  tenant_id   uuid references public.tenants(id) on delete cascade,
  branch_id   uuid references public.branches(id) on delete set null,
  order_id    uuid references public.orders(id) on delete set null,
  session_token text not null unique,
  status      text default 'pending',
  payload     jsonb default '{}',
  expires_at  timestamptz,
  created_at  timestamptz not null default now()
);

-- â”€â”€ 17. DOMAIN MAPPINGS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
create table public.domain_mappings (
  id          uuid primary key default gen_random_uuid(),
  store_id    text not null references public.stores(id) on delete cascade,
  tenant_id   uuid references public.tenants(id) on delete cascade,
  branch_id   uuid references public.branches(id) on delete set null,
  domain      text not null unique,
  is_primary  boolean default false,
  is_verified boolean default false,
  created_at  timestamptz not null default now()
);

-- â”€â”€ 18. ACCOUNT ACTIVATIONS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
create table public.account_activations (
  id                   uuid primary key default gen_random_uuid(),
  user_id              uuid not null references auth.users(id) on delete cascade,
  role                 public.app_role not null,
  tenant_id            uuid references public.tenants(id) on delete cascade,
  store_id             text references public.stores(id) on delete cascade,
  branch_id            uuid references public.branches(id) on delete cascade,
  onboarding_completed boolean default false,
  onboarding_step      text default 'welcome',
  activated_at         timestamptz,
  metadata             jsonb default '{}',
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  unique (user_id, role, tenant_id, store_id, branch_id)
);

-- â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
-- SECCIÃ“N 2: FUNCIONES DE SEGURIDAD
-- â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

create or replace function public.current_request_claim(claim_key text)
returns text language sql stable as $$
  select nullif(current_setting('request.jwt.claims', true)::jsonb ->> claim_key, '')
$$;

create or replace function public.current_request_app_role()
returns text language sql stable as $$
  select coalesce(
    public.current_request_claim('app_role'),
    public.current_request_claim('user_role'),
    public.current_request_claim('role')
  )
$$;

create or replace function public.current_request_tenant_id()
returns uuid language sql stable as $$
  select nullif(public.current_request_claim('tenant_id'), '')::uuid
$$;

create or replace function public.current_request_store_id()
returns text language sql stable as $$
  select public.current_request_claim('store_id')
$$;

create or replace function public.current_request_branch_id()
returns uuid language sql stable as $$
  select nullif(public.current_request_claim('branch_id'), '')::uuid
$$;

create or replace function public.is_super_admin()
returns boolean language sql stable as $$
  select
    auth.role() = 'service_role'
    or public.current_request_app_role() = 'super_admin'
    or exists (
      select 1 from public.user_memberships m
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
returns boolean language sql stable as $$
  select
    public.is_super_admin()
    or (
      public.current_request_tenant_id() is not null
      and public.current_request_tenant_id() = target_tenant_id
      and (
        public.current_request_app_role() in ('tenant_owner','tenant_admin')
        or (
          target_store_id is not null
          and public.current_request_store_id() = target_store_id
          and public.current_request_app_role() in ('store_admin','store_operator','branch_manager')
        )
        or (
          target_branch_id is not null
          and public.current_request_branch_id() = target_branch_id
          and public.current_request_app_role() in ('branch_manager','kitchen','rider','cashier')
        )
      )
    )
    or exists (
      select 1 from public.user_memberships m
      where m.user_id = auth.uid()
        and m.is_active
        and m.tenant_id = target_tenant_id
        and (
          m.role in ('tenant_owner','tenant_admin')
          or (target_store_id is not null and m.store_id = target_store_id and m.role in ('store_admin','store_operator'))
          or (target_branch_id is not null and m.branch_id = target_branch_id and m.role in ('branch_manager','kitchen','rider','cashier'))
        )
    )
$$;

-- â”€â”€ JWT Claims Hook â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
create or replace function public.custom_jwt_claims(event jsonb)
returns jsonb language plpgsql security definer stable as $$
declare
  membership record;
  claims jsonb;
begin
  select * into membership
  from public.user_memberships
  where user_id = (event->>'userId')::uuid and is_active = true
  order by case role
    when 'super_admin'    then 1
    when 'tenant_owner'   then 2
    when 'tenant_admin'   then 3
    when 'store_admin'    then 4
    when 'store_operator' then 5
    when 'branch_manager' then 6
    when 'kitchen'        then 7
    when 'rider'          then 8
    when 'cashier'        then 9
    else 99
  end limit 1;

  claims := event->'claims';

  if membership is not null then
    claims := jsonb_set(claims, '{app_role}', to_jsonb(membership.role::text));
    if membership.tenant_id is not null then
      claims := jsonb_set(claims, '{tenant_id}', to_jsonb(membership.tenant_id::text));
    end if;
    if membership.store_id is not null then
      claims := jsonb_set(claims, '{store_id}', to_jsonb(membership.store_id::text));
    end if;
    if membership.branch_id is not null then
      claims := jsonb_set(claims, '{branch_id}', to_jsonb(membership.branch_id::text));
    end if;
  else
    claims := jsonb_set(claims, '{app_role}', '"authenticated_user"');
  end if;

  return jsonb_set(event, '{claims}', claims);
end;
$$;

grant execute on function public.custom_jwt_claims(jsonb) to supabase_auth_admin;

-- â”€â”€ FunciÃ³n para asignar Super Admin â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
create or replace function public.make_super_admin(p_email text)
returns jsonb language plpgsql security definer as $$
declare
  v_user_id uuid;
  v_existing uuid;
begin
  select id into v_user_id from auth.users
  where email = lower(trim(p_email)) limit 1;

  if v_user_id is null then
    return jsonb_build_object('success', false, 'error', 'Usuario no encontrado. RegÃ­strate primero en /login.');
  end if;

  select id into v_existing from public.user_memberships
  where user_id = v_user_id and role = 'super_admin';

  if v_existing is not null then
    update public.user_memberships set is_active = true, updated_at = now()
    where id = v_existing;
    return jsonb_build_object('success', true, 'action', 'reactivated', 'user_id', v_user_id, 'email', p_email);
  end if;

  insert into public.user_memberships(user_id, role, tenant_id, store_id, branch_id, is_active)
  values (v_user_id, 'super_admin', null, null, null, true);

  return jsonb_build_object('success', true, 'action', 'created', 'user_id', v_user_id, 'email', p_email);
end;
$$;

-- â”€â”€ FunciÃ³n para clonar catÃ¡logo â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
create or replace function public.clone_store_catalog(
  source_store_id text,
  target_store_id text
)
returns jsonb language plpgsql security definer as $$
declare
  existing_count integer;
begin
  select count(*) into existing_count from public.products where store_id = target_store_id;
  if existing_count > 0 then
    return jsonb_build_object('success', false, 'reason', 'La tienda destino ya tiene productos.');
  end if;

  -- Clonar topping_categories
  insert into public.topping_categories(store_id, name, sort_order, required, max_selections)
  select target_store_id, name, sort_order, required, max_selections
  from public.topping_categories where store_id = source_store_id;

  -- Clonar productos (sin toppings por simplicidad)
  insert into public.products(store_id, name, description, price, category, emoji, sort_order, available, is_active, tags)
  select target_store_id, name, description, price, category, emoji, sort_order, available, is_active, tags
  from public.products where store_id = source_store_id;

  -- Clonar combos
  insert into public.combos(store_id, name, description, price, emoji, sort_order, available, is_active, items)
  select target_store_id, name, description, price, emoji, sort_order, available, is_active, items
  from public.combos where store_id = source_store_id;

  return jsonb_build_object(
    'success', true,
    'source', source_store_id,
    'target', target_store_id
  );
end;
$$;

-- â”€â”€ FunciÃ³n chatbot: autorizar/revocar â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
create or replace function public.generate_chatbot_secret()
returns text language plpgsql security definer as $$
declare secret text; begin
  select encode(gen_random_bytes(24), 'hex') into secret;
  return secret;
end; $$;

create or replace function public.authorize_branch_chatbot(
  p_branch_id uuid, p_authorize boolean default true, p_note text default null
)
returns jsonb language plpgsql security definer as $$
declare v_branch public.branches%rowtype; v_secret text; v_action text;
begin
  if not public.is_super_admin() then
    raise exception 'Solo el Super Admin puede autorizar el chatbot portable';
  end if;
  select * into v_branch from public.branches where id = p_branch_id;
  if not found then raise exception 'Branch no encontrada'; end if;

  if p_authorize then
    v_secret := public.generate_chatbot_secret();
    v_action := 'authorized';
    update public.branches set
      chatbot_authorized = true, chatbot_authorized_at = now(),
      chatbot_authorized_by = auth.uid(), chatbot_store_id = v_branch.store_id,
      chatbot_wa_secret = v_secret
    where id = p_branch_id;
  else
    v_action := 'revoked';
    update public.branches set chatbot_authorized = false, chatbot_wa_secret = null
    where id = p_branch_id;
    v_secret := null;
  end if;

  insert into public.chatbot_authorization_log(branch_id, action, performed_by, note)
  values (p_branch_id, v_action, auth.uid(), p_note);

  return jsonb_build_object('authorized', p_authorize, 'branch_id', p_branch_id,
    'store_id', v_branch.store_id, 'wa_secret', v_secret, 'action', v_action);
end; $$;

create or replace function public.regenerate_chatbot_secret(p_branch_id uuid)
returns jsonb language plpgsql security definer as $$
declare v_secret text;
begin
  if not public.is_super_admin() then raise exception 'Solo el Super Admin'; end if;
  if not exists(select 1 from public.branches where id = p_branch_id and chatbot_authorized) then
    raise exception 'Branch no autorizada';
  end if;
  v_secret := public.generate_chatbot_secret();
  update public.branches set chatbot_wa_secret = v_secret where id = p_branch_id;
  insert into public.chatbot_authorization_log(branch_id, action, performed_by)
  values (p_branch_id, 'regenerated_secret', auth.uid());
  return jsonb_build_object('wa_secret', v_secret, 'branch_id', p_branch_id);
end; $$;

-- â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
-- SECCIÃ“N 3: RLS (Row Level Security)
-- â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

-- Habilitar RLS en tablas crÃ­ticas
alter table public.tenants            enable row level security;
alter table public.stores             enable row level security;
alter table public.branches           enable row level security;
alter table public.user_memberships   enable row level security;
alter table public.config_tienda      enable row level security;
alter table public.settings           enable row level security;
alter table public.store_settings     enable row level security;
alter table public.store_process_profiles enable row level security;
alter table public.store_runtime_profiles enable row level security;
alter table public.products           enable row level security;
alter table public.combos             enable row level security;
alter table public.toppings           enable row level security;
alter table public.topping_categories enable row level security;
alter table public.orders             enable row level security;
alter table public.stock_items        enable row level security;
alter table public.stock_item_products enable row level security;
alter table public.coupons            enable row level security;
alter table public.affiliates         enable row level security;
alter table public.affiliate_applications enable row level security;
alter table public.loyalty_rewards    enable row level security;
alter table public.reviews            enable row level security;
alter table public.staff_users        enable row level security;
alter table public.cash_entries       enable row level security;
alter table public.daily_sales_summary enable row level security;
alter table public.chatbot_conversations enable row level security;
alter table public.chatbot_notifications enable row level security;
alter table public.chatbot_portable_pings enable row level security;
alter table public.chatbot_authorization_log enable row level security;
alter table public.visitors           enable row level security;
alter table public.oxidian_checkout_sessions enable row level security;
alter table public.domain_mappings    enable row level security;
alter table public.account_activations enable row level security;
alter table public.store_niche_templates enable row level security;

-- PolÃ­tica global Super Admin en todas las tablas
do $$ declare t text;
begin for t in select unnest(array[
  'tenants','stores','branches','user_memberships','config_tienda','settings',
  'store_settings','store_process_profiles','store_runtime_profiles','products',
  'combos','toppings','topping_categories','orders','stock_items','stock_item_products',
  'coupons','affiliates','affiliate_applications','loyalty_rewards','reviews',
  'staff_users','cash_entries','daily_sales_summary','chatbot_conversations',
  'chatbot_notifications','chatbot_portable_pings','chatbot_authorization_log',
  'visitors','oxidian_checkout_sessions','domain_mappings','account_activations',
  'store_niche_templates'
]) loop
  execute format(
    'create policy %I on public.%I for all to authenticated
     using (public.is_super_admin()) with check (public.is_super_admin())',
    t || '_super_admin_all', t
  );
end loop; end $$;

-- PolÃ­ticas de scope para tablas con tenant_id
do $$ declare t text;
begin for t in select unnest(array[
  'config_tienda','settings','store_settings','store_process_profiles',
  'store_runtime_profiles','products','combos','toppings','topping_categories',
  'orders','stock_items','stock_item_products','coupons','affiliates',
  'affiliate_applications','loyalty_rewards','reviews','staff_users',
  'cash_entries','daily_sales_summary','chatbot_conversations','chatbot_notifications',
  'visitors','oxidian_checkout_sessions','domain_mappings','account_activations',
  'store_niche_templates'
]) loop
  execute format(
    'create policy %I on public.%I for all to authenticated
     using (public.can_access_scope(tenant_id, store_id, branch_id))
     with check (public.can_access_scope(tenant_id, store_id, branch_id))',
    t || '_scoped_manage', t
  );
end loop; end $$;

-- PolÃ­ticas especÃ­ficas para jerarquÃ­a
create policy tenants_self_read on public.tenants
  for select to authenticated using (public.can_access_scope(id, null, null));

create policy stores_public_read on public.stores
  for select to anon, authenticated
  using (public_visible = true and status in ('active','draft','paused'));

create policy stores_scoped_manage on public.stores
  for all to authenticated
  using (public.can_access_scope(tenant_id, id, null))
  with check (public.can_access_scope(tenant_id, id, null));

create policy branches_public_read on public.branches
  for select to anon, authenticated
  using (public_visible = true and status = 'active');

create policy branches_scoped_manage on public.branches
  for all to authenticated
  using (public.can_access_scope(tenant_id, store_id, id))
  with check (public.can_access_scope(tenant_id, store_id, id));

create policy user_memberships_own on public.user_memberships
  for all to authenticated
  using (user_id = auth.uid() or public.is_super_admin())
  with check (user_id = auth.uid() or public.is_super_admin());

-- Lectura pÃºblica del catÃ¡logo (clientes sin login)
create policy products_public_read on public.products
  for select to anon, authenticated
  using (available = true and is_active = true
    and exists(select 1 from public.stores s
      where s.id = products.store_id and s.public_visible = true and s.status = 'active'));

create policy combos_public_read on public.combos
  for select to anon, authenticated
  using (available = true and is_active = true
    and exists(select 1 from public.stores s
      where s.id = combos.store_id and s.public_visible = true and s.status = 'active'));

create policy toppings_public_read on public.toppings
  for select to anon, authenticated
  using (available = true and is_active = true
    and exists(select 1 from public.stores s
      where s.id = toppings.store_id and s.public_visible = true and s.status = 'active'));

create policy topping_cats_public_read on public.topping_categories
  for select to anon, authenticated
  using (exists(select 1 from public.stores s
    where s.id = topping_categories.store_id and s.public_visible = true and s.status = 'active'));

-- Account activations propias
create policy account_activations_own on public.account_activations
  for all to authenticated
  using (user_id = auth.uid() or public.is_super_admin())
  with check (user_id = auth.uid() or public.is_super_admin());

-- Chatbot pings: solo super_admin lee, el branch puede insertar
create policy chatbot_pings_super_admin on public.chatbot_portable_pings
  for all to authenticated using (public.is_super_admin()) with check (public.is_super_admin());
create policy chatbot_pings_insert on public.chatbot_portable_pings
  for insert to authenticated
  with check (public.can_access_scope(tenant_id, store_id, branch_id));

create policy chatbot_auth_log_super_admin on public.chatbot_authorization_log
  for all to authenticated using (public.is_super_admin()) with check (public.is_super_admin());

-- Store templates pÃºblicas
alter table public.store_templates enable row level security;
create policy store_templates_public_read on public.store_templates
  for select to anon, authenticated using (is_active = true);
create policy store_templates_super_admin on public.store_templates
  for all to authenticated using (public.is_super_admin()) with check (public.is_super_admin());

-- Store plans pÃºblicos
alter table public.store_plans enable row level security;
create policy store_plans_public_read on public.store_plans
  for select to anon, authenticated using (is_active = true);
create policy store_plans_super_admin on public.store_plans
  for all to authenticated using (public.is_super_admin()) with check (public.is_super_admin());

-- â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
-- SECCIÃ“N 4: DATOS INICIALES
-- â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

-- Templates de tienda
insert into public.store_templates(id, name, category, react_module_key, description, default_theme) values
(
  'delivery', 'Brutalist Delivery', 'food', 'delivery',
  'Template agresivo para restaurantes y conversiÃ³n rÃ¡pida.',
  '{"theme_primary_color":"#151515","theme_secondary_color":"#F4D85B","theme_accent_color":"#E55B2D","theme_surface_color":"#F7F0E7","theme_text_color":"#151515","theme_font_display":"Syne","theme_font_body":"Space Grotesk","theme_button_radius":"0px"}'::jsonb
),
(
  'vitrina', 'Luxury Vitrina', 'boutique', 'vitrina',
  'Template elegante para retail premium y catÃ¡logos curados.',
  '{"theme_primary_color":"#111111","theme_secondary_color":"#1F1B17","theme_accent_color":"#D2B48C","theme_surface_color":"#F5EEE4","theme_text_color":"#161616","theme_font_display":"Fraunces","theme_font_body":"DM Sans","theme_button_radius":"8px"}'::jsonb
),
(
  'portfolio', 'Retro Neon', 'food', 'portfolio',
  'Template con identidad fuerte para marcas audaces.',
  '{"theme_primary_color":"#9B2CFF","theme_secondary_color":"#1A1038","theme_accent_color":"#FF4FD8","theme_surface_color":"#130B2B","theme_text_color":"#F7F3FF","theme_font_display":"Syne","theme_font_body":"IBM Plex Sans","theme_button_radius":"18px"}'::jsonb
),
(
  'minimal', 'Zen Commerce', 'wellness', 'minimal',
  'Template limpio y silencioso para compras guiadas.',
  '{"theme_primary_color":"#5C6B5E","theme_secondary_color":"#DCCEB8","theme_accent_color":"#9C7B5B","theme_surface_color":"#F3F0E8","theme_text_color":"#273127","theme_font_display":"Libre Baskerville","theme_font_body":"Outfit","theme_button_radius":"999px"}'::jsonb
)
on conflict(id) do update set
  name = excluded.name, category = excluded.category,
  default_theme = excluded.default_theme, updated_at = now();

-- Planes disponibles
insert into public.store_plans(id, name, description, monthly_price, sort_order) values
  ('starter',  'Starter',  'Plan bÃ¡sico para empezar',     0,   0),
  ('growth',   'Growth',   'Plan de crecimiento',          49,  1),
  ('pro',      'Pro',      'Plan profesional completo',    99,  2),
  ('enterprise','Enterprise','Plan para grandes operaciones',299, 3)
on conflict(id) do update set name = excluded.name, monthly_price = excluded.monthly_price;

-- Config tienda 'default' (compatibilidad legacy)
insert into public.config_tienda(id) values ('default')
on conflict(id) do nothing;

-- Settings globales mÃ­nimos
insert into public.settings(key, value) values
  ('business_name', 'Mi tienda'),
  ('tagline', 'Compra fÃ¡cil, entrega clara'),
  ('open_hour', '10'),
  ('close_hour', '22')
on conflict(key) do nothing;

-- â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
-- SECCIÃ“N 5: VISTA DE AUDITORÃA
-- â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

create or replace view public.v_users_memberships as
select
  u.id as user_id, u.email, u.created_at as registered_at,
  m.id as membership_id, m.role, m.tenant_id, m.store_id, m.branch_id,
  m.is_active, t.name as tenant_name, b.name as branch_name
from auth.users u
left join public.user_memberships m on m.user_id = u.id and m.is_active = true
left join public.tenants t on t.id = m.tenant_id
left join public.branches b on b.id = m.branch_id
order by u.created_at desc;

-- â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
-- FIN DEL SCRIPT
-- â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
-- PRÃ“XIMOS PASOS OBLIGATORIOS:
--
-- 1. Ejecutar este SQL en Supabase Dashboard â†’ SQL Editor
--
-- 2. Registrar el JWT hook:
--    Authentication â†’ Hooks â†’ Custom JWT claims
--    â†’ postgresql â†’ public â†’ custom_jwt_claims
--
-- 3. Crear tu cuenta de Super Admin:
--    a) Ve a /login y regÃ­strate con tu email
--    b) En SQL Editor ejecuta:
--       SELECT public.make_super_admin('tu@email.com');
--    c) Cierra sesiÃ³n y vuelve a entrar
--
-- 4. Desde /admin crea tu primer Tenant â†’ Store â†’ Branch
-- â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•


-- ============================================================
-- 0005_testing_readiness.sql
-- ============================================================


-- ============================================================
-- 0005_testing_readiness.sql
-- Correccion canonica del dominio SaaS, pipeline y modulos
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

-- Si quedo una tabla saas_plans de una iteracion anterior, se elimina despues
-- de consolidar la relacion canonica sobre store_plans.

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
  'Perfil operativo canonico creado por 0005_testing_readiness.sql'
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


-- ============================================================
-- 0006_fix_rls_auth_errors.sql
-- ============================================================


-- ============================================================
-- OXIDIAN SAAS â€” MigraciÃ³n 0006
-- Arregla 3 bugs de autenticaciÃ³n detectados en consola:
--
-- BUG 1: user_memberships no tiene polÃ­tica self-read
--   â†’ Usuario autenticado recibe 403 al leer su propia membresÃ­a
--   â†’ AuthProvider nunca obtiene el role correcto post-login
--
-- BUG 2: settings/config_tienda/stores sin polÃ­tica pÃºblica
--   â†’ Cualquier query con storeId='default' recibe 401/403
--   â†’ La tienda legacy no tiene tenant_id, then can_access_scope() falla
--
-- BUG 3: store_process_profiles sin polÃ­tica pÃºblica
--   â†’ Igual que BUG 2
-- ============================================================

begin;

-- â”€â”€â”€ BUG 1: user_memberships â€” self read â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
-- Un usuario autenticado debe poder leer SU PROPIA membresÃ­a.
-- Sin esto, AuthProvider.loadMembership() siempre devuelve null.

drop policy if exists user_memberships_self_read on public.user_memberships;
create policy user_memberships_self_read
  on public.user_memberships
  for select
  to authenticated
  using (user_id = auth.uid());

-- â”€â”€â”€ BUG 2 & 3: Tablas legacy con tenant_id NULL â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
-- Las filas de la tienda "default" tienen tenant_id IS NULL,
-- por lo que can_access_scope(null, ...) devuelve false siempre.
-- Necesitamos una polÃ­tica pÃºblica de lectura para filas sin scope.

-- settings (tabla global de configuraciÃ³n pÃºblica)
drop policy if exists settings_public_read on public.settings;
create policy settings_public_read
  on public.settings
  for select
  to anon, authenticated
  using (tenant_id is null and store_id is null);

-- config_tienda (configuraciÃ³n de la tienda default)
drop policy if exists config_tienda_public_read on public.config_tienda;
create policy config_tienda_public_read
  on public.config_tienda
  for select
  to anon, authenticated
  using (tenant_id is null and store_id is null);

-- stores (la tienda "default" con public_visible=true)
-- Nota: ya existe stores_public_read para anon/authenticated,
-- pero solo permite status in ('active','draft','paused').
-- La tienda legacy puede tener status NULL â€” lo cubrimos aquÃ­.
drop policy if exists stores_legacy_public_read on public.stores;
create policy stores_legacy_public_read
  on public.stores
  for select
  to anon, authenticated
  using (public_visible = true and tenant_id is null);

-- store_process_profiles (perfil operativo de la tienda default)
drop policy if exists store_process_profiles_public_read on public.store_process_profiles;
create policy store_process_profiles_public_read
  on public.store_process_profiles
  for select
  to anon, authenticated
  using (tenant_id is null and store_id is null);

commit;

-- ============================================================
-- POST-MIGRACIÃ“N:
-- Ejecutar este archivo en Supabase SQL Editor o con:
--   supabase db push
--
-- No requiere cambios en Dashboard ni reinicio de sesiÃ³n.
-- Los errores 401/403 desaparecerÃ¡n inmediatamente.
-- ============================================================
