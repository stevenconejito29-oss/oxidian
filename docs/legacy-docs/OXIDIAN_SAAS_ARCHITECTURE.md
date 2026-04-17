# OXIDIAN SaaS Flow

## Rutas canonicas

- `/` → landing publica de Oxidian.
- `/<ruta-oculta-configurada>` → super admin del SaaS (`VITE_OXIDIAN_ENTRY_SLUG`).
- `/oxidian` → redirige a la landing publica para no exponer el acceso maestro.
- `/menu` → tienda modelo `default`.
- `/admin` → admin de la tienda modelo `default`.
- `/s/:storeSlug/menu` → menu de cada cliente.
- `/s/:storeSlug/admin` → admin de cada cliente.
- `/s/:storeSlug/pedidos` → cocina de cada cliente.
- `/s/:storeSlug/repartidor` → reparto de cada cliente.
- `/onboarding?token=...` → alta final del cliente tras el pago.

## Flujo de venta

1. El cliente entra en la landing de Oxidian.
2. Selecciona un plan cargado desde `store_plans`.
3. Abre Stripe Checkout con metadata del negocio y del owner.
4. La webhook o la pantalla de exito provisionan la tienda:
   - crean `stores`
   - crean `store_process_profiles`
   - crean `store_runtime_profiles`
   - clonan el catalogo desde `default`
   - generan token de onboarding
5. El cliente entra en `/onboarding`, fija contrasena owner y branding inicial.
6. La tienda queda activa para terminar de cargar productos, staff y configuracion.

## Separacion arquitectonica

- Control plane:
  - landing publica
  - Stripe checkout
  - super admin Oxidian
  - provisioning
- Tenant plane:
  - menu
  - admin
  - cocina
  - repartidor
  - afiliados
  - runtime local del chatbot

## Runtime local del chatbot

- No forma parte del deploy web principal.
- Cada tienda descarga su portable desde su admin.
- Solo se conecta cuando la sede instala el servidor local y escanea el QR.
- Si no hay portable, la tienda sigue operando por WhatsApp manual y por el flujo web normal.
