-- ============================================================
-- 0014_orders_and_staff_rls.sql  (v2 — completamente defensiva)
-- RLS para orders, products, staff_users, coupons, reviews,
-- categories, branches, stores.
-- Cada bloque verifica si la tabla existe antes de actuar.
-- ============================================================

begin;

-- ─── Helper interno: elimina todas las políticas de una tabla ─────
-- (ejecuta solo si la tabla existe)

-- ─── ORDERS ──────────────────────────────────────────────────────
DO $$ DECLARE pol RECORD;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='orders') THEN
    RETURN;
  END IF;
  FOR pol IN SELECT policyname FROM pg_policies WHERE tablename='orders' AND schemaname='public'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.orders', pol.policyname);
  END LOOP;
  EXECUTE $p$
    CREATE POLICY orders_super_admin_all ON public.orders FOR ALL TO authenticated
      USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());
  $p$;
  EXECUTE $p$
    CREATE POLICY orders_scope_read ON public.orders FOR SELECT TO authenticated
      USING (public.can_access_scope(tenant_id, store_id::text, branch_id));
  $p$;
  EXECUTE $p$
    CREATE POLICY orders_scope_write ON public.orders FOR ALL TO authenticated
      USING (public.can_access_scope(tenant_id, store_id::text, branch_id))
      WITH CHECK (public.can_access_scope(tenant_id, store_id::text, branch_id));
  $p$;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'orders RLS skip: %', SQLERRM;
END $$;

-- ─── PRODUCTS ────────────────────────────────────────────────────
DO $$ DECLARE pol RECORD;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='products') THEN
    RETURN;
  END IF;
  FOR pol IN SELECT policyname FROM pg_policies WHERE tablename='products' AND schemaname='public'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.products', pol.policyname);
  END LOOP;
  -- Lectura pública del menú
  EXECUTE $p$
    CREATE POLICY products_public_read ON public.products FOR SELECT TO anon, authenticated
      USING (
        is_active = true
        AND EXISTS (
          SELECT 1 FROM public.stores s
          WHERE s.id = products.store_id AND s.public_visible = true
        )
      );
  $p$;
  -- Gestión por scope (owners, admins)
  EXECUTE $p$
    CREATE POLICY products_scope_manage ON public.products FOR ALL TO authenticated
      USING (public.can_access_scope(tenant_id, store_id::text, NULL))
      WITH CHECK (public.can_access_scope(tenant_id, store_id::text, NULL));
  $p$;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'products RLS skip: %', SQLERRM;
END $$;

-- ─── STAFF_USERS ─────────────────────────────────────────────────
DO $$ DECLARE pol RECORD;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='staff_users') THEN
    RETURN;
  END IF;
  FOR pol IN SELECT policyname FROM pg_policies WHERE tablename='staff_users' AND schemaname='public'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.staff_users', pol.policyname);
  END LOOP;
  EXECUTE $p$
    CREATE POLICY staff_users_scope ON public.staff_users FOR ALL TO authenticated
      USING (public.can_access_scope(tenant_id, store_id::text, branch_id))
      WITH CHECK (public.can_access_scope(tenant_id, store_id::text, branch_id));
  $p$;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'staff_users RLS skip: %', SQLERRM;
END $$;

-- ─── COUPONS ─────────────────────────────────────────────────────
DO $$ DECLARE pol RECORD;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='coupons') THEN
    RETURN;
  END IF;
  FOR pol IN SELECT policyname FROM pg_policies WHERE tablename='coupons' AND schemaname='public'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.coupons', pol.policyname);
  END LOOP;
  EXECUTE $p$
    CREATE POLICY coupons_scope ON public.coupons FOR ALL TO authenticated
      USING (public.can_access_scope(tenant_id, store_id::text, NULL))
      WITH CHECK (public.can_access_scope(tenant_id, store_id::text, NULL));
  $p$;
  EXECUTE $p$
    CREATE POLICY coupons_public_read ON public.coupons FOR SELECT TO anon
      USING (
        is_active = true
        AND EXISTS (
          SELECT 1 FROM public.stores s
          WHERE s.id = coupons.store_id AND s.status = 'active' AND s.public_visible = true
        )
      );
  $p$;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'coupons RLS skip: %', SQLERRM;
END $$;

