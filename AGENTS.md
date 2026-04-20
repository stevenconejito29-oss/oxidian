# AGENTS.md — Oxidian SaaS Platform
# Instrucciones para revisión profunda con OpenAI Codex

> **REGLA CRÍTICA ABSOLUTA**
> NO adaptes el código para que "funcione de alguna forma".
> Si hay un import roto → corrige el path real.
> Si falta una columna en la DB → añádela en SQL.
> Si un componente usa un hook inexistente → crea ese hook correctamente.
> Si una política RLS recursa → arréglala con SECURITY DEFINER.
> Corrige los errores reales. No parches. No workarounds.

---

## STACK Y ARQUITECTURA

```
Frontend : React 18 + Vite + Tailwind/DaisyUI → Vercel
Backend  : Flask Python serverless → api/index.py → Vercel
DB/Auth  : Supabase (PostgreSQL + RLS + Auth)
Repo     : GitHub (main branch → auto-deploy Vercel)
```

### Jerarquía de roles
```
SuperAdmin → Tenant (dueño) → Store (marca/tienda) → Branch (sede física)

Roles:
  super_admin      → /admin
  tenant_owner     → /tenant/admin
  tenant_admin     → /tenant/admin
  store_admin      → /branch/admin
  store_operator   → /branch/admin
  branch_manager   → /branch/admin
  cashier          → /branch/admin
  kitchen          → /branch/kitchen
  rider            → /branch/riders
```

### Archivos clave del frontend
```
src/core/router/AppRouter.jsx          Router principal + guards de rol
src/core/providers/AuthProvider.jsx    Auth con reintentos RLS
src/core/router/roleHome.js            Mapa rol → ruta
src/core/app/DashboardLayout.jsx       Sidebar colapsable + topbar

src/modules/admin/pages/SuperAdminPage.jsx     Panel Super Admin (7 tabs)
src/modules/tenant/pages/TenantAdminPage.jsx   Panel Dueño (5 tabs + wizard)
src/modules/branch/pages/BranchAdminPage.jsx   Panel Sede (7 tabs)
src/modules/branch/pages/BranchKitchenPage.jsx Cocina (kanban dark)
src/modules/branch/pages/BranchRidersPage.jsx  Repartidores (mobile-first)

src/modules/public-menu/pages/PublicMenuPage.jsx   Router de plantillas
src/modules/public-menu/styles/MenuStyleDelivery.jsx   Restaurantes
src/modules/public-menu/styles/MenuStyleGrid.jsx       Supermercados
src/modules/public-menu/styles/MenuStyleBoutique.jsx   Moda
src/modules/public-menu/styles/MenuStyleCatalog.jsx    Farmacia/catálogo
src/modules/public-menu/styles/MenuStyleBooking.jsx    Barberías/servicios
src/modules/public-menu/styles/MenuShared.jsx          Shared components

src/shared/lib/planFeatures.js    Definición de planes y features
src/shared/hooks/usePlan.js       Hook PlanProvider + usePlan (sin JSX)
src/shared/ui/FeatureGate.jsx     FeatureGate, LimitGate, PlanBadge
src/shared/ui/OxidianDS.jsx       Sistema de diseño compartido
src/shared/lib/supabaseApi.js     CRUD directo a Supabase
src/shared/supabase/client.js     Cliente Supabase (usar ESTE, no el legacy)

api/index.py                      Flask serverless: crear users Auth + chatbot ZIP
supabase/migrations/              Migraciones SQL
```

---


## TAREA 1 — AUDITORÍA DE IMPORTS Y PATHS ROTOS

Lee TODOS los archivos en `src/modules/` y `src/shared/`.
Para cada import, verifica que el archivo destino existe en el path correcto.

**Errores conocidos a corregir:**

1. `BranchAdminPage.jsx` importa de `../../../legacy/lib/supabase` en algunos helpers.
   → Cambiar a `../../../shared/supabase/client` (exporta `supabaseAuth`).

2. `BranchKitchenPage.jsx` y `BranchRidersPage.jsx` importan de `../../../legacy/lib/supabase`.
   → Cambiar a `../../../shared/supabase/client`.

3. Buscar cualquier `import { supabase }` (sin Auth) y verificar si debería ser `supabaseAuth`.
   El cliente correcto es `supabaseAuth` exportado desde `src/shared/supabase/client.js`.

