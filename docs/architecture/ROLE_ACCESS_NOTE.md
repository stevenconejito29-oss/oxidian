# Role Access Note

## Objetivo

La estructura visible del sistema debe depender del rol autenticado y del scope del usuario.
El landing publico no debe mezclar enlaces operativos internos.

## Reglas de visibilidad

- El landing publico no debe mostrar enlaces de `preparacion`, `reparto` ni `afiliados`.
- Los accesos de `preparacion`, `reparto` y `afiliados` deben aparecer solo dentro de la vista administrativa de cada sede o dentro de paneles privados autenticados.
- La informacion de dueños, tenant admins y datos internos del negocio debe mostrarse solo despues de login.
- El `super_admin` puede ver informacion global, incluidos dueños y estructura jerarquica.
- El `tenant_owner` y `tenant_admin` pueden ver solo la informacion del tenant al que pertenecen.
- El `store_admin` y `store_operator` pueden ver solo la informacion de su tienda.
- El `branch_manager`, `cashier`, `kitchen` y `rider` pueden ver solo la informacion de su sede.

## Rutas por rol

- `super_admin` -> `/admin`
- `tenant_owner` -> `/tenant/admin`
- `tenant_admin` -> `/tenant/admin`
- `store_admin` -> `/branch/admin`
- `store_operator` -> `/branch/admin`
- `branch_manager` -> `/branch/admin`
- `cashier` -> `/branch/admin`
- `kitchen` -> `/branch/kitchen`
- `rider` -> `/branch/riders`

## Regla de UI

- El landing solo debe contener propuesta comercial, pricing, onboarding y acceso a login.
- Las vistas operativas deben colgar del area autenticada.
- Los links de sede deben renderizarse por rol y por scope, nunca en publico.
- La informacion de dueños debe estar protegida por `ProtectedRoute` y por RLS en Supabase.

## SQL util

Archivo listo para ejecutar:

- `scripts/seed_role_profiles.sql`

Ese script:

- resuelve `tenant`, `store` y `branch`
- crea membresias para todos los roles del enum `app_role`
- reactiva membresias existentes
- devuelve una tabla de verificacion al final

## Roles reales en schema

```sql
select unnest(enum_range(null::public.app_role));
```

Resultado esperado:

- `super_admin`
- `tenant_owner`
- `tenant_admin`
- `store_admin`
- `store_operator`
- `branch_manager`
- `kitchen`
- `rider`
- `cashier`

## Nota operativa

Primero crea los usuarios en `auth.users` desde login o desde Supabase Auth.
Despues ejecuta `scripts/seed_role_profiles.sql`.
Si dejas `p_tenant_ref`, `p_store_ref` y `p_branch_ref` vacios, el script intenta autodetectar el contexto.