-- ─── REVIEWS ─────────────────────────────────────────────────────
DO $$ DECLARE pol RECORD;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='reviews') THEN
    RETURN;
  END IF;
  FOR pol IN SELECT policyname FROM pg_policies WHERE tablename='reviews' AND schemaname='public'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.reviews', pol.policyname);
  END LOOP;
  EXECUTE $p$
    CREATE POLICY reviews_scope_manage ON public.reviews FOR ALL TO authenticated
      USING (public.can_access_scope(tenant_id, store_id::text, NULL))
      WITH CHECK (public.can_access_scope(tenant_id, store_id::text, NULL));
  $p$;
  EXECUTE $p$
    CREATE POLICY reviews_public_read ON public.reviews FOR SELECT TO anon
      USING (
        approved = true
        AND EXISTS (
          SELECT 1 FROM public.stores s
          WHERE s.id = reviews.store_id AND s.status = 'active' AND s.public_visible = true
        )
      );
  $p$;
  EXECUTE $p$
    CREATE POLICY reviews_public_insert ON public.reviews FOR INSERT TO anon
      WITH CHECK (
        store_id IS NOT NULL
        AND EXISTS (
          SELECT 1 FROM public.stores s
          WHERE s.id = reviews.store_id AND s.status = 'active' AND s.public_visible = true
        )
      );
  $p$;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'reviews RLS skip: %', SQLERRM;
END $$;

-- ─── CATEGORIES ──────────────────────────────────────────────────
DO $$ DECLARE pol RECORD;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='categories') THEN
    RETURN;
  END IF;
  FOR pol IN SELECT policyname FROM pg_policies WHERE tablename='categories' AND schemaname='public'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.categories', pol.policyname);
  END LOOP;
  EXECUTE $p$
    CREATE POLICY categories_public_read ON public.categories FOR SELECT TO anon, authenticated
      USING (
        is_active = true
        AND EXISTS (
          SELECT 1 FROM public.stores s
          WHERE s.id = categories.store_id AND s.status = 'active' AND s.public_visible = true
        )
      );
  $p$;
  EXECUTE $p$
    CREATE POLICY categories_scope_manage ON public.categories FOR ALL TO authenticated
      USING (public.can_access_scope(tenant_id, store_id::text, NULL))
      WITH CHECK (public.can_access_scope(tenant_id, store_id::text, NULL));
  $p$;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'categories RLS skip: %', SQLERRM;
END $$;

-- ─── STOCK_ITEMS ─────────────────────────────────────────────────
DO $$ DECLARE pol RECORD;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='stock_items') THEN
    RETURN;
  END IF;
  FOR pol IN SELECT policyname FROM pg_policies WHERE tablename='stock_items' AND schemaname='public'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.stock_items', pol.policyname);
  END LOOP;
  EXECUTE $p$
    CREATE POLICY stock_items_scope ON public.stock_items FOR ALL TO authenticated
      USING (public.can_access_scope(tenant_id, store_id::text, NULL))
      WITH CHECK (public.can_access_scope(tenant_id, store_id::text, NULL));
  $p$;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'stock_items RLS skip: %', SQLERRM;
END $$;

-- ─── BRANCHES — lectura pública ───────────────────────────────────
DO $$ BEGIN
  DROP POLICY IF EXISTS branches_public_read ON public.branches;
  CREATE POLICY branches_public_read ON public.branches FOR SELECT TO anon, authenticated
    USING (status = 'active' AND public_visible = true);

  DROP POLICY IF EXISTS branches_scope_manage ON public.branches;
  CREATE POLICY branches_scope_manage ON public.branches FOR ALL TO authenticated
    USING (public.can_access_scope(tenant_id, store_id::text, id))
    WITH CHECK (public.can_access_scope(tenant_id, store_id::text, id));
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'branches RLS skip: %', SQLERRM;
END $$;

-- ─── STORES — escritura para owners ───────────────────────────────
DO $$ BEGIN
  DROP POLICY IF EXISTS stores_scope_manage ON public.stores;
  CREATE POLICY stores_scope_manage ON public.stores FOR ALL TO authenticated
    USING (public.can_access_scope(tenant_id, id, NULL))
    WITH CHECK (public.can_access_scope(tenant_id, id, NULL));
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'stores RLS skip: %', SQLERRM;
END $$;

-- ─── STORE_PROCESS_PROFILES ───────────────────────────────────────
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='store_process_profiles') THEN
    RETURN;
  END IF;
  DROP POLICY IF EXISTS store_process_profiles_scope_read  ON public.store_process_profiles;
  DROP POLICY IF EXISTS store_process_profiles_scope_write ON public.store_process_profiles;
  DROP POLICY IF EXISTS store_process_profiles_public_read ON public.store_process_profiles;

  CREATE POLICY store_process_profiles_public_read ON public.store_process_profiles
    FOR SELECT TO anon, authenticated
    USING (tenant_id IS NULL OR public.can_access_scope(tenant_id, store_id::text, NULL));

  CREATE POLICY store_process_profiles_scope_write ON public.store_process_profiles
    FOR ALL TO authenticated
    USING (public.can_access_scope(tenant_id, store_id::text, NULL))
    WITH CHECK (public.can_access_scope(tenant_id, store_id::text, NULL));
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'store_process_profiles RLS skip: %', SQLERRM;
END $$;

-- ─── Verificación final ───────────────────────────────────────────
SELECT tablename, count(*) AS policies
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN (
    'orders','products','staff_users','coupons',
    'reviews','categories','branches','stores','store_process_profiles'
  )
GROUP BY tablename
ORDER BY tablename;

commit;