4. `TenantAdminPage.jsx` tiene una llamada a `updateStaffAccount` que no está definida
   en `supabaseApi.js`. Verificar si existe o añadirla:
   ```js
   export async function updateStaffAccount(membershipId, patch) {
     const { error } = await supabaseAuth
       .from('user_memberships')
       .update(patch)
       .eq('id', membershipId)
     if (error) throw new Error(error.message)
   }
   ```

5. `TenantAdminPage.jsx` importa `AdminStoreCustomizationPanel` desde `../../../legacy/pages/AdminStoreCustomizationPanel`.
   Verificar que ese archivo existe. Si no existe, crear un componente placeholder funcional.

**Acción:** Corregir TODOS los imports rotos. No crear alias ni barrel files para parchear.

---

## TAREA 2 — AUTHPROVIDER: VERIFICAR COLUMNAS Y CONTEXTO

Archivo: `src/core/providers/AuthProvider.jsx`

**Verificaciones:**
1. La query `.select('role, tenant_id, store_id, branch_id, is_active, metadata')` asume
   que la tabla `user_memberships` tiene la columna `metadata`. Verificar en el schema SQL.
   Si no existe → añadir en migración: `ALTER TABLE user_memberships ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}'::jsonb;`

2. El contexto expone `tenantId`, `storeId`, `branchId`. Verificar que `BranchAdminPage.jsx`
   usa `useSearchParams` para obtener `store_id` y `branch_id` de la URL (correcto para staff).
   El `storeId` del contexto solo aplica para `store_admin` y `store_operator`.

3. El `PlanProvider` está dentro de `AuthProvider` en el árbol (`AuthRoot`). Verificar
   que `PlanProvider` puede leer `tenantId` de `useAuth()` correctamente porque:
   - `AuthProvider` debe renderizar antes que `PlanProvider`
   - El orden actual en AppRouter.jsx es correcto: `<AuthProvider><PlanProvider><Outlet /></PlanProvider></AuthProvider>`

---

## TAREA 3 — SUPERADMINPAGE: FLUJO COMPLETO

Archivo: `src/modules/admin/pages/SuperAdminPage.jsx`

**Verificaciones y correcciones:**

1. **Tab "Planes" → función `change_tenant_plan`**: La RPC llama a `supabaseAuth.rpc('change_tenant_plan', {...})`.
   Verificar que la función existe en Supabase (está en `supabase/migrations/0008_plans_and_feature_overrides.sql`).
   Si la RPC falla, añadir fallback con upsert directo:
   ```js
   // fallback si RPC no existe:
   const { error } = await supabaseAuth.from('tenant_subscriptions').upsert({
     tenant_id: p_tenant_id, plan_id: p_plan_id,
     status: 'active', feature_overrides: p_overrides,
     notes: p_notes, current_period_end: new Date(Date.now()+30*86400000).toISOString(),
   }, { onConflict: 'tenant_id' })
   ```

2. **Tab "Dueños"**: La función `listOwnerAccounts()` en `supabaseApi.js` hace un join con `tenants(name)`.
   Verificar que la relación FK entre `user_memberships.tenant_id` y `tenants.id` existe.

3. **Tab "Tiendas"**: El super admin puede crear tiendas. Verificar que `createStore()` en `supabaseApi.js`
   maneja correctamente el campo `id` (que es igual al `slug`) vs UUID auto-generado.
   Si `stores.id` es UUID, NO pasar `id: form.slug`. Revisar schema y corregir.

4. **ChatbotAuthManager**: Verificar que el componente en
   `src/modules/admin/components/ChatbotAuthManager.jsx` existe y exporta correctamente.

---

## TAREA 4 — TENANTADMINPAGE: WIZARD Y FEATURE GATING

Archivo: `src/modules/tenant/pages/TenantAdminPage.jsx`

**Verificaciones:**

1. **usePlan hook**: El componente llama `const { can, canCreateMore, plan, FEATURES: F } = usePlan()`.
   Verificar que `FEATURES` está disponible (sí, viene de `planFeatures.js` a través de `usePlan`).

