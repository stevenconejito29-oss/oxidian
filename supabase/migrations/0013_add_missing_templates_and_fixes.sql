-- ============================================================
-- 0013_add_missing_templates_and_fixes.sql  (v2 — defensiva)
-- Ejecutar en Supabase SQL Editor
-- ============================================================

begin;

-- 1. Templates faltantes en store_templates (booking y express)
INSERT INTO public.store_templates (id, name, category, react_module_key, description, default_theme)
VALUES
  (
    'booking',
    'Citas & Servicios',
    'services',
    'booking',
    'Template para barberías, salones y servicios con citas.',
    jsonb_build_object(
      'theme_primary_color',   '#7c3aed',
      'theme_secondary_color', '#a78bfa',
      'theme_accent_color',    '#10b981',
      'theme_surface_color',   '#fdf4ff',
      'theme_text_color',      '#1e1b4b',
      'theme_font_display',    'Syne',
      'theme_font_body',       'DM Sans',
      'theme_button_radius',   '12px'
    )
  ),
  (
    'express',
    'Carta Express QR',
    'food',
    'express',
    'Lista ultracompacta para escanear en mesa. Sin imágenes.',
    jsonb_build_object(
      'theme_primary_color',   '#111111',
      'theme_secondary_color', '#374151',
      'theme_accent_color',    '#f59e0b',
      'theme_surface_color',   '#ffffff',
      'theme_text_color',      '#111111',
      'theme_font_display',    'DM Sans',
      'theme_font_body',       'DM Sans',
      'theme_button_radius',   '8px'
    )
  )
ON CONFLICT (id) DO UPDATE SET
  name             = excluded.name,
  category         = excluded.category,
  react_module_key = excluded.react_module_key,
  description      = excluded.description,
  default_theme    = excluded.default_theme,
  is_active        = true,
  updated_at       = timezone('utc', now());

-- 2. Columnas extra en stores
ALTER TABLE public.stores
  ADD COLUMN IF NOT EXISTS niche         text,
  ADD COLUMN IF NOT EXISTS business_type text,
  ADD COLUMN IF NOT EXISTS city          text,
  ADD COLUMN IF NOT EXISTS currency      text NOT NULL DEFAULT 'EUR',
  ADD COLUMN IF NOT EXISTS owner_email   text,
  ADD COLUMN IF NOT EXISTS owner_name    text,
  ADD COLUMN IF NOT EXISTS notes         text,
  ADD COLUMN IF NOT EXISTS emoji         text,
  ADD COLUMN IF NOT EXISTS modules       jsonb NOT NULL DEFAULT '[]'::jsonb;

-- status puede ya existir con diferente constraint
ALTER TABLE public.stores ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active';

-- 3. Columnas extra en branches
ALTER TABLE public.branches ADD COLUMN IF NOT EXISTS last_seen_at timestamptz;

-- 4. Columna tenant_id en orders (si no existe)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='orders' AND column_name='tenant_id'
  ) THEN
    ALTER TABLE public.orders ADD COLUMN tenant_id uuid;
  END IF;
END $$;

-- 5. Columna order_number en orders (si no existe)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='orders' AND column_name='order_number'
  ) THEN
    ALTER TABLE public.orders ADD COLUMN order_number integer;
  END IF;
END $$;

-- 6. Columnas extra en staff_users
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='staff_users' AND column_name='is_online'
  ) THEN
    ALTER TABLE public.staff_users ADD COLUMN is_online boolean NOT NULL DEFAULT false;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='staff_users' AND column_name='last_seen_at'
  ) THEN
    ALTER TABLE public.staff_users ADD COLUMN last_seen_at timestamptz;
  END IF;
END $$;

