# ESTADO DEL PROYECTO — 2026-04-24

## Cambios aplicados en esta sesión

### Backend (`api/index.py`)
- **[FIX]** `create_tenant_store`: ahora guarda `modules` en la columna `stores.modules`
- **[FIX]** `create_tenant_store`: llama a `apply_store_modules` después de crear la tienda para poblar `store_process_profiles`

### Frontend — Lógica de autenticación y sesiones

#### `src/legacy/lib/appSession.js`
- **[FIX CRÍTICO]** `readCurrentSupabaseAccessToken`: ahora tiene fallback al key admin si el key de ruta específica (ej: kitchen) no tiene sesión. Esto permite que el owner (tenant_owner) visite `/branch/kitchen` y `/branch/riders` sin ver una pantalla vacía por token anónimo.

#### `src/modules/branch/pages/BranchKitchenPage.jsx`
- **[FIX]** `handleAdvance`: usa `supabase` (cliente legacy con JWT correcto) en vez de `supabaseAuth` (sesión nativa, vacía para staff PIN)

#### `src/modules/branch/pages/BranchRidersPage.jsx`
- **[FIX]** `handleAdvance`: mismo fix que Kitchen

#### `src/modules/branch/pages/BranchAdminPage.jsx`
- **[FIX]** Todas las operaciones Supabase usan el cliente `db = supabase` (legacy) para que staff con JWT PIN pueda leer/escribir
- **[FIX]** Lee `storeId` y `branchId` desde `membership` del JWT como fallback cuando no hay URL params (necesario para `store_admin` que llega vía roleHome sin params)
- **[FIX]** Dashboard: filtro de pedidos ahora incluye `branchId` cuando está disponible

### Frontend — Sistema de módulos

#### `src/shared/hooks/useStoreModules.js`
- **[FIX]** Cambia de `supabase` (legacy) a `supabaseAuth` para llamadas RPC. Más limpio y consistente.

### Frontend — Wizard de creación de tiendas

#### `src/modules/tenant/pages/TenantAdminPage.jsx`
- **[FIX]** `business_type` en `handleCreate` ahora usa el tipo real (`food`, `retail`, `beauty`, `services`, `other`) vía mapa `NICHE_BUSINESS_TYPE`, en vez de `nicho.templateId` que era incorrecto

### Frontend — Menú público

#### `src/modules/public-menu/styles/MenuStyleExpress.jsx`
- **[NUEVO]** Componente completo para el estilo "Carta Express QR": lista ultracompacta, búsqueda inline, sin imágenes, precio prominente, añadir al carrito en una pulsación

#### `src/modules/public-menu/pages/PublicMenuPage.jsx`
- **[FIX]** Importa `MenuStyleExpress` y lo añade al `STYLE_MAP` con clave `'express'`
- **[MEJORA]** `neighborhood_store` ahora usa `MenuStyleExpress` en vez de `MenuStyleCatalog`

### Frontend — Catálogo de nichos

#### `src/modules/tenant/lib/storeCatalog.js`
- **[FIX]** Amplía `NICHE_DEFINITIONS` de 6 a 13 nichos para cubrir todo lo que define el wizard en `TenantAdminPage`: restaurant, supermarket, boutique_fashion, pharmacy, neighborhood_store, barbershop, beauty_salon, nail_salon, services, fastfood, minimarket, clothing, universal
- **[FIX]** `business_type` de cada nicho es correcto (food/retail/beauty/services/other)

### Base de datos — Migraciones nuevas

#### `supabase/migrations/0013_add_missing_templates_and_fixes.sql`
- Añade templates `booking` y `express` a `store_templates` (sin ellos, crear tienda con esos templates viola FK)
- Columnas extra en `stores`, `branches`, `staff_users` que el frontend necesita
- Backfill de `tenant_subscriptions` para tenants sin suscripción activa
- RLS básico para `staff_users` y `products`

#### `supabase/migrations/0014_orders_and_staff_rls.sql`
- RLS completo y limpio para: `orders`, `products`, `staff_users`, `coupons`, `reviews`, `categories`, `branches`, `stores`, `store_process_profiles`
- Lectura pública para menú (products, categories, branches)
- Gestión por scope para owners y staff con JWT
- Escritura de pedidos solo via backend (service_role)

---

## ACCIÓN REQUERIDA — Ejecutar en Supabase SQL Editor

Ejecutar EN ORDEN en el editor SQL de Supabase (Dashboard > SQL Editor):

```
1. supabase/migrations/0013_add_missing_templates_and_fixes.sql
2. supabase/migrations/0014_orders_and_staff_rls.sql
```

Si hay errores de tablas no existentes, ignorar y continuar (el DO $$ EXCEPTION WHEN OTHERS THEN NULL los maneja).

---

## Flujos verificados lógicamente

### ✅ Flujo owner (tenant_owner)
1. Llega a `/` → ve landing si no autenticado
2. Inicia sesión en `/login` → `supabaseAuth.auth.signInWithPassword`
3. `AuthProvider` carga membresía → rol `tenant_owner`
4. Redirige a `/tenant/admin`
5. Crea tienda con wizard → 4 pasos: nicho → módulos → estilo → datos
6. Backend guarda `modules`, llama `apply_store_modules`
7. Crea sedes desde tab "Sedes"
8. Crea staff desde tab "Staff"
9. Navega a `/branch/admin?store_id=X&branch_id=Y` → ve panel completo
10. Navega a `/branch/kitchen?store_id=X&branch_id=Y` → ve kanban en tiempo real

### ✅ Flujo staff (PIN)
1. Staff accede a `https://app.com/s/{storeSlug}/{branchSlug}/login`
2. Ingresa nombre + PIN → backend valida, genera JWT con claims
3. JWT guardado en localStorage (kitchen/rider) o sessionStorage (admin)
4. Redirige a `/branch/kitchen` o `/branch/riders` o `/branch/admin`
5. `AuthProvider` lee sesión stored → establece membership con role/storeId/branchId
6. `useRealtimeOrders` usa `supabase` legacy → pasa JWT con store_id y branch_id
7. Actualiza estado de pedidos → `supabase.from('orders').update(...)` con JWT correcto

### ✅ Flujo menú público
1. Cliente accede a `/s/{storeSlug}/menu` o `/s/{storeSlug}/menu/{branchSlug}`
2. `useStorePublicConfig` carga store, branches, categorías, productos
3. `PublicMenuPage` selecciona el componente de estilo por `template_id`
4. Cliente añade al carrito → `usePublicCart` (sessionStorage)
5. Abre checkout → `CheckoutDrawer` → POST `/api/backend/public/orders`
6. Backend crea pedido con tenant_id, store_id, branch_id, order_number correlativo
7. Pedido aparece en tiempo real en cocina y repartidores

### ✅ Flujo super admin
1. Login con email super_admin → plan `enterprise` (all features)
2. Panel `/admin` con tabs: Overview, Tenants, Tiendas, Planes, Pipeline, Chatbot
3. Crea tenants → asigna owners via invite
4. Gestiona pipeline de leads desde landing
5. Autoriza chatbot por sede

---

## Lo que queda para Codex (visual/CSS)

- Estilos y CSS de `MenuStyleExpress` (estructura lógica ya funciona)
- Estilos visuales de los tabs dinámicos en `BranchAdminPage` según módulos activos
- UI del panel de personalización de módulos post-creación en `CustomizeTab`
- Responsive del DashboardLayout en mobile