2. **LimitGate en creación de tiendas**: Envolver el botón "Crear tienda" con `LimitGate`:
   ```jsx
   import { LimitGate } from '../../../shared/ui/FeatureGate'
   import { FEATURES }  from '../../../shared/lib/planFeatures'

   // En StoresTab, antes de mostrar el formulario:
   <LimitGate limitKey={FEATURES.MAX_STORES} currentCount={stores.length}>
     <Btn onClick={() => setShowCreate(true)}>+ Crear tienda</Btn>
   </LimitGate>
   ```

3. **FeatureGate en tabs**: Los tabs de "Afiliados", "Fidelidad" y "Diseño" deben estar
   detrás de FeatureGate:
   ```jsx
   // Tab de personalización (solo desde plan Growth+):
   {tab === 'customize' && (
     <FeatureGate feature={FEATURES.MENU_CUSTOM_STYLE}>
       <CustomizeTab ... />
     </FeatureGate>
   )}
   ```

4. **Función `getTenantPlan`**: Verificar que existe en `supabaseApi.js`. Si no:
   ```js
   export async function getTenantPlan(tenantId) {
     const { data } = await supabaseAuth
       .from('tenant_subscriptions')
       .select('plan_id')
       .eq('tenant_id', tenantId)
       .eq('status', 'active')
       .maybeSingle()
     return data?.plan_id || 'starter'
   }
   ```

5. **Función `getTenantDashboard`**: Verificar que existe. Si no:
   ```js
   export async function getTenantDashboard(tenantId) {
     const since = new Date(Date.now() - 86400000).toISOString()
     const { data: orders } = await supabaseAuth
       .from('orders')
       .select('id, total, status')
       .eq('tenant_id', tenantId)
       .gte('created_at', since)
     return { orders_today: orders?.length || 0 }
   }
   ```

---


## TAREA 5 — BRANCHADMINPAGE: FILTROS Y SCOPE CORRECTO

Archivo: `src/modules/branch/pages/BranchAdminPage.jsx`

**Problema principal**: El panel de sede recibe `store_id` y `branch_id` por query params.
Pero varios tabs consultan la DB sin filtrar por `branch_id`, lo que puede mezclar datos de sedes.

**Correcciones:**

1. **ProductsTab**: Los productos son por tienda (`store_id`), no por sede. Correcto.
   Pero si una tienda tiene varias sedes con catálogos distintos → añadir filtro `branch_id`
   solo si la tabla `products` tiene esa columna. Verificar schema.

2. **OrdersTab**: DEBE filtrar por `branch_id` cuando esté disponible.
   La query actual ya tiene:
   ```js
   if (branchId) q = q.eq('branch_id', branchId)
   ```
   Verificar que la tabla `orders` tiene columna `branch_id`. Si no → solo filtrar por `store_id`.

3. **StaffTab**: La query filtra por `store_id`. Si el staff es específico de una sede,
   debería filtrar también por `branch_id`. Verificar tabla `staff_users`:
   - Si tiene `branch_id` → filtrar `eq('branch_id', branchId)`
   - Si no → mantener solo `store_id`

4. **DashboardTab**: La query de `stock_items` usa `store_id`. Verificar nombre real de la tabla.
   Puede ser `stock` en lugar de `stock_items`. Ajustar al nombre real.

5. **ConfigTab**: La query de configuración hace `.from('branches').update({...}).eq('id', branchId)`.
   Verificar que `branchId` no sea null. Añadir guard:
   ```js
   if (!branchId) { setError('No se proporcionó branch_id'); return }
   ```

---

## TAREA 6 — KITCHEN Y RIDERS: RESOLUCIÓN DE IDs

Archivos:
- `src/modules/branch/pages/BranchKitchenPage.jsx`
- `src/modules/branch/pages/BranchRidersPage.jsx`

**Problema**: Ambos usan `useResolvedStoreId()` de `legacy/lib/currentStore.js`.
Esto es un legado que puede no funcionar bien con las nuevas rutas.

**Corrección correcta:**

1. Leer `storeId` y `branchId` de `useSearchParams()` y/o de `useAuth()`:
   ```js
   import { useSearchParams } from 'react-router-dom'
   import { useAuth } from '../../../core/providers/AuthProvider'

   const [params] = useSearchParams()
   const { storeId: authStoreId, branchId: authBranchId } = useAuth()
   const storeId  = params.get('store_id') || params.get('store') || authStoreId || ''
   const branchId = params.get('branch_id')|| params.get('branch')|| authBranchId || ''
   ```

