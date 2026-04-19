-- ============================================================
-- EJECUTAR EN: Supabase → SQL Editor → Run
-- Arregla "permission denied for table stores" y todas las
-- tablas que necesita el panel super admin
-- ============================================================

-- ── STORES ──────────────────────────────────────────────────
-- El super admin debe poder leer todas las tiendas
-- La política stores_public_read solo cubre public_visible=true
-- Añadimos lectura total para authenticated

drop policy if exists stores_authenticated_read on public.stores;
create policy stores_authenticated_read
  on public.stores
  for select
  to authenticated
  using (true);

drop policy if exists stores_authenticated_write on public.stores;
create policy stores_authenticated_write
  on public.stores
  for all
  to authenticated
  using (
    -- super admin: tiene membresía super_admin activa
    exists (
      select 1 from public.user_memberships m
      where m.user_id  = auth.uid()
        and m.role     = 'super_admin'
        and m.is_active = true
    )
    or
    -- tenant scope: tiene membresía activa en ese tenant
    exists (
      select 1 from public.user_memberships m
      where m.user_id   = auth.uid()
        and m.is_active  = true
        and m.tenant_id  = public.stores.tenant_id
    )
  )
  with check (
    exists (
      select 1 from public.user_memberships m
      where m.user_id  = auth.uid()
        and m.role     = 'super_admin'
        and m.is_active = true
    )
    or
    exists (
      select 1 from public.user_memberships m
      where m.user_id   = auth.uid()
        and m.is_active  = true
        and m.tenant_id  = public.stores.tenant_id
    )
  );

-- ── TENANTS ─────────────────────────────────────────────────
drop policy if exists tenants_authenticated_read on public.tenants;
create policy tenants_authenticated_read
  on public.tenants
  for select
  to authenticated
  using (true);

drop policy if exists tenants_authenticated_write on public.tenants;
create policy tenants_authenticated_write
  on public.tenants
  for all
  to authenticated
  using (
    exists (
      select 1 from public.user_memberships m
      where m.user_id  = auth.uid()
        and m.role     = 'super_admin'
        and m.is_active = true
    )
    or
    exists (
      select 1 from public.user_memberships m
      where m.user_id   = auth.uid()
        and m.is_active  = true
        and m.tenant_id  = public.tenants.id
    )
  )
  with check (
    exists (
      select 1 from public.user_memberships m
      where m.user_id  = auth.uid()
        and m.role     = 'super_admin'
        and m.is_active = true
    )
    or
    exists (
      select 1 from public.user_memberships m
      where m.user_id   = auth.uid()
        and m.is_active  = true
        and m.tenant_id  = public.tenants.id
    )
  );

-- ── BRANCHES ────────────────────────────────────────────────
drop policy if exists branches_authenticated_read on public.branches;
create policy branches_authenticated_read
  on public.branches
  for select
  to authenticated
  using (true);

-- ── STORE_PROCESS_PROFILES ──────────────────────────────────
drop policy if exists store_process_profiles_authenticated_read on public.store_process_profiles;
create policy store_process_profiles_authenticated_read
  on public.store_process_profiles
  for select
  to authenticated
  using (true);

-- ── TENANT_SUBSCRIPTIONS (para el dashboard de planes) ──────
drop policy if exists tenant_subscriptions_authenticated_read on public.tenant_subscriptions;
create policy tenant_subscriptions_authenticated_read
  on public.tenant_subscriptions
  for select
  to anon, authenticated
  using (true);

drop policy if exists tenant_subscriptions_super_admin_write on public.tenant_subscriptions;
create policy tenant_subscriptions_super_admin_write
  on public.tenant_subscriptions
  for all
  to authenticated
  using (
    exists (
      select 1 from public.user_memberships m
      where m.user_id  = auth.uid()
        and m.role     = 'super_admin'
        and m.is_active = true
    )
  )
  with check (
    exists (
      select 1 from public.user_memberships m
      where m.user_id  = auth.uid()
        and m.role     = 'super_admin'
        and m.is_active = true
    )
  );

-- ── LANDING_REQUESTS (pipeline de solicitudes) ──────────────
drop policy if exists landing_requests_super_admin_all on public.landing_requests;
create policy landing_requests_super_admin_all
  on public.landing_requests
  for all
  to authenticated
  using (
    exists (
      select 1 from public.user_memberships m
      where m.user_id  = auth.uid()
        and m.role     = 'super_admin'
        and m.is_active = true
    )
  )
  with check (
    exists (
      select 1 from public.user_memberships m
      where m.user_id  = auth.uid()
        and m.role     = 'super_admin'
        and m.is_active = true
    )
  );

-- ── VERIFICACIÓN ────────────────────────────────────────────
select tablename, policyname, cmd
from pg_policies
where schemaname = 'public'
  and tablename in (
    'stores','tenants','branches',
    'store_process_profiles',
    'tenant_subscriptions',
    'landing_requests',
    'user_memberships'
  )
order by tablename, policyname;
