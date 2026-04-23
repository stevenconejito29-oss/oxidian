-- ============================================================
-- MIGRACION 0011
-- Corregir permisos efectivos sobre landing_requests para backend
-- ============================================================

begin;

grant usage on schema public to service_role;

grant select, insert, update, delete
  on table public.landing_requests
  to service_role;

grant select, update
  on table public.landing_requests
  to postgres;

alter table public.landing_requests enable row level security;

drop policy if exists landing_requests_public_insert on public.landing_requests;
create policy landing_requests_public_insert on public.landing_requests
  for insert to anon, authenticated
  with check (true);

drop policy if exists landing_requests_super_admin_all on public.landing_requests;
create policy landing_requests_super_admin_all on public.landing_requests
  for all to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());

drop policy if exists landing_requests_super_admin on public.landing_requests;
create policy landing_requests_super_admin on public.landing_requests
  for all to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());

commit;