2. La query de `useRealtimeOrders` debe filtrar por `branch_id` si existe:
   - Verificar `useRealtimeOrders` en `legacy/lib/useRealtimeOrders.js`
   - Si acepta `branchId` prop → pasarlo
   - Si no → modificarlo para aceptar y usar `branchId`

3. **No eliminar** `useRealtimeOrders` — solo asegurarse de que filtra por `branch_id`
   además de `store_id`. Añadir el parámetro si falta.

---

## TAREA 7 — SUPABASEAPI.JS: FUNCIONES FALTANTES Y FIXES

Archivo: `src/shared/lib/supabaseApi.js`

**Auditoría completa — verificar que existen estas funciones:**

```js
// Tenants
listTenants()                     // GET tenants donde es super_admin
createTenant(payload)
updateTenant(id, patch)

// Stores
listStores(tenantId?)             // si tenantId → filtrar; si null → todas (super_admin)
createStore(payload)
updateStore(id, patch)

// Branches
listBranches(tenantId?, storeId?) // filtros opcionales
createBranch(payload)
updateBranch(id, patch)

// Membresías / Staff
listMemberships({ tenant_id, roles })
createOwnerAccount({ tenant_id, role, full_name, email, password })
updateOwnerAccount(membershipId, patch)
listOwnerAccounts()               // ya está — consulta directa a Supabase
createStaffAccount(payload)       // llama a Flask backend para crear Auth user
updateStaffAccount(id, patch)     // VERIFICAR SI EXISTE

// Planes
getTenantPlan(tenantId)           // CREAR SI NO EXISTE (ver Tarea 4)
getTenantDashboard(tenantId)      // CREAR SI NO EXISTE (ver Tarea 4)

// Landing
inviteLandingRequest(id, url)     // verifica que llama al backend correcto
```

**Fix crítico en `createStore`:**
Verificar que el schema de `stores` usa UUID auto-generado para `id`,
NO el slug. Si `stores.id` es UUID:
```js
export async function createStore(payload) {
  const { id: _slug, ...rest } = payload  // quitar 'id' si es UUID auto
  const { data, error } = await supabaseAuth
    .from('stores')
    .insert(rest)  // dejar que Supabase genere el UUID
    .select()
    .single()
  if (error) throw new Error(error.message)
  return data
}
```
Si `stores.id = slug` (texto), entonces el payload con `id: slug` es correcto.
Verificar con: `SELECT column_name, data_type FROM information_schema.columns WHERE table_name='stores' AND column_name='id';`

---

## TAREA 8 — MENÚ PÚBLICO: PLANTILLAS Y CHECKOUT

### 8a. useStorePublicConfig
Archivo: `src/modules/public-menu/hooks/useStorePublicConfig.js`

**Verificación:**
1. Importa de `../../../legacy/lib/supabase` → cambiar a `../../../shared/supabase/client`
2. La query de `products` tiene `.eq('is_active', true)` — correcto.
3. Productos con `out_of_stock: true` ya están filtrados — correcto.
4. Verificar que la query de `categories` usa el mismo `store_id` que los productos.

### 8b. CheckoutDrawer
Archivo: `src/modules/public-menu/components/CheckoutDrawer.jsx`

**Verificaciones:**
1. Verificar que acepta `onUpdateQty` y `onRemoveItem` como props
   (fueron añadidas en `PublicMenuPage.jsx` pero el drawer puede no usarlas aún).
2. El drawer debe mostrar resumen del carrito + campo de nombre/teléfono/dirección del cliente.
3. Al confirmar pedido → insertar en tabla `orders` con estos campos mínimos:
   ```js
   {
     store_id, branch_id,
     customer_name, customer_phone, delivery_address,
     items: JSON.stringify(cart),
     total: cartTotal,
     status: 'pending',
     order_number: generado,
   }
   ```
4. Si falta el campo `order_number` → generarlo: `Math.floor(Math.random()*9000)+1000`

### 8c. MenuShared — ProductModal
Archivo: `src/modules/public-menu/styles/MenuShared.jsx`

**Verificación:**
1. El modal usa `animation: 'slideUp .25s ease'`. Asegurar que el keyframe está inyectado.
2. Las variantes se parsean de `product.variants`. Verificar que el campo puede ser
   `string` (JSON) o array directamente. El try/catch ya está.
