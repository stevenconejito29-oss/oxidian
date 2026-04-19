-- ================================================================
-- OXIDIAN SAAS — SETUP COMPLETO DESDE CERO
-- Ejecutar en: Supabase Dashboard → SQL Editor
-- BORRA TODO y recrea limpio. Verificado contra el código real.
-- ================================================================

-- ── 0. BORRAR TODO LO EXISTENTE ─────────────────────────────────
do $$ declare
  r record;
begin
  -- Eliminar todas las políticas RLS
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

  -- Eliminar todas las tablas del schema público
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

-- ── 1. EXTENSIONES ───────────────────────────────────────────────
create extension if not exists pgcrypto;

-- ── 2. TIPOS ENUM ────────────────────────────────────────────────
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

-- ── 3. TABLAS DE JERARQUÍA ───────────────────────────────────────

-- 3.1 Tenants (dueños de negocio que pagan el SaaS)
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
  id                  text primary key,          -- slug-style, ej: "carmocream"
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

-- 3.5 Membresías de usuario (control de acceso)
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

-- ── 4. CONFIGURACIÓN ─────────────────────────────────────────────

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
  -- Módulos
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

-- ── 5. CATÁLOGO ──────────────────────────────────────────────────

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
  emoji                   text default '🍽️',
  sort_order              integer default 0,
  available               boolean not null default true,   -- visibilidad pública
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

-- 5.2 Categorías de toppings
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
  emoji       text default '🎁',
  sort_order  integer default 0,
  available   boolean not null default true,
  is_active   boolean not null default true,
  combo_slots jsonb default '[]',   -- slots configurables
  items       jsonb default '[]',   -- ítems directos
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index combos_store_idx on public.combos(store_id);

-- ── 6. PEDIDOS ───────────────────────────────────────────────────
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

-- ── 7. STOCK ─────────────────────────────────────────────────────
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

-- ── 8. MARKETING ─────────────────────────────────────────────────

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

-- ── 9. FIDELIDAD ─────────────────────────────────────────────────
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

-- ── 10. RESEÑAS ──────────────────────────────────────────────────
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

-- ── 11. STAFF ────────────────────────────────────────────────────
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

-- ── 12. PLANES ───────────────────────────────────────────────────
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

-- ── 13. FINANZAS ─────────────────────────────────────────────────
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

-- ── 14. CHATBOT ───────────────────────────────────────────────────
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

-- ── 15. VISITANTES / ANALYTICS ───────────────────────────────────
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

-- ── 16. CHECKOUT SESSIONS ─────────────────────────────────────────
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

-- ── 17. DOMAIN MAPPINGS ───────────────────────────────────────────
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

-- ── 18. ACCOUNT ACTIVATIONS ──────────────────────────────────────
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

-- ── 19. LANDING REQUESTS (leads del formulario público) ──────────
create table public.landing_requests (
  id              uuid primary key default gen_random_uuid(),
  full_name       text,
  email           text,
  phone           text,
  business_name   text,
  business_niche  text,
  city            text,
  message         text,
  source          text default 'landing',
  status          text not null default 'pending'
                    check (status in ('pending','contacted','demo_scheduled','onboarding','converted','rejected','ghosted')),
  contacted_at    timestamptz,
  converted_at    timestamptz,
  updated_at      timestamptz not null default now(),
  created_at      timestamptz not null default now()
);

-- ── 20. TENANT SUBSCRIPTIONS (plan SaaS por tenant) ──────────────
create table public.tenant_subscriptions (
  id                     uuid primary key default gen_random_uuid(),
  tenant_id              uuid not null references public.tenants(id) on delete cascade,
  plan_id                text not null default 'growth',
  status                 text not null default 'active'
                           check (status in ('active','cancelled','past_due','trialing')),
  current_period_end     timestamptz,
  stripe_subscription_id text,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),
  unique (tenant_id)
);

-- ══════════════════════════════════════════════════════════════════
-- SECCIÓN 2: FUNCIONES DE SEGURIDAD
-- ══════════════════════════════════════════════════════════════════

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
returns boolean language sql stable security definer set search_path = public as $$
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
returns boolean language sql stable security definer set search_path = public as $$
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

-- ── JWT Claims Hook ───────────────────────────────────────────────
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

-- ── Función para asignar Super Admin ─────────────────────────────
create or replace function public.make_super_admin(p_email text)
returns jsonb language plpgsql security definer as $$
declare
  v_user_id uuid;
  v_existing uuid;
begin
  select id into v_user_id from auth.users
  where email = lower(trim(p_email)) limit 1;

  if v_user_id is null then
    return jsonb_build_object('success', false, 'error', 'Usuario no encontrado. Regístrate primero en /login.');
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

-- ── Función para clonar catálogo ──────────────────────────────────
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

-- ── Función chatbot: autorizar/revocar ────────────────────────────
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

