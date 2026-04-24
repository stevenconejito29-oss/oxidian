-- ============================================================
-- 0016_branch_operations_support.sql
-- Endurece operaciones de sucursal: staff notes, combos, caja,
-- toppings y tablas operativas que deben quedar con scope.
-- ============================================================

begin;

alter table public.staff_users
  add column if not exists notes text;

do $$ declare pol record;
begin
  if exists (select 1 from pg_tables where schemaname = 'public' and tablename = 'combos') then
    for pol in
      select policyname from pg_policies where schemaname = 'public' and tablename = 'combos'
    loop
      execute format('drop policy if exists %I on public.combos', pol.policyname);
    end loop;

    execute $p$
      create policy combos_scope_manage on public.combos for all to authenticated
        using (public.can_access_scope(tenant_id, store_id::text, branch_id))
        with check (public.can_access_scope(tenant_id, store_id::text, branch_id));
    $p$;

    execute $p$
      create policy combos_public_read on public.combos for select to anon, authenticated
        using (
          available = true
          and is_active = true
          and exists (
            select 1
            from public.stores s
            where s.id = combos.store_id
              and s.status = 'active'
              and s.public_visible = true
          )
        );
    $p$;
  end if;
exception when others then
  raise notice 'combos scope skip: %', sqlerrm;
end $$;

do $$ declare pol record;
begin
  if exists (select 1 from pg_tables where schemaname = 'public' and tablename = 'toppings') then
    for pol in
      select policyname from pg_policies where schemaname = 'public' and tablename = 'toppings'
    loop
      execute format('drop policy if exists %I on public.toppings', pol.policyname);
    end loop;

    execute $p$
      create policy toppings_scope_manage on public.toppings for all to authenticated
        using (public.can_access_scope(tenant_id, store_id::text, branch_id))
        with check (public.can_access_scope(tenant_id, store_id::text, branch_id));
    $p$;

    execute $p$
      create policy toppings_public_read on public.toppings for select to anon, authenticated
        using (
          available = true
          and is_active = true
          and exists (
            select 1
            from public.stores s
            where s.id = toppings.store_id
              and s.status = 'active'
              and s.public_visible = true
          )
        );
    $p$;
  end if;
exception when others then
  raise notice 'toppings scope skip: %', sqlerrm;
end $$;

do $$ declare pol record;
begin
  if exists (select 1 from pg_tables where schemaname = 'public' and tablename = 'topping_categories') then
    for pol in
      select policyname from pg_policies where schemaname = 'public' and tablename = 'topping_categories'
    loop
      execute format('drop policy if exists %I on public.topping_categories', pol.policyname);
    end loop;

    execute $p$
      create policy topping_categories_scope_manage on public.topping_categories for all to authenticated
        using (public.can_access_scope(tenant_id, store_id::text, branch_id))
        with check (public.can_access_scope(tenant_id, store_id::text, branch_id));
    $p$;

    execute $p$
      create policy topping_categories_public_read on public.topping_categories for select to anon, authenticated
        using (
          exists (
            select 1
            from public.stores s
            where s.id = topping_categories.store_id
              and s.status = 'active'
              and s.public_visible = true
          )
        );
    $p$;
  end if;
exception when others then
  raise notice 'topping_categories scope skip: %', sqlerrm;
end $$;

do $$ declare pol record;
begin
  if exists (select 1 from pg_tables where schemaname = 'public' and tablename = 'stock_item_products') then
    for pol in
      select policyname from pg_policies where schemaname = 'public' and tablename = 'stock_item_products'
    loop
      execute format('drop policy if exists %I on public.stock_item_products', pol.policyname);
    end loop;

    execute $p$
      create policy stock_item_products_scope on public.stock_item_products for all to authenticated
        using (public.can_access_scope(tenant_id, store_id::text, branch_id))
        with check (public.can_access_scope(tenant_id, store_id::text, branch_id));
    $p$;
  end if;
exception when others then
  raise notice 'stock_item_products scope skip: %', sqlerrm;
end $$;

do $$ declare pol record;
begin
  if exists (select 1 from pg_tables where schemaname = 'public' and tablename = 'cash_entries') then
    for pol in
      select policyname from pg_policies where schemaname = 'public' and tablename = 'cash_entries'
    loop
      execute format('drop policy if exists %I on public.cash_entries', pol.policyname);
    end loop;

    execute $p$
      create policy cash_entries_scope on public.cash_entries for all to authenticated
        using (public.can_access_scope(tenant_id, store_id::text, branch_id))
        with check (public.can_access_scope(tenant_id, store_id::text, branch_id));
    $p$;
  end if;
exception when others then
  raise notice 'cash_entries scope skip: %', sqlerrm;
end $$;

do $$ declare pol record;
begin
  if exists (select 1 from pg_tables where schemaname = 'public' and tablename = 'daily_sales_summary') then
    for pol in
      select policyname from pg_policies where schemaname = 'public' and tablename = 'daily_sales_summary'
    loop
      execute format('drop policy if exists %I on public.daily_sales_summary', pol.policyname);
    end loop;

    execute $p$
      create policy daily_sales_summary_scope on public.daily_sales_summary for all to authenticated
        using (public.can_access_scope(tenant_id, store_id::text, branch_id))
        with check (public.can_access_scope(tenant_id, store_id::text, branch_id));
    $p$;
  end if;
exception when others then
  raise notice 'daily_sales_summary scope skip: %', sqlerrm;
end $$;

notify pgrst, 'reload schema';

commit;