3. Si `product.out_of_stock === true` → deshabilitar botón de añadir. Ya está.

---


## TAREA 9 — FEATURE GATING: APLICAR EN TODAS LAS VISTAS

El sistema `usePlan` + `FeatureGate` + `LimitGate` está construido pero NO está
aplicado en los paneles. Esta tarea es aplicarlo correctamente.

### 9a. TenantAdminPage — Tabs con gate

```jsx
// Importar en TenantAdminPage.jsx:
import FeatureGate, { LimitGate, PlanBadge } from '../../../shared/ui/FeatureGate'
import { FEATURES } from '../../../shared/lib/planFeatures'

// Aplicar en los tabs correspondientes:
{tab === 'customize' && (
  <FeatureGate feature={FEATURES.MENU_CUSTOM_STYLE}>
    <CustomizeTab ... />
  </FeatureGate>
)}

// En StoresTab — limitar creación:
<LimitGate limitKey={FEATURES.MAX_STORES} currentCount={stores.length}>
  <Btn onClick={() => setShowCreate(true)}>+ Crear tienda</Btn>
</LimitGate>

// En BranchesTab — limitar creación:
<LimitGate limitKey={FEATURES.MAX_BRANCHES} currentCount={storeBranches.length}>
  <form onSubmit={handleCreate}>...</form>
</LimitGate>

// En StaffTab — limitar creación:
<LimitGate limitKey={FEATURES.MAX_STAFF} currentCount={accounts.length}>
  <form onSubmit={handleCreate}>...</form>
</LimitGate>
```

### 9b. BranchAdminPage — Tabs con gate

```jsx
// Marketing tab (solo desde Growth+):
{tab === 'marketing' && (
  <FeatureGate feature={FEATURES.COUPONS}>
    <MarketingTab storeId={storeId} />
  </FeatureGate>
)}

// Chatbot tab (solo desde Growth+):
{tab === 'chatbot' && (
  <FeatureGate feature={FEATURES.CHATBOT_BASIC}>
    <ChatbotTab branchId={branchId} storeId={storeId} />
  </FeatureGate>
)}
```

### 9c. Super Admin — NO gate (enterprise siempre)

El Super Admin tiene `role === 'super_admin'` → `can()` siempre devuelve `true`.
No es necesario poner FeatureGate en el panel de Super Admin.
Verificar que `usePlan` hace: `if (role === 'super_admin') return true` en `can()`. ✓ Ya lo hace.

---

## TAREA 10 — SISTEMA DE PLANES: VERIFICACIÓN END-TO-END

### 10a. Migración SQL

Archivo: `supabase/migrations/0008_plans_and_feature_overrides.sql`

Verificar que contiene:
1. `ALTER TABLE tenant_subscriptions ADD COLUMN IF NOT EXISTS feature_overrides jsonb DEFAULT '{}'`
2. `INSERT INTO store_plans (id, name, monthly_price, feature_bundle...)` para los 4 planes
3. `CREATE OR REPLACE FUNCTION change_tenant_plan(...)` con SECURITY DEFINER
4. La función verifica `IF NOT public.is_super_admin() THEN RAISE EXCEPTION`

Si falta alguno → añadirlo. El SQL debe ser idempotente (usar `IF NOT EXISTS`, `ON CONFLICT DO UPDATE`).

### 10b. Tabla `tenant_subscriptions`

Verificar que existe con estas columnas mínimas:
```sql
tenant_id           uuid REFERENCES tenants(id) UNIQUE NOT NULL
plan_id             text NOT NULL DEFAULT 'starter'
status              text NOT NULL DEFAULT 'active'  -- active | suspended | trialing
feature_overrides   jsonb NOT NULL DEFAULT '{}'
current_period_end  timestamptz
notes               text
```

Si faltan columnas → añadirlas con `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`.

### 10c. Tabla `store_plans`

Verificar que existe:
```sql
id            text PRIMARY KEY  -- 'starter', 'growth', 'pro', 'enterprise'
name          text
description   text
monthly_price numeric
sort_order    integer
feature_bundle jsonb
is_active     boolean DEFAULT true
```

### 10d. RLS en `tenant_subscriptions`

Verificar que la política permite:
- `super_admin` → ver y modificar todo
- `tenant_owner/tenant_admin` → ver solo la de su `tenant_id`

