# OXIDIAN — Memory Log
> Registro cronológico. Actualizar SIEMPRE al hacer un cambio importante.

---

## 2026-04-17 — Sesiones iniciales de arquitectura

### SETUP — Análisis del proyecto heredado
**Qué**: carmocream legacy era tienda única hardcodeada. Se extrajo lógica reutilizable.
**Resultado**: OK

### MIGRACIÓN — RESET_COMPLETE.sql
**Qué**: schema base completo — tenants, stores, branches, user_memberships, RLS, JWT hook, funciones is_super_admin / make_super_admin / custom_jwt_claims.
**Resultado**: EJECUTADO en Supabase

### MIGRACIÓN — 0005_saas_expansion.sql
**Qué**: saas_plans, tenant_subscriptions, feature_overrides, customer_profiles, loyalty_tiers, landing_requests, staff_schedules, chatbot_download_tokens, vista effective_store_features, funciones add_loyalty_points / generate_chatbot_download_token.
**Resultado**: EJECUTADO en Supabase

### MIGRACIÓN — 0006_seed_test_data.sql
**Qué**: datos de prueba — tenant Demo Panadería, stores demo-bakery + demo-pharmacy, branches, staff, clientes, tiers, pedidos, cupón, afiliado.
**Nota**: reemplazar 'tu@email.com' en Paso 18 antes de ejecutar.
**Resultado**: EJECUTADO en Supabase

---

## 2026-04-18 — Motor de Módulos y Nichos

### MIGRACIÓN — 0007_modules_engine.sql
**Qué**: module_definitions (16 módulos), store_modules (config JSONB por tienda), niche_presets (6 nichos), extensiones a products y orders, tablas appointments/service_slots, product_variants/variant_options, modifier_groups/modifier_options, restaurant_tables/table_reservations, función apply_niche_preset, función get_store_modules, RLS completo.
**Resultado**: PENDIENTE de ejecutar en Supabase

### BUG CRÍTICO — AuthProvider desconectado del login
**Síntoma**: login con Supabase auth, pero AuthProvider leía appSession (legacy) → loop infinito de redirección.
**Causa**: AuthProvider usaba readActiveStoredSession() como fuente primaria.
**Solución**: reescribir AuthProvider con supabase.auth.getSession() + onAuthStateChange. appSession queda como fallback para staff con PIN.
**Archivo**: `frontend/src/core/providers/AuthProvider.jsx`
**Resultado**: APLICADO

### FEATURE — Hooks base del motor de módulos
**Archivos creados**:
- `frontend/src/shared/hooks/useStoreModules.js` — llama get_store_modules(storeId), caché 60s
- `frontend/src/shared/hooks/useFeatureFlag.js` — llama get_store_features(storeId), caché 120s
**Resultado**: APLICADOS

---

## 2026-04-18 — Flujo completo onboarding + staff login

### FEATURE — LandingPage completa
**Archivo**: `frontend/src/modules/admin/pages/LandingPage.jsx`
**Qué**: página pública con hero, funcionalidades del producto, planes de precio, nichos soportados, y formulario de solicitud que guarda en landing_requests.
**Resultado**: APLICADO

### FEATURE — OnboardingPage reescrita (wizard completo)
**Archivo**: `frontend/src/modules/admin/pages/OnboardingPage.jsx`
**Qué**: wizard de 5 pasos:
  1. Nicho (barbershop/fastfood/restaurant/minimarket/clothing/universal)
  2. Info del negocio (nombre, slug, email, ciudad) → crea tenant + store + user_memberships
  3. Sede principal → crea branch
  4. Estética (paleta de colores) → actualiza theme_tokens del store
  5. Listo → links a panel y menú público
  Llama apply_niche_preset() al crear la store.
**Resultado**: APLICADO

### FEATURE — StaffLoginPage (login por URL de sede)
**Archivo**: `frontend/src/modules/auth/pages/StaffLoginPage.jsx`
**Ruta**: `/s/:storeSlug/:branchSlug/login`
**Qué**: página de login para staff con nombre+PIN. Lee branch por storeSlug+branchSlug. Verifica PIN contra staff_users. Persiste en appSession según rol. Redirige a /branch/kitchen, /branch/riders o /branch/admin.
**Resultado**: APLICADO

