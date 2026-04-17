-- ============================================================
-- OXIDIAN SAAS
-- Migración 0003: JWT Claims Hook + primer Super Admin
-- Inyecta app_role, tenant_id, store_id, branch_id en el JWT
-- ============================================================

begin;

-- ─── 1. Función hook para Supabase Auth ─────────────────────
-- Esta función se llama en cada login y enriquece el JWT con
-- los datos de la membresía activa del usuario.
-- Se registra en Supabase Dashboard > Auth > Hooks > Custom JWT claims.

create or replace function public.custom_jwt_claims(event jsonb)
returns jsonb
language plpgsql
security definer
stable
as $$
declare
  membership record;
  claims jsonb;
begin
  -- Buscar la membresía activa más relevante para este usuario
  -- Prioridad: super_admin > tenant_owner > tenant_admin > store_admin > branch roles
  select *
  into membership
  from public.user_memberships
  where user_id = (event->>'userId')::uuid
    and is_active = true
  order by
    case role
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
    end
  limit 1;

  -- Construir los claims adicionales
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
    -- Sin membresía: usuario anónimo autenticado
    claims := jsonb_set(claims, '{app_role}', '"authenticated_user"');
  end if;

  return jsonb_set(event, '{claims}', claims);
end;
$$;

grant execute on function public.custom_jwt_claims(jsonb) to supabase_auth_admin;

comment on function public.custom_jwt_claims(jsonb) is
'Hook de Supabase Auth. Registrar en Dashboard > Auth > Hooks > Custom JWT claims.
Inyecta app_role, tenant_id, store_id, branch_id desde user_memberships.';

-- ─── 2. Función auxiliar para asignar super admin ────────────
-- Úsala para crear tu cuenta de Super Admin después de hacer login.
-- EJECUTAR EN SQL EDITOR: SELECT public.make_super_admin('tu-email@dominio.com');

create or replace function public.make_super_admin(p_email text)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_user_id uuid;
  v_existing uuid;
begin
  -- Obtener user_id del email en auth.users
  select id into v_user_id
  from auth.users
  where email = lower(trim(p_email))
  limit 1;

  if v_user_id is null then
    return jsonb_build_object(
      'success', false,
      'error', 'Usuario no encontrado. Debe hacer login al menos una vez.'
    );
  end if;

  -- Verificar si ya existe membresía super_admin
  select id into v_existing
  from public.user_memberships
  where user_id = v_user_id and role = 'super_admin';

  if v_existing is not null then
    -- Reactivar si estaba desactivado
    update public.user_memberships
    set is_active = true, updated_at = timezone('utc', now())
    where id = v_existing;

    return jsonb_build_object(
      'success', true,
      'action', 'reactivated',
      'user_id', v_user_id,
      'email', p_email
    );
  end if;

  -- Crear nueva membresía super_admin
  insert into public.user_memberships (
    user_id, role, tenant_id, store_id, branch_id, is_active
  ) values (
    v_user_id, 'super_admin', null, null, null, true
  );

  return jsonb_build_object(
    'success', true,
    'action', 'created',
    'user_id', v_user_id,
    'email', p_email
  );
end;
$$;

comment on function public.make_super_admin(text) is
'Asigna rol super_admin a un usuario existente en auth.users por email.
Uso: SELECT public.make_super_admin(''tu@email.com'');';

-- ─── 3. Función para invitar miembro a un tenant ─────────────

create or replace function public.invite_member(
  p_email text,
  p_role public.app_role,
  p_tenant_id uuid default null,
  p_store_id text default null,
  p_branch_id uuid default null
)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_user_id uuid;
begin
  -- Solo super_admin o tenant_owner pueden invitar
  if not (public.is_super_admin() or exists (
    select 1 from public.user_memberships
    where user_id = auth.uid()
      and role in ('tenant_owner', 'tenant_admin')
      and tenant_id = p_tenant_id
      and is_active
  )) then
    raise exception 'Sin permisos para invitar miembros';
  end if;

  select id into v_user_id
  from auth.users
  where email = lower(trim(p_email))
  limit 1;

  if v_user_id is null then
    return jsonb_build_object(
      'success', false,
      'error', 'El usuario no existe. Debe registrarse primero.'
    );
  end if;

  insert into public.user_memberships (
    user_id, role, tenant_id, store_id, branch_id, is_active
  ) values (
    v_user_id, p_role, p_tenant_id, p_store_id, p_branch_id, true
  )
  on conflict (user_id, role, tenant_id, store_id, branch_id)
  do update set is_active = true, updated_at = timezone('utc', now());

  return jsonb_build_object(
    'success', true,
    'user_id', v_user_id,
    'role', p_role,
    'email', p_email
  );
end;
$$;

comment on function public.invite_member is
'Asigna un rol a un usuario existente en auth.users.
Uso: SELECT public.invite_member(''email'', ''branch_manager'', tenant_id, store_id, branch_id);';

-- ─── 4. Vista de usuarios con sus membresías (para Super Admin) ──

create or replace view public.v_users_memberships as
select
  u.id as user_id,
  u.email,
  u.created_at as registered_at,
  m.id as membership_id,
  m.role,
  m.tenant_id,
  m.store_id,
  m.branch_id,
  m.is_active,
  t.name as tenant_name,
  b.name as branch_name
from auth.users u
left join public.user_memberships m on m.user_id = u.id and m.is_active = true
left join public.tenants t on t.id = m.tenant_id
left join public.branches b on b.id = m.branch_id
order by u.created_at desc;

comment on view public.v_users_memberships is
'Vista de auditoría: usuarios + membresías activas. Solo Super Admin.';

-- Seguridad en la vista
alter view public.v_users_memberships owner to postgres;

-- ─── 5. Índice para el hook (performance en login) ────────────
create index if not exists user_memberships_hook_idx
  on public.user_memberships(user_id, is_active, role)
  where is_active = true;

commit;

-- ============================================================
-- INSTRUCCIONES POST-MIGRACIÓN:
--
-- 1. En Supabase Dashboard > Authentication > Hooks:
--    → Custom JWT claims hook: postgresql/public/custom_jwt_claims
--
-- 2. Crear tu cuenta Super Admin:
--    → Ve a Authentication > Users y crea un usuario con tu email
--    → O regístrate en /login con tu email
--    → Luego ejecuta en SQL Editor:
--       SELECT public.make_super_admin('tu@email.com');
--
-- 3. Cierra sesión y vuelve a entrar para que el JWT se actualice
--    con los nuevos claims (app_role = 'super_admin')
-- ============================================================