```sql
-- Política de lectura para el tenant owner:
CREATE POLICY "tenant_sub_own_read" ON public.tenant_subscriptions
  FOR SELECT TO authenticated
  USING (tenant_id = (
    SELECT tenant_id FROM user_memberships
    WHERE user_id = auth.uid() AND is_active = true
    LIMIT 1
  ));

-- Política de lectura para super admin:
CREATE POLICY "tenant_sub_super_admin" ON public.tenant_subscriptions
  FOR ALL TO authenticated
  USING (public.is_super_admin());
```

---

## TAREA 11 — FLASK BACKEND: RUTAS Y MIDDLEWARE

Archivo: `api/index.py`

**Verificaciones:**

1. **Ruta `/admin/accounts/owners`** → Esta ruta ya NO es necesaria porque
   `listOwnerAccounts()` va directo a Supabase. Verificar que no hay referencias rotas.

2. **Ruta `/admin/chatbot/download/<branch_id>`**:
   - Debe generar y devolver un ZIP con el chatbot portable
   - Verificar que las variables del `.env` incluyen: `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`,
     `STORE_ID`, `BRANCH_ID`, `ADMIN_PHONE`, `WA_SECRET`, `SHOP_URL`
   - El ZIP debe contener: `server.js`, `chatbot-logic.js`, `config.js`, `package.json`,
     `.env`, `iniciar.bat`, `iniciar.sh`, `README.md`

3. **Middleware de autenticación**: Verificar que el decorador `@require_auth` valida
   el JWT de Supabase y extrae `user_id` y `role` del token.

4. **Ruta `/tenant/accounts/staff`**: Debe crear el usuario en Supabase Auth usando
   `service_role_key` (no la anon key) y luego crear la membresía en `user_memberships`.

5. **CORS**: Verificar que `FRONTEND_URL` de las variables de entorno de Vercel
   está en los orígenes permitidos.

---

## TAREA 12 — LOGINPAGE Y STAFFLOGINPAGE

### 12a. LoginPage
Archivo: `src/modules/auth/pages/LoginPage.jsx`

Verificar que:
1. Usa `supabaseAuth.auth.signInWithPassword({ email, password })`
2. Tras login exitoso → `navigate(ROLE_HOME[role] || '/tenant/admin')`
3. Muestra error claro si las credenciales son inválidas
4. Tiene campo email + password + botón de submit
5. NO usa el cliente legacy `supabase` — usa `supabaseAuth` del cliente nuevo

### 12b. StaffLoginPage
Archivo: `src/modules/auth/pages/StaffLoginPage.jsx`

Verificar que:
1. Lee `storeSlug` y `branchSlug` de `useParams()`
2. Carga el staff de esa sede desde `staff_users` filtrando por `store_id` o `branch_id`
3. El login por PIN verifica contra `staff_users.pin`
4. Tras login exitoso → redirige según el rol:
   - `kitchen` → `/branch/kitchen?store_id=X&branch_id=Y`
   - `rider` → `/branch/riders?store_id=X&branch_id=Y`
   - `cashier/branch_manager` → `/branch/admin?store_id=X&branch_id=Y`

---

## TAREA 13 — DASHBOARDLAYOUT: NAVEGACIÓN Y RESPONSIVE

Archivo: `src/core/app/DashboardLayout.jsx`

**Verificaciones:**

1. **Navegación por tabs**: El sidebar usa `onTabChange` para cambiar tabs en la misma página.
   Verificar que `SuperAdminPage`, `TenantAdminPage` y `BranchAdminPage` pasan `onTabChange`
   correctamente al `DashboardLayout`.

2. **Responsive**: En móvil (<640px) el sidebar debe colapsar automáticamente.
   Añadir media query o detectar `window.innerWidth < 640` con `React.useEffect`.

3. **Active state**: El sidebar debe resaltar el tab activo. Verificar que el prop
   `activeTab` llega y coincide con los `item.tab` del `NAV_BY_ROLE`.

4. **Avatar**: El avatar del usuario usa `membership?.metadata?.full_name`.
   Si `metadata` es null → usar `user?.email?.split('@')[0]` como fallback. Ya lo hace.

---


## TAREA 14 — SQL CRÍTICO: RESET_COMPLETE Y TABLAS FALTANTES

Archivo: `supabase/migrations/RESET_COMPLETE.sql`