-- 7. Tabla categories (si no existe)
CREATE TABLE IF NOT EXISTS public.categories (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id    text NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  tenant_id   uuid REFERENCES public.tenants(id) ON DELETE CASCADE,
  name        text NOT NULL,
  description text,
  image_url   text,
  sort_order  integer NOT NULL DEFAULT 0,
  category_type text NOT NULL DEFAULT 'product',
  is_active   boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;

-- 8. Tabla products (asegura columnas clave si existe, o la crea básica)
DO $$ BEGIN
  -- Si products existe, solo añadir columnas faltantes
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='products') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='products' AND column_name='emoji') THEN
      ALTER TABLE public.products ADD COLUMN emoji text;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='products' AND column_name='is_active') THEN
      ALTER TABLE public.products ADD COLUMN is_active boolean NOT NULL DEFAULT true;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='products' AND column_name='out_of_stock') THEN
      ALTER TABLE public.products ADD COLUMN out_of_stock boolean NOT NULL DEFAULT false;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='products' AND column_name='sort_order') THEN
      ALTER TABLE public.products ADD COLUMN sort_order integer NOT NULL DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='products' AND column_name='category_id') THEN
      ALTER TABLE public.products ADD COLUMN category_id uuid REFERENCES public.categories(id) ON DELETE SET NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='products' AND column_name='tenant_id') THEN
      ALTER TABLE public.products ADD COLUMN tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='products' AND column_name='is_featured') THEN
      ALTER TABLE public.products ADD COLUMN is_featured boolean NOT NULL DEFAULT false;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='products' AND column_name='track_stock') THEN
      ALTER TABLE public.products ADD COLUMN track_stock boolean NOT NULL DEFAULT false;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='products' AND column_name='stock_quantity') THEN
      ALTER TABLE public.products ADD COLUMN stock_quantity integer DEFAULT 0;
    END IF;
  ELSE
    -- Crear tabla products desde cero
    CREATE TABLE public.products (
      id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      store_id                 text NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
      tenant_id                uuid REFERENCES public.tenants(id) ON DELETE CASCADE,
      category_id              uuid REFERENCES public.categories(id) ON DELETE SET NULL,
      name                     text NOT NULL,
      description              text,
      price                    numeric(10,2) NOT NULL DEFAULT 0,
      compare_price            numeric(10,2),
      image_url                text,
      emoji                    text,
      sort_order               integer NOT NULL DEFAULT 0,
      is_active                boolean NOT NULL DEFAULT true,
      is_featured              boolean NOT NULL DEFAULT false,
      out_of_stock             boolean NOT NULL DEFAULT false,
      track_stock              boolean NOT NULL DEFAULT false,
      stock_quantity           integer DEFAULT 0,
      service_duration_minutes integer,
      has_variants             boolean NOT NULL DEFAULT false,
      variants                 jsonb,
      modifiers                jsonb,
      tags                     text[],
      created_at               timestamptz NOT NULL DEFAULT now(),
      updated_at               timestamptz NOT NULL DEFAULT now()
    );
    ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;

-- 9. Tabla coupons (si no existe)
CREATE TABLE IF NOT EXISTS public.coupons (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id    text NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  tenant_id   uuid REFERENCES public.tenants(id) ON DELETE CASCADE,
  code        text NOT NULL,
  type        text NOT NULL DEFAULT 'percentage' CHECK (type IN ('percentage','fixed','free_delivery')),
  value       numeric(10,2) NOT NULL DEFAULT 0,
  min_order   numeric(10,2) NOT NULL DEFAULT 0,
  description text,
  is_active   boolean NOT NULL DEFAULT true,
  uses_count  integer NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (store_id, code)
);

ALTER TABLE public.coupons ENABLE ROW LEVEL SECURITY;

-- 10. Tabla reviews (si no existe)
CREATE TABLE IF NOT EXISTS public.reviews (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id      text NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  tenant_id     uuid REFERENCES public.tenants(id) ON DELETE CASCADE,
  customer_name text,
  rating        integer NOT NULL DEFAULT 5 CHECK (rating BETWEEN 1 AND 5),
  comment       text,
  approved      boolean NOT NULL DEFAULT false,
  created_at    timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;

-- 11. Tabla stock_items (si no existe)
CREATE TABLE IF NOT EXISTS public.stock_items (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id     text NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  tenant_id    uuid REFERENCES public.tenants(id) ON DELETE CASCADE,
  name         text NOT NULL,
  quantity     numeric(10,2) NOT NULL DEFAULT 0,
  min_quantity numeric(10,2) NOT NULL DEFAULT 0,
  unit         text,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.stock_items ENABLE ROW LEVEL SECURITY;

-- 12. Backfills
UPDATE public.stores  SET slug = id              WHERE slug IS NULL OR slug = '';
UPDATE public.branches SET slug = 'principal'    WHERE slug IS NULL OR slug = '';

-- 13. Backfill tenant_subscriptions
INSERT INTO public.tenant_subscriptions (tenant_id, plan_id, status)
SELECT t.id, 'growth', 'active'
FROM public.tenants t
WHERE NOT EXISTS (
  SELECT 1 FROM public.tenant_subscriptions ts WHERE ts.tenant_id = t.id
)
ON CONFLICT (tenant_id) DO NOTHING;

-- 14. Verificación
SELECT
  (SELECT count(*) FROM public.store_templates)     AS templates,
  (SELECT count(*) FROM public.tenants)             AS tenants,
  (SELECT count(*) FROM public.stores)              AS stores,
  (SELECT count(*) FROM public.branches)            AS branches,
  (SELECT count(*) FROM public.tenant_subscriptions) AS subs;

commit;
