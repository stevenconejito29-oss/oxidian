# Oxidian Project State

## Objetivo

Memoria operativa limpia del SaaS Oxidian para registrar:

- arquitectura objetivo
- correcciones aplicadas
- bloqueos reales
- siguiente trabajo prioritario

## Flujo objetivo del producto

1. El cliente entra a la landing publica de Oxidian.
2. Elige un plan y paga por Stripe.
3. Oxidian provisiona una tienda nueva a partir de una plantilla interna no publica.
4. El responsable recibe por correo el enlace seguro de activacion y los links de su ecosistema.
5. El responsable activa la tienda, define su contrasena owner y entra a su panel.
6. Cada tienda gestiona branding, catalogo, cupones, club, staff, cocina, reparto y caja de forma independiente.
7. El chatbot local es opcional y se conecta aparte cuando la tienda instala su portable y escanea el QR.

## Estado corregido en esta pasada

- La landing publica ya no enlaza al super admin ni promociona la tienda plantilla.
- El acceso maestro de Oxidian ya usa una ruta oculta configurable por `VITE_OXIDIAN_ENTRY_SLUG`.
- `/oxidian` vuelve a funcionar para entrar al panel maestro mientras la ruta oculta sigue disponible.
- La landing comprueba readiness del SaaS antes de permitir checkout.
- El checkout exige:
  - Supabase de servicio
  - Stripe
  - correo transaccional
- El backend SaaS acepta `SUPABASE_SERVICE_ROLE_KEY` o `SUPABASE_SERVICE_KEY`.
- El provisioning envia correo de setup al responsable con:
  - enlace seguro de activacion
  - admin URL
  - tienda URL
  - PWA cocina
  - PWA repartidor
  - portal afiliados
- Al completar onboarding se envia correo final de activacion.
- Se guarda tracking de entrega de acceso en `oxidian_checkout_sessions`.
- Se creo una capa de sesion propia para:
  - Oxidian
  - owner/admin de tienda
  - staff
- El cliente Supabase ya puede usar token scoped por ruta cuando exista `SUPABASE_JWT_SECRET`.
- Oxidian ya no lista la tienda plantilla en el panel maestro.
- El panel maestro ahora muestra:
  - estado de lanzamiento por tienda
  - checklist de readiness
  - pack de links listos para entregar al cliente
  - busqueda y filtro por estado en la cartera de tiendas
- `/menu` sin tienda explicita redirige a `/`.
- La caja de la tienda modelo ya soporta venta mostrador tipo TPV.
- La venta mostrador crea:
  - pedido `delivered`
  - movimiento en `cash_entries`
  - visibilidad en reportes y ticket diario
- La utilidad de caja ahora separa:
  - ingresos manuales
  - ventas mostrador
  - liquidaciones de reparto
- Se amplio la verificacion E2E para cubrir TPV en la tienda modelo.
- El backend SaaS ahora hidrata automaticamente variables desde:
  - `.env`
  - `.env.local`
  - `chatbot-local/.env`
- Se agrego `npm run check:saas-env` para detectar antes si faltan variables criticas del backend.
- Se agrego una prueba automatizada de provisioning simulado:
  - pago confirmado simulado
  - clonacion de tienda
  - onboarding owner
  - entrada al admin de la tienda nueva
  - uso del menu de la tienda clonada
- Se agrego una simulacion multi-tenant con 3 clientes:
  - activacion owner
  - staff propio
  - catalogo distinto
  - pedidos distintos
  - comprobacion de aislamiento por tienda
- Se instalo `zod` para validacion estructurada de payloads SaaS y auth.
- Los endpoints de:
  - `api/auth/login.js`
  - `api/oxidian/create-checkout-session.js`
  - `api/oxidian/onboarding.js`
  ya validan entrada con schemas formales.
- La capa publica ya no necesita leer `settings` completas para menu, PWA staff, afiliados ni reseñas:
  - se creo una lista explicita de claves visibles
  - `useSettings` y portales publicos consumen solo esa superficie
  - esto prepara el terreno para cerrar RLS sin romper la tienda plantilla
- Se agrego una prueba owner real:
  - crea producto desde admin
  - crea staff desde admin
  - verifica el producto en menu
  - verifica login del staff creado en la PWA de reparto
- Se agrego `npm run check:saas-readiness` para medir:
  - variables pendientes de cobro y correo
  - tienda plantilla
  - planes cargados
  - readiness de `oxidian_checkout_sessions`
- Restricciones reales detectadas del esquema actual:
  - `staff_users.username` es unico global, no por tienda
  - `orders.order_number` es unico global, no por tienda

## Archivos clave

- `src/pages/OxidianLanding.jsx`
- `src/pages/OxidianOnboarding.jsx`
- `src/pages/OxidianPage.jsx`
- `src/pages/Admin.jsx`
- `src/pages/StaffLogin.jsx`
- `src/lib/oxidianSaas.js`
- `src/lib/appAuthApi.js`
- `src/lib/appSession.js`
- `src/lib/supabase.js`
- `api/_lib/appAuth.js`
- `api/_lib/oxidianSaas.js`
- `api/auth/login.js`
- `api/oxidian/public-status.js`
- `supabase/migrations/20260409_oxidian_saas_delivery.sql`
- `tests/three-client-simulation.spec.js`
- `tests/owner-admin-ops.spec.js`
- `scripts/check-saas-readiness.mjs`
- `api/_lib/requestSchemas.js`

## Bloqueos reales pendientes

- La plantilla interna sigue siendo `default`; aun no se ha sustituido por un mecanismo de plantilla completamente no navegable.
- RLS sigue pendiente de endurecerse por `store_id` y `app_role`.
- `requestAppLogin()` en modo localhost sigue usando fallback browser-only mientras `vite preview` no sirve `/api/*`; antes de cerrar RLS completamente hay que sustituir ese fallback por auth local segura o servir backend en dev.
- La venta automatica depende de:
  - `SUPABASE_URL`
  - `SUPABASE_SERVICE_ROLE_KEY` o `SUPABASE_SERVICE_KEY`
  - `STRIPE_SECRET_KEY`
  - `STRIPE_WEBHOOK_SECRET`
  - `RESEND_API_KEY`
  - `RESEND_FROM_EMAIL`
- La descarga del portable del chatbot por tienda todavia no esta implementada.
- Falta prueba E2E del circuito correo real -> activacion -> primera entrada owner.
- Sigue pendiente decidir si `staff_users.username` y `orders.order_number` deben ser unicos globalmente o scoped por `store_id`.

## Siguiente prioridad

1. Cerrar RLS real usando la nueva capa de sesion.
2. Sacar la plantilla interna de cualquier ruta navegable restante.
3. Implementar descarga del portable del chatbot por tienda desde admin.
4. Verificar compra real de una tienda con Stripe sandbox + correo sandbox.

## Verificacion de esta pasada

- `npm run build` OK
- `npm run check:saas-env` OK para backend base
- `npm run check:saas-readiness` OK con pendientes reales identificados
- `npm run test:saas` OK (`12/12`)