**Verificar que existen estas tablas con sus columnas:**

### Tablas requeridas

```sql
-- Tenants
tenants (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  slug text UNIQUE NOT NULL,
  owner_name text,
  owner_email text,
  owner_phone text,
  status text DEFAULT 'active',   -- active | suspended | archived
  monthly_fee numeric DEFAULT 0,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
)

-- Stores
stores (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,  -- O TEXT si slug es el id
  slug text UNIQUE NOT NULL,
  name text NOT NULL,
  tenant_id uuid REFERENCES tenants(id) NOT NULL,
  niche text,
  business_type text,
  template_id text DEFAULT 'delivery',
  theme_tokens jsonb DEFAULT '{}',
  city text,
  currency text DEFAULT 'EUR',
  status text DEFAULT 'active',
  public_visible boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
)

-- Branches
branches (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  slug text NOT NULL,
  name text NOT NULL,
  store_id uuid REFERENCES stores(id) NOT NULL,
  tenant_id uuid REFERENCES tenants(id) NOT NULL,
  address text,
  city text,
  phone text,
  status text DEFAULT 'active',
  is_primary boolean DEFAULT false,
  public_visible boolean DEFAULT true,
  open_hour integer DEFAULT 10,
  close_hour integer DEFAULT 22,
  open_days text DEFAULT 'L-D',
  chatbot_authorized boolean DEFAULT false,
  chatbot_authorized_at timestamptz,
  chatbot_last_seen timestamptz,
  chatbot_version text,
  chatbot_wa_secret text,
  created_at timestamptz DEFAULT now(),
  UNIQUE(store_id, slug)
)

-- User memberships
user_memberships (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  role text NOT NULL,
  tenant_id uuid REFERENCES tenants(id),
  store_id uuid REFERENCES stores(id),
  branch_id uuid REFERENCES branches(id),
  is_active boolean DEFAULT true,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
)

-- Products
products (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  store_id uuid REFERENCES stores(id) NOT NULL,
  name text NOT NULL,
  description text,
  price numeric NOT NULL DEFAULT 0,
  compare_price numeric,
  image_url text,
  emoji text DEFAULT '🍽️',
  category_id uuid,
  is_active boolean DEFAULT true,
  is_featured boolean DEFAULT false,
  out_of_stock boolean DEFAULT false,
  track_stock boolean DEFAULT false,
  stock_quantity integer DEFAULT 0,
  service_duration_minutes integer,
  has_variants boolean DEFAULT false,
  variants jsonb DEFAULT '[]',
  modifiers jsonb DEFAULT '[]',
  tags text[],
  sort_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
)

-- Categories
categories (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  store_id uuid REFERENCES stores(id) NOT NULL,
  name text NOT NULL,
  description text,
  image_url text,
  sort_order integer DEFAULT 0,
  is_active boolean DEFAULT true,
  category_type text DEFAULT 'product'
)

-- Orders
orders (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  store_id uuid REFERENCES stores(id) NOT NULL,
  branch_id uuid REFERENCES branches(id),
  tenant_id uuid REFERENCES tenants(id),
  order_number integer,
  customer_name text,
  customer_phone text,
  delivery_address text,
  address text,
  items jsonb DEFAULT '[]',
  total numeric DEFAULT 0,
  status text DEFAULT 'pending',
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
)

-- Staff users (login por PIN)
staff_users (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  store_id uuid REFERENCES stores(id) NOT NULL,
  branch_id uuid,
  tenant_id uuid REFERENCES tenants(id),
  name text NOT NULL,
  role text NOT NULL,
  phone text,
  email text,
  pin text,
  notes text,
  is_active boolean DEFAULT true,
  is_online boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
)

-- Coupons
coupons (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  store_id uuid REFERENCES stores(id) NOT NULL,
  code text UNIQUE NOT NULL,
  type text DEFAULT 'percentage',  -- percentage | fixed | free_delivery
  value numeric DEFAULT 0,
  min_order numeric DEFAULT 0,
  description text,
  is_active boolean DEFAULT true,
  uses_count integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
)

-- Reviews
reviews (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  store_id uuid REFERENCES stores(id) NOT NULL,
  customer_name text,
  rating integer DEFAULT 5,
  comment text,
  approved boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
)

-- Landing requests (pipeline de leads)
landing_requests (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  full_name text,
  email text,
  phone text,
  business_name text,
  city text,
  message text,
  status text DEFAULT 'pending',
  contacted_at timestamptz,
  converted_at timestamptz,
  updated_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
)

-- Tenant subscriptions
tenant_subscriptions (
  tenant_id uuid REFERENCES tenants(id) UNIQUE NOT NULL,
  plan_id text NOT NULL DEFAULT 'starter',
  status text NOT NULL DEFAULT 'active',
  feature_overrides jsonb NOT NULL DEFAULT '{}',
  current_period_end timestamptz,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
)

-- Store plans
store_plans (
  id text PRIMARY KEY,
  name text NOT NULL,
  description text,
  monthly_price numeric DEFAULT 0,
  sort_order integer DEFAULT 0,
  feature_bundle jsonb DEFAULT '{}',
  is_active boolean DEFAULT true,
  updated_at timestamptz DEFAULT now()
)
```

