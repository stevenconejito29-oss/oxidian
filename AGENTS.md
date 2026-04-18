# OXIDIAN SAAS — Contexto para Codex / AI Agent
## LEER PRIMERO — Reglas absolutas

1. No inventar tablas ni columnas — toda la DB está en `supabase/migrations/`
2. No reemplazar archivos legacy sin migrar primero su lógica útil
3. Siempre usar `src/shared/supabase/client.js` para importar supabase
4. Siempre usar `useAuth()` de `src/core/providers/AuthProvider.jsx`
5. Los tabs del panel admin son condicionales — usan `useStoreModules()`
6. RLS activo en Supabase — no filtrar por tenant_id en el cliente

## Stack
| Capa | Tecnología |
|---|---|
| Frontend | React 18 + Vite + Tailwind + DaisyUI |
| Supabase | PostgreSQL 15 + RLS + Auth + Realtime |
| Backend | Flask (Python) — `/backend/app/` |
| Hosting | Vercel (solo frontend) |

## Flujo completo del sistema

```
VISITANTE
  → / (LandingPage) — info del producto + formulario
  → llena formulario → landing_requests (status: pending)

SUPER ADMIN
  → /admin → Pipeline tab → Aprueba → supabase.auth.admin.inviteUserByEmail()
  → usuario recibe email con link mágico

NUEVO DUEÑO
  → clic en link → /onboarding (wizard)
    Paso 1: elige nicho (barbershop/fastfood/restaurant/minimarket/clothing/universal)
    Paso 2: info del negocio (nombre, slug, email, ciudad)
    Paso 3: sede principal (nombre, dirección)
    Paso 4: estética (paleta de colores)
    → crea: tenant + tenant_subscription(growth) + store + branch + user_memberships
    → llama apply_niche_preset(store_id, tenant_id, nicho)
  → redirige a /branch/admin

DUEÑO (tenant_owner)
  → /tenant/admin — panel de su cuenta
    puede crear más tiendas con nichos distintos
    puede crear más sedes por tienda
    puede crear staff por sede con nombre + PIN
    ve links internos de cada sede para staff

ADMIN DE SEDE
  → /branch/admin — tabs dinámicos según módulos activos
    Gestiona productos, pedidos, staff, etc.
    Genera links de staff: /s/:storeSlug/:branchSlug/login

STAFF
  → /s/carmocream/sede-norte/login
    Ingresa nombre + PIN (creados por el admin de sede)
    Redirige según rol:
      kitchen  → /branch/kitchen
      rider    → /branch/riders
      cashier  → /branch/admin

CLIENTE FINAL
  → /s/:storeSlug/menu — menú público sin login
```

## Rutas del sistema

| Ruta | Componente | Guard |
|---|---|---|
| `/` | LandingPage | público |
| `/login` | LoginPage | público |
| `/s/:store/:branch/login` | StaffLoginPage | público |
| `/s/:store/menu` | PublicMenuPage | público |
| `/admin` | SuperAdminPage | super_admin |
| `/onboarding` | OnboardingPage | super_admin, tenant_owner, tenant_admin |
| `/tenant/admin` | TenantAdminPage | tenant_owner+ |
| `/branch/admin` | BranchAdminPage | store_admin+ |
| `/branch/kitchen` | BranchKitchenPage | kitchen+ |
| `/branch/riders` | BranchRidersPage | rider+ |

## Auth — cómo funciona

```js
import { useAuth } from '../../../core/providers/AuthProvider'
const { user, role, tenantId, storeId, branchId, isSuperAdmin } = useAuth()
```

Fuentes de sesión (en orden de prioridad):
1. `supabase.auth.getSession()` — admin, tenant, store roles
2. `appSession` storage — kitchen, rider (login por PIN)

## Tablas clave

```
landing_requests     — solicitudes del landing (status: pending→contacted→converted)
tenants              — dueños de negocio
tenant_subscriptions — tenant → plan (starter/growth/pro/enterprise)
stores               — tiendas por tenant (cada una un nicho)
store_modules        — módulos activos por tienda con config JSONB
branches             — sedes por tienda
user_memberships     — rol del usuario con scope tenant/store/branch
staff_users          — empleados con PIN para login por URL de sede
```