-- ══════════════════════════════════════════════════════════════════
-- SECCIÓN 3: RLS (Row Level Security)
-- ══════════════════════════════════════════════════════════════════

-- Habilitar RLS en tablas críticas
alter table public.landing_requests       enable row level security;
alter table public.tenant_subscriptions   enable row level security;
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

-- Política global Super Admin en todas las tablas
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

-- Políticas de scope para tablas con tenant_id
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

-- Políticas específicas para jerarquía
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

-- user_memberships: dos políticas sin recursión
-- 1. Cada usuario lee sus propias filas (sin llamar funciones externas)
create policy user_memberships_own_read on public.user_memberships
  for select to authenticated
  using (user_id = auth.uid());
-- 2. Super admin puede todo (is_super_admin es SECURITY DEFINER, no recursa)
create policy user_memberships_super_admin_all on public.user_memberships
  for all to authenticated
  using (public.is_super_admin()) with check (public.is_super_admin());

-- landing_requests: super_admin gestiona, anon puede insertar
create policy landing_requests_super_admin on public.landing_requests
  for all to authenticated using (public.is_super_admin()) with check (public.is_super_admin());
create policy landing_requests_public_insert on public.landing_requests
  for insert to anon, authenticated with check (true);

-- tenant_subscriptions: scoped por tenant
create policy tenant_subscriptions_super_admin on public.tenant_subscriptions
  for all to authenticated using (public.is_super_admin()) with check (public.is_super_admin());
create policy tenant_subscriptions_scoped on public.tenant_subscriptions
  for select to authenticated using (public.can_access_scope(tenant_id, null, null));

-- Lectura pública del catálogo (clientes sin login)
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

-- Store templates públicas
alter table public.store_templates enable row level security;
create policy store_templates_public_read on public.store_templates
  for select to anon, authenticated using (is_active = true);
create policy store_templates_super_admin on public.store_templates
  for all to authenticated using (public.is_super_admin()) with check (public.is_super_admin());

-- Store plans públicos
alter table public.store_plans enable row level security;
create policy store_plans_public_read on public.store_plans
  for select to anon, authenticated using (is_active = true);
create policy store_plans_super_admin on public.store_plans
  for all to authenticated using (public.is_super_admin()) with check (public.is_super_admin());

-- ══════════════════════════════════════════════════════════════════
-- SECCIÓN 4: DATOS INICIALES
-- ══════════════════════════════════════════════════════════════════

-- Templates de tienda
insert into public.store_templates(id, name, category, react_module_key, description, default_theme) values
(
  'delivery', 'Brutalist Delivery', 'food', 'delivery',
  'Template agresivo para restaurantes y conversión rápida.',
  '{"theme_primary_color":"#151515","theme_secondary_color":"#F4D85B","theme_accent_color":"#E55B2D","theme_surface_color":"#F7F0E7","theme_text_color":"#151515","theme_font_display":"Syne","theme_font_body":"Space Grotesk","theme_button_radius":"0px"}'::jsonb
),
(
  'vitrina', 'Luxury Vitrina', 'boutique', 'vitrina',
  'Template elegante para retail premium y catálogos curados.',
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
  ('starter',  'Starter',  'Plan básico para empezar',     0,   0),
  ('growth',   'Growth',   'Plan de crecimiento',          49,  1),
  ('pro',      'Pro',      'Plan profesional completo',    99,  2),
  ('enterprise','Enterprise','Plan para grandes operaciones',299, 3)
on conflict(id) do update set name = excluded.name, monthly_price = excluded.monthly_price;

-- Config tienda 'default' (compatibilidad legacy)
insert into public.config_tienda(id) values ('default')
on conflict(id) do nothing;

-- Settings globales mínimos
insert into public.settings(key, value) values
  ('business_name', 'Mi tienda'),
  ('tagline', 'Compra fácil, entrega clara'),
  ('open_hour', '10'),
  ('close_hour', '22')
on conflict(key) do nothing;

-- ══════════════════════════════════════════════════════════════════
-- SECCIÓN 5: VISTA DE AUDITORÍA
-- ══════════════════════════════════════════════════════════════════

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

-- ══════════════════════════════════════════════════════════════════
-- FIN DEL SCRIPT
-- ══════════════════════════════════════════════════════════════════
-- PRÓXIMOS PASOS OBLIGATORIOS:
--
-- 1. Ejecutar este SQL en Supabase Dashboard → SQL Editor
--
-- 2. Registrar el JWT hook:
--    Authentication → Hooks → Custom JWT claims
--    → postgresql → public → custom_jwt_claims
--
-- 3. Crear tu cuenta de Super Admin:
--    a) Ve a /login y regístrate con tu email
--    b) En SQL Editor ejecuta:
--       SELECT public.make_super_admin('tu@email.com');
--    c) Cierra sesión y vuelve a entrar
--
-- 4. Desde /admin crea tu primer Tenant → Store → Branch
-- ══════════════════════════════════════════════════════════════════