**Si alguna tabla falta → crearla. Si le falta una columna → usar `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`.**

---

## TAREA 15 — RLS: POLÍTICAS CRÍTICAS

**Funciones requeridas con SECURITY DEFINER (para evitar recursión):**

```sql
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM user_memberships
    WHERE user_id = auth.uid()
    AND role = 'super_admin'
    AND is_active = true
  );
END;
$$;
```

**Políticas mínimas por tabla:**

```sql
-- user_memberships (exactamente 2 políticas, no más):
CREATE POLICY "memberships_own_read" ON user_memberships
  FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE POLICY "memberships_super_admin_all" ON user_memberships
  FOR ALL TO authenticated USING (public.is_super_admin());

-- tenants:
CREATE POLICY "tenants_super_admin" ON tenants
  FOR ALL TO authenticated USING (public.is_super_admin());

CREATE POLICY "tenants_own_read" ON tenants
  FOR SELECT TO authenticated
  USING (id IN (
    SELECT tenant_id FROM user_memberships
    WHERE user_id = auth.uid() AND is_active = true
  ));

-- stores, branches, products: similar patrón
```

**GRANT necesarios:**
```sql
GRANT SELECT ON public.user_memberships TO authenticated;
GRANT SELECT ON public.user_memberships TO anon;
NOTIFY pgrst, 'reload schema';
```

---

## ORDEN DE EJECUCIÓN RECOMENDADO

1. **Empezar por Tarea 1** (auditar imports rotos) — sin imports correctos nada funciona
2. **Tarea 7** (supabaseApi.js) — todas las funciones deben existir
3. **Tarea 2** (AuthProvider) — verificar columnas
4. **Tarea 14 + 15** (SQL) — asegurar que las tablas y RLS están correctas
5. **Tarea 3** (SuperAdmin) — flujo completo
6. **Tarea 4** (TenantAdmin) — wizard y feature gating
7. **Tarea 5 + 6** (BranchAdmin, Kitchen, Riders) — filtros correctos
8. **Tarea 9** (aplicar FeatureGate en todas las vistas)
9. **Tarea 8** (menú público + checkout)
10. **Tarea 10 + 11 + 12 + 13** (planes, Flask, Login, Layout)

---

## CRITERIO DE CORRECCIÓN

Para cada cambio que hagas, pregúntate:
- ¿Estoy arreglando la causa raíz o poniendo un parche?
- ¿El path de import apunta a un archivo que existe?
- ¿La columna que leo en la DB existe en el schema?
- ¿La RLS permite que este rol vea estos datos?
- ¿El feature gate aplica correctamente según el plan del tenant?

Si la respuesta a alguna es "no sé" → lee el archivo correspondiente antes de editar.

---

## VARIABLES DE ENTORNO (Vercel)

```
SUPABASE_URL=https://ljnfjlwlvabpsrwahzjk.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<service_role_key>
SUPABASE_JWT_SECRET=<jwt_secret>
VITE_SUPABASE_URL=https://ljnfjlwlvabpsrwahzjk.supabase.co
VITE_SUPABASE_ANON_KEY=<anon_key>
VITE_BACKEND_URL=      ← vacío = mismo dominio Vercel
FRONTEND_URL=https://tu-app.vercel.app
```

## CREDENCIALES DE PRUEBA (Super Admin)
```
Email:    pepemellamoyoo@oxidian.app
Password: Oxidian#2026!Acceso
```