## Funciones Supabase

```sql
SELECT public.get_store_modules('store-id');     -- módulos activos
SELECT public.get_store_features('store-id');    -- features del plan
SELECT public.apply_niche_preset(store_id, tenant_id, niche_id);
SELECT public.make_super_admin('email');
SELECT public.add_loyalty_points(customer_id, points, type, desc);
```

## Hooks del frontend

```js
import { useStoreModules }  from '../../../shared/hooks/useStoreModules'
import { useFeatureFlag }   from '../../../shared/hooks/useFeatureFlag'
import { useTenant }        from '../../../shared/hooks/useTenant'
import { ModuleGate }       from '../../../shared/ui/ModuleGate'

const { isEnabled, getConfig } = useStoreModules()
isEnabled('mod_appointments') // → true/false
<ModuleGate module="mod_tables"><MesasPanel /></ModuleGate>
```

## Tabs dinámicos en BranchAdminPage

```js
const ALL_TABS = [
  { id:'dashboard',    module:null },              // siempre visible
  { id:'products',     module:'mod_catalog' },
  { id:'orders',       module:'mod_orders' },
  { id:'appointments', module:'mod_appointments' },
  { id:'tables',       module:'mod_tables' },
  { id:'variants',     module:'mod_variants' },
  { id:'stock',        module:'mod_inventory' },
  { id:'staff',        module:'mod_staff' },
  { id:'loyalty',      module:'mod_loyalty' },
  { id:'affiliates',   module:'mod_affiliates' },
  { id:'finance',      module:'mod_finance' },
  { id:'chatbot',      module:'mod_chatbot' },
  { id:'config',       module:null },              // siempre visible
]
const visibleTabs = ALL_TABS.filter(t => !t.module || isEnabled(t.module))
```

## Estado actual de archivos

| Archivo | Estado |
|---|---|
| `AuthProvider.jsx` | OK — usa supabase.auth.getSession() como primario |
| `AppRouter.jsx` | OK — incluye /s/:store/:branch/login |
| `LandingPage.jsx` | OK — info + formulario → landing_requests |
| `OnboardingPage.jsx` | OK — wizard 5 pasos: nicho+info+sede+estética+listo |
| `StaffLoginPage.jsx` | OK — login por nombre+PIN, redirige según rol |
| `SuperAdminPage.jsx` | PENDIENTE — añadir tabs Tenants y Pipeline |
| `BranchAdminPage.jsx` | PENDIENTE — filtrar tabs con useStoreModules |
| `useStoreModules.js` | OK — escrito en shared/hooks |
| `useFeatureFlag.js` | OK — escrito en shared/hooks |
| `ModuleGate.jsx` | PENDIENTE — crear en shared/ui |

## Nichos disponibles

| id | Módulos especiales |
|---|---|
| `barbershop` | mod_appointments |
| `fastfood` | mod_modifiers, mod_combos, mod_logistics |
| `restaurant` | mod_modifiers, mod_tables |
| `minimarket` | mod_inventory |
| `clothing` | mod_variants, mod_inventory |
| `universal` | solo core |

## Datos de prueba

```
tenant: a1b2c3d4-0001-0001-0001-000000000001
store:  demo-bakery, demo-pharmacy
branch: b1000000-0001-0001-0001-000000000001
staff:  Camila/1234, Andrés/5678, David/9012
cupón:  BIENVENIDO15
URL staff: /s/demo-bakery/sede-el-poblado/login
```

## Variables de entorno

```
VITE_SUPABASE_URL=https://ljnfjlwlvabpsrwahzjk.supabase.co
VITE_SUPABASE_ANON_KEY=(ver frontend/.env)
```

## Migraciones ejecutadas

```
RESET_COMPLETE.sql         — schema base
0005_saas_expansion.sql    — planes, suscripciones, loyalty, landing
0006_seed_test_data.sql    — datos de prueba
0007_modules_engine.sql    — motor módulos + nichos + tablas especializadas
```
