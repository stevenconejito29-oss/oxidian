-- ============================================================
-- OXIDIAN SAAS — Migración 0006
-- Arregla 3 bugs de autenticación detectados en consola:
--
-- BUG 1: user_memberships no tiene política self-read
--   → Usuario autenticado recibe 403 al leer su propia membresía
--   → AuthProvider nunca obtiene el role correcto post-login
--
-- BUG 2: settings/config_tienda/stores sin política pública
--   → Cualquier query con storeId='default' recibe 401/403
--   → La tienda legacy no tiene tenant_id, then can_access_scope() falla
--
-- BUG 3: store_process_profiles sin política pública
--   → Igual que BUG 2
-- ============================================================

begin;

-- ─── BUG 1: user_memberships — self read ─────────────────────
-- Un usuario autenticado debe poder leer SU PROPIA membresía.
-- Sin esto, AuthProvider.loadMembership() siempre devuelve null.

drop policy if exists user_memberships_self_read on public.user_memberships;
create policy user_memberships_self_read
  on public.user_memberships
  for select
  to authenticated
  using (user_id = auth.uid());

-- ─── BUG 2 & 3: Tablas legacy con tenant_id NULL ─────────────
-- Las filas de la tienda "default" tienen tenant_id IS NULL,
-- por lo que can_access_scope(null, ...) devuelve false siempre.
-- Necesitamos una política pública de lectura para filas sin scope.

-- settings (tabla global de configuración pública)
drop policy if exists settings_public_read on public.settings;
create policy settings_public_read
  on public.settings
  for select
  to anon, authenticated
  using (tenant_id is null and store_id is null);

-- config_tienda (configuración de la tienda default)
drop policy if exists config_tienda_public_read on public.config_tienda;
create policy config_tienda_public_read
  on public.config_tienda
  for select
  to anon, authenticated
  using (tenant_id is null and store_id is null);

-- stores (la tienda "default" con public_visible=true)
-- Nota: ya existe stores_public_read para anon/authenticated,
-- pero solo permite status in ('active','draft','paused').
-- La tienda legacy puede tener status NULL — lo cubrimos aquí.
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
-- POST-MIGRACIÓN:
-- Ejecutar este archivo en Supabase SQL Editor o con:
--   supabase db push
--
-- No requiere cambios en Dashboard ni reinicio de sesión.
-- Los errores 401/403 desaparecerán inmediatamente.
-- ============================================================