### FEATURE — AppRouter actualizado
**Archivo**: `frontend/src/core/router/AppRouter.jsx`
**Qué**: añadida ruta `/s/:storeSlug/:branchSlug/login` → StaffLoginPage. Onboarding accesible para tenant_owner además de super_admin.
**Resultado**: APLICADO

### FEATURE — AGENTS.md actualizado
**Archivo**: `AGENTS.md`
**Qué**: contexto completo reescrito para Codex con flujo de sistema, rutas, tablas, funciones, hooks, estado actual de archivos.
**Resultado**: APLICADO

---

## 2026-04-19 — Fixes post-sesión: selector de sede + redirect onboarding

### BUG FIX — BranchAdminPage: selector de sede cuando branchId es null
**Síntoma**: un `store_admin` o `tenant_owner` sin `branch_id` en el JWT veía un error en lugar de poder elegir sede.
**Causa**: la página hacía `if (!branchId) return <Notice tone="error">...` sin dar alternativa.
**Solución aplicada**:
- Renombrado `branchId` de `useAuth()` a `jwtBranchId`.
- Añadido estado local `selectedBranchId` + `availableBranches`.
- `branchId` efectivo = `jwtBranchId || selectedBranchId`.
- `useEffect` carga sedes desde Supabase filtrando por `store_id` (si existe) o `tenant_id`.
- Si solo hay una sede disponible → se auto-selecciona.
- El guard `if (!branchId)` ahora muestra una grilla de tarjetas de sedes seleccionables.
- Cuando el branchId viene de selección manual se muestra botón "← Cambiar sede" en el Hero.
**Archivo**: `frontend/src/modules/branch/pages/BranchAdminPage.jsx`
**Resultado**: APLICADO

### BUG FIX — OnboardingPage: redirigir a /tenant/admin después del onboarding
**Síntoma**: el botón "Ir a mi panel →" del paso final redirigía a `/branch/admin`, que requiere `branch_id` en el JWT — del que el usuario recién creado (rol `tenant_owner`) no dispone.
**Causa**: hardcoded `navigate('/branch/admin')` en `ListoStep`.
**Solución**: cambiado a `navigate('/tenant/admin')`.
**Archivo**: `frontend/src/modules/admin/pages/OnboardingPage.jsx`
**Resultado**: APLICADO

---

## Resumen de archivos modificados (2026-04-19)

| Archivo | Acción |
|---|---|
| `src/modules/branch/pages/BranchAdminPage.jsx` | Fix: selector de sede + jwtBranchId/effectiveBranchId |
| `src/modules/admin/pages/OnboardingPage.jsx` | Fix: redirect a /tenant/admin |
| `MEMORY_LOG.md` | Este archivo |

---

## PENDIENTES ACTUALIZADOS (2026-04-19)

### ⚡ EJECUTAR EN SUPABASE (si aún no se ha hecho)
- [ ] `supabase/migrations/0007_modules_engine.sql`
- [ ] `UPDATE stores SET slug = id WHERE slug IS NULL;`

### 🔧 inviteUserByEmail → mover al backend Flask
- Ver sección "PENDIENTES ACTUALIZADOS (2026-04-18)" → el botón del Pipeline falla silenciosamente.
- Ruta sugerida: `POST /api/admin/invite-tenant` con `@require_super_admin`.

### 🔧 DashboardTab → reemplazar llamada Flask por query Supabase directa
- Si el backend Flask no está corriendo el dashboard queda vacío.
- Fix: query directa `supabase.from('orders').select(...).eq('store_id', storeId)`.

### 🔧 BranchKitchenPage — filtrar por branch_id
- `useRealtimeOrders` filtra por `store_id` pero no `branch_id`.
- Añadir `.eq('branch_id', branchId)` cuando `branchId` no sea null.



### ⚡ Ejecutar en Supabase
- [ ] Ejecutar `0007_modules_engine.sql` en Supabase SQL Editor

### 🔧 ModuleGate.jsx
- [ ] Crear `frontend/src/shared/ui/ModuleGate.jsx`
```jsx
import { useStoreModules } from '../hooks/useStoreModules'
export function ModuleGate({ module, fallback=null, children }) {
  const { isEnabled, loading } = useStoreModules()
  if (loading) return null
  return isEnabled(module) ? children : fallback
}
```

### 🔧 BranchAdminPage — tabs dinámicos
- [ ] Importar useStoreModules
- [ ] Reemplazar TABS fijo por ALL_TABS filtrado con isEnabled()
- [ ] Añadir casos en renderTab para appointments, tables, variants

### 🔧 SuperAdminPage — Tenants + Pipeline
- [ ] Añadir tab 'Tenants': lista tenants, crear tenant, asignar plan
- [ ] Añadir tab 'Pipeline': landing_requests con cambio de estado y aprobación vía supabase.auth.admin.inviteUserByEmail()

### 🔧 TenantAdminPage
- [ ] Reemplazar lectura legacy config_tienda por useStoreModules()
- [ ] Añadir sección "Mis tiendas" con lista de stores del tenant
- [ ] Añadir sección "Crear nueva tienda" → navegar a /onboarding
- [ ] Añadir sección "Staff links" por sede

### 🔧 BranchAdminPage — Staff links
- [ ] Añadir tab o sección "Links de acceso"
- [ ] Mostrar por cada staff member el link: /s/:storeSlug/:branchSlug/login
- [ ] Mostrar QR generado con ese link

---

## Problemas conocidos

### P1: BranchKitchenPage no filtra por branch_id
**Causa**: useRealtimeOrders filtra por store_id pero no branch_id.
**Fix**:
```js
const { branchId } = useAuth()
// añadir .eq('branch_id', branchId) si branchId no es null
```

### P2: TenantAdminPage usa legacy storeConfig
**Causa**: loadStoreConfig() lee config_tienda (legacy).
**Fix**: reemplazar por useStoreModules() cuando los tabs dinámicos estén listos.

### P3: OnboardingPage crea tenant sin plan Enterprise
**Nota**: el onboarding asigna plan 'growth' por defecto. El super admin puede cambiarlo desde el Pipeline tab.

### P4: StaffLoginPage usa appSession legacy
**Nota**: el sistema de PIN para staff usa localStorage (appSession). Es funcional pero eventual migration path es que el admin invita al staff vía email con Supabase Auth y rol específico de branch.

---

## 2026-04-18 (continuación) — Flujo completo funcional

### FEATURE — BranchAdminPage: tabs dinámicos + StaffTab con links
**Archivo**: `frontend/src/modules/branch/pages/BranchAdminPage.jsx`
**Qué se hizo**:
- Importado `useStoreModules`
- Reemplazado `TABS` fijo por `ALL_TABS` con campo `module` (null = siempre visible)
- `TabBar` ahora recibe `tabs` como prop en lugar de usar TABS global
- En `BranchAdminPage()` se calcula `visibleTabs = ALL_TABS.filter(t => !t.module || isEnabled(t.module))`
- Se cargan `storeSlug` y `branchSlug` de la DB al montar
- `StaffTab` reescrito: usa Supabase directo (no API Flask), campo PIN en lugar de email, muestra link `/s/:storeSlug/:branchSlug/login` por empleado con botón "Copiar link"
- Añadidos stubs: `AppointmentsTab`, `TablesTab`, `VariantsTab`
- `tabContent` ampliado con todos los nuevos tabs
**Resultado**: OK

### FEATURE — SuperAdminPage: tabs Overview + Pipeline + Tenants
**Archivo**: `frontend/src/modules/admin/pages/SuperAdminPage.jsx`
**Qué se hizo**:
- `ADMIN_TABS` actualizado: overview, pipeline, tenants, stores, chatbot
- Añadido renderizado de `<OverviewTab>`, `<PipelineTab>`, `<TenantsTab>`
- `OverviewTab`: métricas globales de Supabase (tenants, branches, leads, pedidos 24h)
- `PipelineTab`: lista de landing_requests filtrables por estado, botones de avance y "Aprobar + enviar invitación" (usa `supabase.auth.admin.inviteUserByEmail()` con redirectTo=/onboarding)
- `TenantsTab`: CRUD de tenants con asignación de plan, activar/suspender
**Resultado**: OK
**Nota**: `inviteUserByEmail` requiere service_role key — solo funciona desde el backend Flask. Desde el frontend mostrará un error de permisos. Solución: mover la invitación a una edge function o al backend Flask.

### FEATURE — TenantAdminPage: reescritura completa
**Archivo**: `frontend/src/modules/tenant/pages/TenantAdminPage.jsx`
**Qué se hizo**:
- Eliminados todos los imports legacy (loadStoreConfig, desktopChatbotRuntime, tenantApi, etc.)
- Reemplazado por queries directas a Supabase con el tenantId del JWT
- Muestra: lista de tiendas del tenant, lista de sedes con link de login de staff, accesos rápidos
- El link de staff usa el storeSlug + branchSlug reales de la DB
**Resultado**: OK

---

## PENDIENTES ACTUALIZADOS (2026-04-18)

### ⚡ EJECUTAR EN SUPABASE
- [ ] `0007_modules_engine.sql` (si no se ha ejecutado)
- [ ] Verificar que `stores.slug` esté poblado (si es null, el link de staff falla)
  ```sql
  UPDATE stores SET slug = id WHERE slug IS NULL;
  ```

### 🔧 CRÍTICO — inviteUserByEmail necesita backend
**Problema**: `supabase.auth.admin.inviteUserByEmail()` requiere `service_role` key, que no debe estar en el frontend.
**Solución**:
```python
# backend/app/modules/admin/__init__.py
@bp.post('/invite-tenant')
@require_auth
@require_super_admin
def invite_tenant():
    from flask import request
    from app.core.extensions import supabase_admin
    body = request.json
    result = supabase_admin.auth.admin.invite_user_by_email(
        body['email'],
        options={ 'redirect_to': body.get('redirect_to', '/onboarding') }
    )
    return jsonify({ 'ok': True })
```
Hasta que esto esté, el pipeline muestra el botón pero falla silenciosamente.

### 🔧 Verificar BranchAdminPage tabs
- La función `get_store_modules()` debe existir en Supabase (migración 0007)
- Si la migración no está aplicada, `isEnabled()` retorna `false` para todos → solo aparecen dashboard y config

### 🔧 DashboardTab del BranchAdmin
- Actualmente llama `API('GET', '/dashboard')` → Flask backend
- Si el backend no está corriendo, el dashboard estará vacío
- Fix rápido: reemplazar por query directa a Supabase
  ```js
  const { data } = await supabase.from('orders')
    .select('id, status', { count: 'exact' })
    .eq('store_id', storeId)
    .gte('created_at', hoy)
  ```

### 🔧 LoginPage — redirect correcto post-login
- Super admin → `/admin` ✓
- Tenant owner → `/tenant/admin` ✓
- Store admin → `/branch/admin` ✓ (pero no sabe qué sede)
- Problema: si el store_admin tiene `branch_id = null` en su membership, no tiene sede asignada
- Fix: en BranchAdminPage mostrar selector de sede si `branchId` es null y el rol es store_admin

### 🔧 Seed de store.slug para las tiendas de prueba
- `demo-bakery` tiene `id = 'demo-bakery'` y `slug` debería ser igual
- Verificar con: `SELECT id, slug FROM stores;`

---

## Resumen de archivos modificados (esta sesión)

| Archivo | Acción |
|---|---|
| `src/core/providers/AuthProvider.jsx` | Reescrito — fix bug sesión |
| `src/core/router/AppRouter.jsx` | Actualizado — nueva ruta staff login |
| `src/modules/admin/pages/LandingPage.jsx` | Reescrito — landing completo |
| `src/modules/admin/pages/OnboardingPage.jsx` | Reescrito — wizard 5 pasos |
| `src/modules/admin/pages/SuperAdminPage.jsx` | Actualizado — tabs Overview, Pipeline, Tenants |
| `src/modules/auth/pages/StaffLoginPage.jsx` | Nuevo — login por URL de sede |
| `src/modules/branch/pages/BranchAdminPage.jsx` | Actualizado — tabs dinámicos, StaffTab con links |
| `src/modules/tenant/pages/TenantAdminPage.jsx` | Reescrito — sin legacy, con tiendas + links |
| `src/shared/hooks/useStoreModules.js` | Nuevo |
| `src/shared/hooks/useFeatureFlag.js` | Nuevo |
| `src/shared/hooks/useTenant.js` | Nuevo |
| `src/shared/hooks/useResolvedStoreId.js` | Nuevo |
| `src/shared/ui/ModuleGate.jsx` | Nuevo |
| `AGENTS.md` | Actualizado |
| `MEMORY_LOG.md` | Este archivo |
