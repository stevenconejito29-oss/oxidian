# CarmoCream Codex Memory

## Objetivo de esta memoria

Este documento funciona como memoria operativa viva del proyecto. Su finalidad es:

- Registrar la arquitectura real que existe hoy.
- Dejar constancia de flujos criticos y dependencias.
- Anotar deuda tecnica, riesgos y decisiones tomadas.
- Mantener un historial corto de cambios para evitar perder contexto entre sesiones.

Regla de mantenimiento:

- Toda intervencion relevante debe actualizar este archivo.
- Cada cambio debe registrar fecha, area afectada, motivo, archivos tocados y riesgos residuales.
- Si una decision afecta ventas, operativa o seguridad, debe quedar documentada aqui.

## Estado auditado

- Fecha de auditoria inicial: 2026-03-24
- Workspace: `C:\Users\steven\Downloads\carmocream\carmocream`
- Stack principal: React 18 + Vite + Supabase + Service Worker manual
- App orientada a tres pilares:
  - Cliente: menu y compra
  - Cocina: preparacion de pedidos
  - Repartidor: entrega y caja de reparto
  - Admin: operacion y configuracion

## Mapa rapido del proyecto

### Entradas principales

- `src/main.jsx`
  - Router principal.
  - Cambia el `manifest` segun ruta.
  - Registra `service-worker.js`.
  - Mantiene gate PWA para cliente.

### Rutas activas detectadas

- `/` -> `PWAGate`
- `/menu` -> `Menu`
- `/admin` -> `Admin`
- `/pedidos` -> `Pedidos`
- `/repartidor` -> `Repartidor`
- `/afiliado` -> `AffiliatePortal`

### PWA y manifiestos

- `public/manifest.json`
  - PWA general del menu.
  - `start_url: /menu`
- `public/manifest-cocina.json`
  - PWA de cocina.
  - Actualmente `orientation: portrait-primary`
- `public/manifest-repartidor.json`
  - PWA de repartidor.
  - `orientation: portrait-primary`
- `public/service-worker.js`
  - Cachea shell con `['/', '/menu', '/logo.png', '/manifest.json']`
  - Tiene comportamiento heredado orientado al menu.

## Modulos y archivos clave

### Cocina

- `src/pages/Pedidos.jsx`
  - Gestiona sesion local para cocina.
  - TTL local de 8h.
  - Al cerrar sesion pone `staff_users.is_online = false`.
- `src/pages/PedidosContent.jsx`
  - Vista principal de cocina.
  - Usa `useRealtimeOrders`.
  - Autoasigna pedidos de cocina si el empleado esta online.
  - Flujo actual:
    - `pending` -> `preparing`
    - `preparing` -> `ready`
  - Imprime ticket al pasar a `ready`.

### Repartidor

- `src/pages/Repartidor.jsx`
  - Gestiona sesion local para repartidor.
  - TTL local de 8h.
  - Al cerrar sesion pone `staff_users.is_online = false`.
- `src/pages/RepartidorContent.jsx`
  - Vista principal de reparto.
  - Usa `useRealtimeOrders`.
  - Autoasigna pedidos listos si el repartidor esta online.
  - Flujo actual:
    - `ready` -> `delivering` al recoger
    - `delivering` -> `delivered` al verificar codigo o confirmar manualmente
  - Incluye caja del repartidor y cierres de efectivo.

### Login staff

- `src/pages/StaffLogin.jsx`
  - Login por `role`.
  - Hash SHA-256 compatible con admin.
  - Al autenticar pone `last_login` e `is_online = true`.
  - Riesgo actual:
    - Si el usuario abandona la app o expira la sesion sin pasar por logout, puede quedar online en base de datos.

### Pedidos y realtime

- `src/lib/useRealtimeOrders.js`
  - Hook central para pedidos.
  - Hace refresh completo ante cualquier `INSERT`, `UPDATE` o `DELETE`.
  - Filtra por `status`, `assigned_cook_id` y `assigned_rider_id`.

- `src/lib/autoAssign.js`
  - Autoasignacion de cocina y repartidor.
  - Carga empleados `active = true` y `is_online = true`.
  - Asigna pedidos sin responsable segun menor carga.
  - Cocina cuenta carga en `pending`, `preparing`, `ready`.
  - Repartidor cuenta carga en `delivering`.

### Admin

- `src/pages/Admin.jsx`
  - Punto de montaje del panel.
  - Carga pedidos, productos, toppings, ajustes, combos, cupones, afiliados y mas.
  - Contiene navegacion extensa y mezcla varias responsabilidades.
  - Tabs activas detectadas:
    - `dashboard`
    - `orders`
    - `products`
    - `toppings`
    - `combos`
    - `affiliates`
    - `coupons`
    - `stats`
    - `insights`
    - `finance`
    - `stock`
    - `caja`
    - `staff`
    - `roles`
    - `wasettings`
    - `chatbot`
    - `pwa`
    - `loyalty`
    - `reviews`
    - `settings`

## Flujo operativo actual del pedido

### Flujo funcional observado

1. Cliente genera pedido en `orders`.
2. Cocina online recibe pedidos `pending`.
3. `autoAssign` reparte a cocina segun carga.
4. Cocina cambia:
   - `pending` -> `preparing`
   - `preparing` -> `ready`
5. Al pasar a `ready`, se lanza `autoAssign` para repartidores.
6. Repartidor online recoge:
   - `ready` -> `delivering`
7. En destino:
   - envio de codigo por WhatsApp
   - verificacion o entrega manual
8. Cierre:
   - `delivering` -> `delivered`
   - se refresca caja del repartidor
   - se agenda solicitud de resena

### Dependencias de negocio

- `staff_users`
  - controla disponibilidad real de cocina y repartidor
- `orders`
  - fuente unica del estado operativo
- `settings`
  - define textos y ajustes dinamicos
- `cash_entries`
  - cierre de caja y reparto

## Hallazgos importantes de la auditoria

### PWA

- Existen manifiestos separados para cocina y repartidor.
- Sigue activo el PWA general del menu con gate obligatorio.
- El `service-worker.js` sigue cacheando `/menu` y `/manifest.json`.
- Cocina esta configurada como vertical en el manifiesto, pero la necesidad operativa nueva es horizontal para tablet.

### Cocina

- La vista ya tiene una base buena, pero mezcla layout tablet con varios estilos inline que dificultan escalar y ajustar ergonomia.
- La cola de pedidos es horizontal, pero el detalle y la distribucion todavia se pueden optimizar para uso intensivo en tablet.
- La logica de checks y avance esta dentro del mismo archivo, lo que dificulta mantenerla.

### Repartidor

- La vista ya esta muy orientada a movil vertical.
- El flujo de entrega funciona, pero conviene reforzar la gestion de online/offline y limpiar estados al salir o cerrar pestaña.
- Hay bastante logica de caja y reparto en el mismo componente.

### Online/offline de empleados

- `StaffLogin` fuerza `is_online = true` al entrar.
- `Pedidos.jsx` y `Repartidor.jsx` fuerzan `is_online = false` al cerrar sesion manualmente.
- Riesgo actual:
  - No hay garantia fuerte de poner offline si se cierra pestaña, expira TTL o se mata la app.
- Necesidad definida por negocio:
  - El estado por defecto debe ser offline.
  - Si el usuario no activa online, nunca debe entrar en asignacion.
  - Al cerrar sesion siempre debe quedar offline.

### Admin

- El panel actual esta sobrecargado para la fase operativa inicial.
- Hay demasiado alcance mezclado para empezar a recibir pedidos con fiabilidad.
- La simplificacion pedida debe dejar solo lo esencial:
  - pedidos
  - preparacion
  - reparto
  - chatbot
  - caja y rentabilidad
  - productos

## Historial de cambios

### 2026-03-25 · Negocio, productos, sistema y rider

- Motivo:
  - llevar `Negocio` a un cierre diario mas util
  - devolver control editable de secciones del catalogo
  - ordenar ajustes generales para operacion real
  - ocultar caja interna al rider y dejar su flujo mas limpio

- Archivos tocados:
  - `src/lib/cashReporting.js`
  - `src/pages/AdminBusinessTab.jsx`
  - `src/pages/AdminAccountingTab.jsx`
  - `src/pages/AdminProductsTab.jsx`
  - `src/pages/AdminCombosTab.jsx`
  - `src/pages/Menu.jsx`
  - `src/pages/Admin.jsx`
  - `src/pages/RepartidorContent.jsx`
  - `src/lib/productSections.js`
  - `src/lib/usePWAInstall.js`
  - `src/pages/PedidosContent.jsx`

- Cambios aplicados:
  - `Negocio` ahora tiene gestor de ticket diario con selector de fecha, resumen operativo e impresion directa de caja.
  - La impresion de caja se centralizo en `src/lib/cashReporting.js` para reutilizar la misma logica entre `Negocio` y `Contabilidad`.
  - El ticket diario ya puede incluir nombre del negocio, cabecera y pie configurables desde ajustes.
  - `Productos` ya permite crear, editar y guardar secciones dinamicas del menu; esas secciones se reutilizan en productos, combos y cliente.
  - `Sistema` gano claves mas utiles para arranque operativo:
    - `cash_ticket_header`
    - `cash_ticket_footer`
    - `rider_close_note`
    - `support_hours`
    - `pickup_note`
  - `Repartidor` ya no ve caja ni pagos propios; solo ve estado operativo y puede enviar entregas cobradas a revision admin.
  - La nota de cierre del rider ahora puede configurarse desde ajustes y aparece en su flujo real.
  - Cocina y repartidor mantienen boton PWA con soporte mejorado para iOS y webviews.

- Riesgos residuales:
  - `RepartidorContent.jsx` sigue siendo un componente grande y conviene seguir partiendolo por bloques.
  - `Admin.jsx` todavia concentra demasiada responsabilidad estructural aunque la vista ya este mas clara.

- Verificacion:
  - `npm run build` OK el 2026-03-25.

### 2026-03-25 · Alineacion de base de datos desde ERD

- Motivo:
  - comparar el ERD entregado en `supaaaa.svg` con las consultas reales del frontend
  - consolidar una migracion unica para dejar esquema y app coordinados

- Archivos tocados:
  - `SUPABASE_MIGRATION_2026_03_25_SCHEMA_ALIGNMENT.sql`

- Hallazgos clave:
  - `daily_sales_summary` era un punto fragil: la app lo consume como resumen vivo, pero en migraciones antiguas podia quedar como tabla estatica. Se corrigio a vista derivada de `orders`.
  - `staff_users.is_online` debia quedar alineado con el flujo nuevo: default `false`.
  - `products` necesitaba consolidar `size_descriptions`, arrays de toppings y flags club.
  - El ERD incluye tablas que no eran criticas en la UI actual pero conviene dejar creadas o aliasadas para no perder consistencia: `extra_mix`, `product_recipes`, `whatsapp_sessions`, `whatsapp_session`.
  - Se unificaron grants/policies CRUD publicas para compatibilidad con la arquitectura actual basada en frontend + Supabase directo.

- Riesgo residual:
  - Esta migracion esta alineada contra el repo y el ERD entregado, no contra un dump real de tu instancia activa. Si tu base productiva tiene cambios manuales fuera del repo, conviene sacar despues un schema dump real para diff final.
  - club
  - contabilidad simplificada y fusionada

## Riesgos tecnicos actuales

- Mucho estilo inline en cocina y repartidor.
- `Admin.jsx` es muy grande y concentra demasiada logica.
- El service worker tiene shell pensado para menu, no para separar bien experiencias operativas.
- La autoasignacion depende por completo de `is_online`; si ese dato queda sucio, el reparto de carga tambien queda sucio.
- Persistencia de sesion staff en `localStorage` puede mantener contexto de usuario aunque el backend ya deba considerarlo offline.

## Decision operativa adoptada para las siguientes fases

### Fase 1

- Crear y mantener esta memoria como fuente de contexto.

### Fase 2

- Separar y reforzar la estrategia PWA:

## Cambios aplicados 2026-03-24

### Admin simplificado sin amputar modulos clave

- `src/pages/Admin.jsx`
  - Se retiro `Inteligencia` del flujo de arranque.
  - Se elimino `PWA & Push` del admin operativo.
  - Se creo una vista unificada `Negocio` para fusionar:
    - estadisticas
    - contabilidad
    - rentabilidad
    - pulso resumido de stock
  - Se mantuvieron visibles y activos:
    - productos
    - toppings
    - combos
    - stock
    - chatbot WhatsApp
    - marketing settings
    - club y fidelidad
    - reseñas
    - afiliados
    - cupones
    - ajustes
    - roles
  - Se añadieron redirecciones de compatibilidad para tabs antiguas:
    - `finance` -> `business`
    - `caja` -> `business`
    - `stats` -> `business`
    - `insights` -> `business`
    - `pwa` -> `wasettings`
  - El permiso `Negocio` mantiene compatibilidad con permisos heredados (`finance`, `caja`, `stats`, `insights`, `products`) para no bloquear admins antiguos.

### Stock fusionado mejor con lectura economica

- `src/pages/AdminStockTab.jsx`
  - La fecha de caducidad ya no es obligatoria.
  - Los articulos sin vencimiento quedan soportados con `expiry_date = null`.
  - El stock ahora muestra:
    - valor economico del inventario
    - conteo de articulos sin caducidad
    - alertas de proximidad y caducidad solo cuando aplica
  - La lectura de stock queda mejor alineada con contabilidad y rentabilidad.

### Estado funcional esperado tras esta pasada

- Admin:
  - el arranque operativo principal se concentra en `Negocio`, `Pedidos`, `Preparacion y reparto`, `Productos`, `Toppings`, `Chatbot WA` y `Marketing settings`
- Catalogo:
  - la relacion producto <-> categorias topping <-> toppings sigue viva desde `AdminProductsTab` y `AdminToppingsTab`
- Stock:
  - puede representar ingredientes o consumibles con o sin fecha de vencimiento

### Verificacion tecnica

- `npm run build` ejecutado correctamente el 2026-03-24 tras estos cambios.

## Cambios aplicados 2026-03-24 · segunda pasada

### Nuevo centro unico de negocio

- `src/pages/AdminBusinessTab.jsx`
  - Se crea un sistema unico para negocio en vez de mezclar varias subpantallas.
  - Reune en una sola vista:
    - ventas netas
    - ticket medio
    - gasto operativo
    - pagos a repartidores
    - utilidad operativa estimada
    - caja pendiente de validar
    - ritmo diario de ventas
    - cierres de riders pendientes
    - pagos pendientes a riders
    - productos que mas ganan
    - alertas de catalogo por margen o falta de coste
    - stock con impacto financiero
  - Incluye accion directa para:
    - registrar gasto
    - validar caja de repartidor
    - registrar pago a repartidor
    - saltar a pedidos, stock o catalogo

- `src/pages/Admin.jsx`
  - La tab `business` deja de incrustar modulos separados y ahora monta `AdminBusinessTab`.

### Repartidor simplificado para operacion real

- `src/pages/RepartidorContent.jsx`
  - Se elimina ruido no esencial en la cabecera resumen.
  - Se quita la lectura de bateria del dashboard.
  - El resumen queda centrado en:
    - pedidos por recoger
    - pedidos en ruta
    - pedidos pendientes de liquidar
    - ganancia delivery pendiente
  - La caja del repartidor prioriza:
    - efectivo pendiente de entregar
    - ganancia pendiente
    - pagado acumulado
  - Se quita el bloque redundante con el telefono escrito grande en la mision principal; quedan acciones directas de llamada y WhatsApp.

### Criterio aplicado

- Se adopta un patron mas cercano a software de delivery/restaurante de mercado:
  - una sola vista operativa-financiera
  - acciones de caja y reparto visibles sin navegar por tres pantallas
  - rider app centrada en mision actual, liquidacion y entrega

### Verificacion tecnica

- `npm run build` vuelve a pasar correctamente tras esta segunda pasada.
  - cocina individual
  - repartidor individual
  - eliminar el enfoque PWA del menu
  - dejar acceso directo al menu

### Fase 3

- Rehacer ergonomia operativa:
  - cocina en horizontal para tablet
  - repartidor en vertical para movil

### Fase 4

- Blindar flujo staff:
  - offline por defecto
  - logout y cierre seguros
  - autoasignacion dependiente solo de personal realmente online

### Fase 5

- Reducir admin al minimo operativo rentable.

## Update 2026-03-25 15:30

- Area: AdminProductsTab — responsive del formulario Secciones del menú
- Motivo: el bloque "Secciones del menú" no era responsive en móvil; los botones y las tarjetas se desbordaban en pantallas pequeñas; también los botones de acción en la lista de productos no envolvían correctamente
- Archivos: `src/pages/AdminProductsTab.jsx`, `src/pages/Admin.module.css`
- Cambio:
  - Se eliminaron los estilos inline del encabezado del bloque de secciones y del pie de cada tarjeta de sección
  - Se crearon tres clases CSS nuevas en `Admin.module.css`: `.sectionsFormHeader`, `.sectionsFormActions`, `.sectionCardFooter`
  - `sectionsFormHeader` se apila verticalmente en ≤ 599px; `sectionsFormActions` ocupa ancho completo y sus botones se distribuyen en flex-1
  - `adminChoiceGrid` colapsa a `1fr` en ≤ 599px de forma explícita
  - `sectionCardFooter` alinea el botón Eliminar a la derecha en una segunda fila cuando el espacio no alcanza
  - En ≤ 899px se añadió `flex-wrap: wrap; gap: 4px` a `.itemActions` para que los botones de la lista de productos no se desborden
- Riesgos pendientes: ninguno nuevo; build correcto
- Verificacion: `npm run build` OK 2026-03-25



## Update 2026-04-06 · Fix multi-tienda — 7 bugs resueltos en una pasada

- Area: OXIDIAN super admin, login multi-tienda, sidebar testids, settings tab, store_id backfill
- Motivo: auditoría completa reveló 7 bugs que bloqueaban el flujo SaaS real: login de owners de tienda, tab links sin contenido, settings con componente incorrecto, sidebar sin testids para tests, store_id NULL en DB

### Archivos modificados

- `src/pages/OxidianPage.jsx`
  - Añadidas funciones: `buildCleanLinks`, `LinkCopyRow`, `LinksTabContent`
  - Tab "Links de acceso" ahora renderiza links copiables por tienda con URLs `/s/<storeCode>/` limpias
  - Links en Overview y Roles actualizados a formato `/s/<storeCode>/` en vez de `?store=`

- `src/pages/Admin.jsx`
  - BUG 2 corregido: Login modo 'super' ahora busca primero `admin_password_hash` en `store_settings` para stores no-default, luego hace fallback a `settings` global → owners de cada tienda pueden entrar a su propio `/admin`
  - BUG 3+4 corregidos: Tab 'settings' ahora monta `AdminStoreCustomizationPanel` (correcto) en vez de `AdminBusinessTab` (incorrecto)
  - BUG 5 corregido: Añadidos `data-testid="store-admin-password"` y `data-testid="store-admin-login-button"` al formulario de login
  - BUG 6 corregido: Añadidos `data-testid="admin-sidebar-hub-{id}"` a botones de hub del sidebar y `data-testid="admin-tab-{id}"` a botones de tabs

- `supabase/migrations/20260406_backfill_store_id_default.sql` (NUEVO)
  - BUG 7 corregido: Backfill idempotente de `store_id = 'default'` para todos los registros con NULL en: products, combos, toppings, topping_categories, orders, stock_items, stock_item_products, coupons, affiliates, affiliate_applications, staff_users, cash_entries, loyalty_members, reviews, chatbot_conversations
  - Protegido con `information_schema.columns` check → no falla si columna no existe

### Verificacion

- `npm run build` OK — 165 módulos, 2.81s, cero errores (2026-04-06)

### ⚠️ Acción requerida antes de testar

1. Ejecutar `20260406_backfill_store_id_default.sql` en Supabase Dashboard → SQL Editor
2. Push a Vercel para deploy del build

- Riesgos pendientes: ninguno nuevo


```md
## Update YYYY-MM-DD HH:mm

- Area:
- Motivo:
- Archivos:
- Cambio:
- Riesgos pendientes:
- Verificacion:
```

## Update 2026-04-06 · Auditoría OXIDIAN completa — 6 bugs resueltos + modelo tienda plantilla confirmado

- Area: multi-tenant isolación, Admin.jsx dashboard, router main.jsx, chatbot portable, documentación
- Motivo: auditoría archivo por archivo de todo el proyecto para dejarlo como plantilla perfecta para nuevas tiendas OXIDIAN. El chatbot es OPCIONAL: las tiendas funcionan sin él hasta que se instale y escanee el QR.

### Archivos modificados

- `src/main.jsx`
  - BUG 1 corregido: eliminada ruta `/s/:storeSlug/oxidian` — OXIDIAN super admin solo accesible en `/oxidian` global. Acceder por slug de tienda era un fallo de seguridad.

- `src/pages/Admin.jsx`
  - BUG 2 corregido: `buildOrderStatusUpdate('preparing')` → `buildOrderStatusUpdate(order, 'preparing')` — los botones rápidos del dashboard llamaban la función con un solo arg (el status como string), dejando `order` = 'preparing' y `nextStatus` = undefined. El update enviaba `{ status: undefined }` a Supabase, que lo ignoraba silenciosamente. El estado del pedido nunca cambiaba aunque el toast dijera "En preparación". Fix aplicado a los 3 botones: preparar, en camino, entregado.
  - BUG 3 corregido: `BusinessTab.loadStockPulse()` consultaba `stock_items` sin filtro `store_id` → mezclaba el inventario de todas las tiendas. Fix: añadido `.eq('store_id', scopedId)`.
  - BUG 4 corregido: `<BusinessTab>` montado sin prop `storeId` → el fix anterior no tenía efecto sin pasar el valor. Fix: añadido `storeId={normalizeStoreId(...)}` en el render.

- `chatbot-local/iniciar.bat`
  - Mejorado: cabecera ahora documenta el modelo OXIDIAN multi-tienda y la variable `CHATBOT_STORE_ID`.
  - Mejorado: PASO 4 lee `CHATBOT_STORE_ID` del `.env` y lo muestra en pantalla al arrancar (`Tienda activa (CHATBOT_STORE_ID): xxx`). Así el operador siempre sabe qué tienda está manejando ese bot.

- `admin-desktop/chatbot-source/DEPRECADO.md` (NUEVO)
  - Documenta que esta carpeta es legacy y la fuente oficial activa es `chatbot-local/`.
  - Incluye plantilla completa del `.env` que debe recibir cada tienda nueva OXIDIAN.

### Confirmado: arquitectura correcta

- **Chatbot opcional**: `isChatbotConfigured()` en `chatbotConfig.js` devuelve `false` si no hay URL → `sendWhatsAppAuto()` retorna `{ sent: false }` sin bloquear el flujo operativo. Los pedidos se gestionan en Supabase independientemente.
- **WhatsApp manual**: funciona siempre. El chatbot solo añade automatización cuando está instalado y conectado (QR escaneado).
- **Aislamiento multi-tenant**: verificado en `useRealtimeProducts`, `Admin.jsx`, `order-notifier.js`, `commerce-ai.js`, `customer-memory.js`, `store-scope.js`. Todos filtran por `store_id`.
- **Ruta OXIDIAN**: solo `/oxidian` (global). No hay ruta por slug de tienda.

### Deuda técnica residual

- `admin-desktop/chatbot-source/` sigue existiendo con código desactualizado. Documentada como DEPRECADA. Si el exe de admin desktop necesita actualización, compilar desde `chatbot-local/`.
- RLS real en Supabase (Row Level Security por `store_id`) pendiente para cuando haya múltiples tiendas reales en producción compartiendo la misma instancia de Supabase.

### Verificacion

- `npm run build` pendiente — aplicar después de esta sesión
- Sin errores esperados: los cambios son quirúrgicos y compatibles con el build actual


## Registro de cambios

## Update 2026-03-24 00:00

- Area: memoria operativa
- Motivo: crear una fuente de contexto persistente antes de refactorizar PWA, cocina, repartidor y admin
- Archivos: `docs/CODEX_MEMORY.md`
- Cambio: se documenta arquitectura, rutas, flujos, riesgos y plan de simplificacion
- Riesgos pendientes: la memoria aun no refleja cambios funcionales porque la refactorizacion todavia no ha empezado
- Verificacion: auditoria manual de `src/main.jsx`, vistas staff, `autoAssign`, realtime, manifiestos y service worker

## Update 2026-03-24 01:00

- Area: PWA, staff, cocina, repartidor y admin
- Motivo: empezar la simplificacion operativa real para cocina y reparto sin mantener la PWA del menu
- Archivos: `src/main.jsx`, `index.html`, `public/manifest-cocina.json`, `public/manifest-repartidor.json`, `public/service-worker.js`, `src/lib/staffPresence.js`, `src/lib/autoAssign.js`, `src/pages/StaffLogin.jsx`, `src/pages/Pedidos.jsx`, `src/pages/Repartidor.jsx`, `src/pages/PedidosContent.jsx`, `src/pages/Pedidos.module.css`, `src/pages/RepartidorContent.jsx`, `src/pages/Repartidor.module.css`, `src/pages/Admin.jsx`
- Cambio:
  - el menu queda accesible directo en `/` y `/menu`, sin gate PWA
  - solo cocina y repartidor publican manifest instalable
  - cocina pasa a `landscape-primary`
  - el service worker deja de cachear el manifest del menu como shell principal
  - el login staff ya no entra online por defecto
  - al restaurar sesion staff se fuerza offline inicial y se manda offline al salir o cerrar pagina
  - la autoasignacion de riders ahora cuenta pedidos `ready` y `delivering`
  - al entregar un pedido en reparto se vuelve a lanzar autoasignacion
  - cocina gana mejor lectura tablet con resumen de estados y pista de flujo para pedidos listos
  - repartidor mejora legibilidad vertical en resumen y caja
  - el admin se recorta a modulos esenciales y fusiona `caja + rentabilidad` y `chatbot + WhatsApp`
- Riesgos pendientes:
  - `Admin.jsx` sigue siendo un archivo demasiado grande aunque ya muestra menos modulos
  - cocina y repartidor aun tienen bastante estilo inline y conviene seguir modularizando
  - `public/manifest.json` sigue existiendo en el repo pero ya no se inyecta desde `index.html`
- Verificacion: `npm run build` correcto

## Update 2026-03-24 01:20

- Area: revision de flujo post-refactor
- Motivo: repasar los cambios hechos y corregir inconsistencias de experiencia y presencia staff
- Archivos: `src/lib/usePWAInstall.js`, `src/pages/Admin.jsx`, `src/pages/Pedidos.jsx`, `src/pages/Repartidor.jsx`
- Cambio:
  - el hook de instalacion PWA ahora admite desactivacion explicita por contexto
  - admin deja de mostrar acciones de instalacion PWA que ya no aplican a ese panel
  - cocina y repartidor fuerzan beacon offline tambien al desmontarse dentro de la SPA
- Riesgos pendientes:
  - sigue pendiente una refactorizacion mas profunda del admin para dividir responsabilidades internas
  - la vista de cocina aun puede evolucionar a carriles visuales separados por estado si se quiere una tablet UX mas fuerte
- Verificacion: `npm run build` correcto

## Update 2026-03-24 01:35

- Area: admin de catalogo
- Motivo: reactivar la gestion de toppings porque el editor de productos depende de categorias y toppings reales
- Archivos: `src/pages/Admin.jsx`
- Cambio:
  - vuelve a mostrarse la pestaña `toppings` dentro de `Catalogo`
  - se vuelve a montar `AdminToppingsTab`
  - el flujo de producto recupera la gestion completa de categorias y toppings desde admin
- Riesgos pendientes:
  - combos sigue fuera del flujo principal visible; si vuelve a ser necesario habra que reintroducirlo igual que toppings
- Verificacion: `npm run build` correcto

## Update 2026-03-24 01:55

- Area: admin navegacion y modulos
- Motivo: corregir una simplificacion excesiva; restaurar modulos que no debian desaparecer y dejar simplificada solo la parte contable
- Archivos: `src/pages/Admin.jsx`
- Cambio:
  - se restauran estadisticas, inteligencia, combos, resenas, afiliados, cupones, PWA, WA settings y roles
  - `rentabilidad` vuelve a estar separada de `contabilidad`
  - `contabilidad` queda como hub simplificado de caja y control economico, sin esconder el resto del panel
- Riesgos pendientes:
  - `Admin.jsx` sigue necesitando una refactorizacion estructural posterior porque monta demasiados modulos desde un solo archivo
- Verificacion: `npm run build` correcto

## Update 2026-03-24 02:05

- Area: prioridad del admin
- Motivo: dar mas peso visual a pedido, productos, toppings, chatbot y marketing settings sin volver a recortar funcionalidades
- Archivos: `src/pages/Admin.jsx`
- Cambio:
  - `Pedidos`, `Preparacion y reparto` y `Contabilidad` quedan primero en operaciones
  - `Productos` y `Toppings` quedan claramente visibles en catalogo
  - `Chatbot WA` y `Marketing settings` pasan al frente dentro de marketing
  - el resto de modulos se mantiene, pero con menos protagonismo
- Riesgos pendientes:
  - el admin sigue cargando muchos modulos en un unico archivo; la mejora actual es de jerarquia y navegacion, no de arquitectura interna
- Verificacion: `npm run build` correcto

## Update 2026-03-25 11:40

- Area: reparto, caja e historial imprimible
- Motivo: simplificar la vista del rider dejando solo informacion operativa al frente y mover pagos/historial a un desplegable util
- Archivos: `src/pages/RepartidorContent.jsx`, `src/pages/Repartidor.module.css`
- Cambio:
  - se elimina `Pagado` del panel principal de caja del rider
  - la tarjeta principal se queda con pendientes, efectivo a entregar, ganancia pendiente y entregados hoy
  - se agrega un desplegable `Pagos e historial` con pagos recibidos, ultimo cierre y lista cronologica de cierres/pagos
  - se agrega impresion del registro de caja del rider con resumen y tabla de movimientos
  - se reduce ruido visual en la vista principal para priorizar recoger, salir, entregar y liquidar
- Riesgos pendientes:
  - el historial imprimible depende de los `cash_entries` ya existentes; si en produccion faltan notas estructuradas de cierres/pagos, esos movimientos viejos no podran clasificarse bien
- Verificacion: `npm run build` correcto

## Update 2026-03-25 14:10

- Area: formularios admin, tamanos de producto, stock y pagos de riders
- Motivo: pulir la experiencia de alta/edicion para catalogo y usuarios, agregar descripciones por tamano y simplificar el control economico del stock sin romper el flujo operativo
- Archivos: `src/pages/AdminProductsTab.jsx`, `src/components/ProductModal.jsx`, `src/components/ProductModal.module.css`, `src/pages/Admin.module.css`, `src/pages/AdminStaffTab.jsx`, `src/pages/AdminRolesTab.jsx`, `src/pages/AdminToppingsTab.jsx`, `src/pages/AdminStockTab.jsx`, `src/pages/AdminBusinessTab.jsx`, `MIGRATION_2026_03_25_PRODUCT_SIZE_DESCRIPTIONS.sql`
- Cambio:
  - productos ahora admite `size_descriptions` por tamano (`small`, `medium`, `large`) con editor dedicado y compatibilidad retro si la columna aun no existe
  - el modal del menu muestra la descripcion del tamano al cliente para ayudar a conversion y claridad de compra
  - se agregan estilos compartidos para formularios admin y se aplican a producto, staff, roles, toppings y stock para una UX mas limpia y consistente
  - stock acepta articulos sin fecha de vencimiento, mejora notas y simplifica la tabla principal fusionando cantidad, control, coste y valor economico en una sola lectura
  - la vista de negocio usa `settings.delivery_fee` como respaldo cuando el pedido no trae `delivery_fee`, evitando subcontar pagos pendientes a repartidores
  - se deja una migracion dedicada para crear `products.size_descriptions`
- Riesgos pendientes:
  - si no se aplica `MIGRATION_2026_03_25_PRODUCT_SIZE_DESCRIPTIONS.sql`, las descripciones de tamano no se persistiran aunque el formulario siga funcionando en modo retrocompatible
  - algunos modulos viejos del admin siguen usando bastante estilo inline y conviene seguir migrandolos al sistema compartido
- Verificacion: `npm run build` correcto

## Update 2026-03-25 15:05

- Area: responsive admin
- Motivo: adaptar la vista de administrador y sus modulos principales para trabajo real tanto en vertical como en horizontal, sin romper los flujos operativos ya existentes
- Archivos: `src/lib/useResponsiveAdminLayout.js`, `src/pages/Admin.module.css`, `src/pages/Admin.jsx`, `src/pages/AdminDashboardTab.jsx`, `src/pages/AdminBusinessTab.jsx`, `src/pages/AdminFinanceTab.jsx`, `src/pages/AdminStaffTab.jsx`, `src/pages/AdminReviewsTab.jsx`, `src/pages/AdminLoyaltyTab.jsx`, `src/pages/AdminChatbotTab.jsx`
- Cambio:
  - se crea un hook de breakpoints compartido para el admin (`isPhone`, `isTablet`, `isCompact`) y se aplica en los modulos con grids rigidos
  - el shell del admin mejora en header, content y hero para portrait tablet y movil: mas wrap, mejor padding y side panels que ya no fuerzan columnas fijas
  - dashboard, negocio, finanzas, staff, resenas, club y chatbot dejan de depender de layouts de 2, 3, 4 o 6 columnas fijas cuando la pantalla se estrecha
  - modales y tarjetas internas de negocio/finanzas/staff/chatbot ahora colapsan a una columna en telefonos y tablets estrechas
  - el panel de staff mejora lectura en cards y carga operativa cuando se usa en vertical
- Riesgos pendientes:
  - siguen existiendo modulos secundarios del admin con bastante estilo inline que aun pueden necesitar una segunda pasada responsive mas fina
  - la validacion de esta pasada fue por integracion y build; queda pendiente un repaso visual manual completo modulo por modulo en navegador
- Verificacion: `npm run build` correcto


## Update 2026-04-04 · Auditoria completa del sistema — Brief para Codex

- Area: revision integral del proyecto, chatbot, admin desktop, modulos admin
- Motivo: preparar el estado real del sistema para que Codex pueda intervenir con contexto completo y sin regresar errores previos

### Estado del sistema auditado

#### Admin Desktop (Electron)
- Archivo principal: `admin-desktop/main.cjs`
- Estado: FUNCIONA CORRECTAMENTE
- Genera un ejecutable `.exe` via `electron-builder` con `npm run build` dentro de `admin-desktop/`
- Configuracion de runtime en `userData` del sistema operativo (no en el repo)
- La ventana de setup permite configurar: URL del panel admin, URL del chatbot local, WA secret
- Soporta URL dinamica sin recompilar: variable de entorno `CARMOCREAM_ADMIN_URL` o configuracion guardada
- NO TOCAR: `admin-desktop/main.cjs`, `admin-desktop/preload.cjs`

#### Chatbot Local (`chatbot-local/`)
- Servidor: `chatbot-local/server.js` — Express + WhatsApp Web.js + Supabase + Groq
- Logica: `chatbot-local/chatbot-logic.js` — intents, reglas, estados de conversacion
- IA: `chatbot-local/commerce-ai.js` + `chatbot-local/groq-client.js`
- Memoria: `chatbot-local/customer-memory.js`
- Panel standalone: `chatbot-local/admin-chatbot.html` — panel HTML independiente que conecta al servidor local via REST
- Arranque: `chatbot-local/iniciar.bat` — doble clic para levantar el servidor
- Variables necesarias: `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `WA_SECRET`, `ADMIN_PHONE`, `SHOP_URL`, `PORT`

### Problemas identificados en la auditoria

1. **Broadcast eliminado**: Si existen endpoints `/broadcast` o `/send-bulk` en `server.js` deben eliminarse. No funcionan y confunden el sistema. En `AdminChatbotTab.jsx` eliminar cualquier UI de broadcast masivo.

2. **Chatbot convertir a asistente de soporte**: El chatbot NO debe tomar pedidos nuevos. Los intents `order`, `confirm_order` deben redirigir al usuario a la web (`SHOP_URL`). El chatbot debe responder: horario, menu (con link), estado de pedido existente (consulta), zona de reparto, alérgenos, contacto. Las funciones `createOrderFromDraft`, `resolveRequestedItems`, `configurePendingComboFromMessage` deben desactivarse del flujo de usuario (pueden quedar como codigo inactivo o utilidades internas).

3. **Duplicado useNotifications**: Existen `src/lib/useNotifications.js` y `src/lib/useNotifications.jsx`. Verificar cual importa `Admin.jsx` y eliminar el otro.

4. **Duplicado CSS**: Existen `src/components/Cart.module.css` y `src/components/Cart_module.css`. Eliminar `Cart_module.css`.

5. **Cart.jsx con CRLF**: El archivo tiene line endings CRLF que impiden `edit_block`. Solución: leer con `read_file`, reescribir completo con `write_file` en modo rewrite+append para normalizar a LF.

6. **admin-chatbot.html sin fallback**: Si el servidor local no responde, el panel no muestra error al usuario. Añadir un banner rojo visible "Servidor chatbot no disponible — ejecuta iniciar.bat" cuando los fetch fallen.

7. **groq-client.js rate-limit**: Verificar que el error 429 (rate limit) queda normalizado y no crashea el flujo. Ya habia un fix previo, confirmar que sigue en pie.

### Sistema de IA del chatbot — descripcion funcional

- El sistema de IA tiene dos modos: modo cliente (responde WhatsApp) y modo admin (responde preguntas del operador en el panel)
- Endpoint admin `/chatbot/admin/ask` — asistente de negocio para el admin, NO para clientes
- Endpoint admin `/chatbot/admin/generate-copy` — generador de copies de marketing
- Endpoint admin `/chatbot/admin/playbook` — playbooks de negocio por foco
- La IA lee pedidos reales, ventas, stock e historial para contextualizar respuestas
- `customer-memory.js` mantiene perfil del cliente: nombre, pedidos previos, preferencias — preservar para soporte, no para flujo de pedidos

### Sistema de memoria y steps del chatbot

- `conversationState` en `chatbot-logic.js` — mapa de estado por telefono con TTL de 20 minutos
- `chatProfiles` — perfil de comportamiento del cliente con TTL de 12 horas
- El bot sigue un sistema de pasos (steps) dentro de `conversationState` para manejar flujos multi-turno
- Para soporte: el flujo de steps debe mantenerse para: consulta de estado de pedido, solicitud de cancelacion (si aplica), escalacion a humano
- Para pedidos nuevos: step debe redirigir a web sin crear drafts ni confirmar items

### Modulos admin activos y sus archivos

| Tab | Archivo | Estado |
|-----|---------|--------|
| Dashboard | AdminDashboardTab.jsx | OK |
| Pedidos | AdminOrdersTab.jsx | OK |
| Productos | AdminProductsTab.jsx | OK |
| Toppings | AdminToppingsTab.jsx | OK |
| Combos | AdminCombosTab.jsx | OK |
| Stock | AdminStockTab.jsx | OK |
| Negocio | AdminBusinessTab.jsx | OK |
| Contabilidad | AdminAccountingTab.jsx | OK |
| Finanzas | AdminFinanceTab.jsx | OK |
| Staff | AdminStaffTab.jsx | OK |
| Roles | AdminRolesTab.jsx | OK |
| Afiliados | AdminAffiliatesTab.jsx | OK |
| Chatbot | AdminChatbotTab.jsx | Revision pendiente (broadcast) |
| WA Settings | AdminWASettings.jsx | OK |
| PWA | AdminPWATab.jsx | OK |
| Club | AdminLoyaltyTab.jsx | OK |
| Reseñas | AdminReviewsTab.jsx | OK |
| Insights | AdminInsightsTab.jsx | OK |

### Variables de entorno activas

- Panel admin → chatbot: `VITE_LOCAL_CHATBOT_URL`, `VITE_LOCAL_CHATBOT_SECRET`
- Chatbot local → Supabase: `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`
- Chatbot local → WhatsApp: `WA_SECRET`, `ADMIN_PHONE`
- Chatbot local → IA: `GROQ_API_KEY` (u otro segun proveedor configurado)
- Web publica: `VITE_PUBLIC_WEB_URL`

### Archivos que NO deben tocarse sin revision previa

- `admin-desktop/main.cjs` — funciona bien
- `admin-desktop/preload.cjs` — funciona bien
- `src/pages/Admin.jsx` — orquestador central, requiere revision antes de editar
- `supabase/migrations/` — no modificar esquema sin migracion acompañante
- `public/service-worker.js` — cualquier cambio afecta cache PWA

### Como compilar el ejecutable admin

```bash
cd admin-desktop
npm install
npm run build
# El .exe queda en admin-desktop/dist/
```

### Como levantar el chatbot portable

```bash
cd chatbot-local
# Editar .env con SUPABASE_URL, SUPABASE_SERVICE_KEY, WA_SECRET, ADMIN_PHONE, SHOP_URL
npm install
# Opcion A: doble clic en iniciar.bat
# Opcion B:
node server.js
# Abrir admin-chatbot.html en navegador apuntando a http://localhost:3001
```

- Verificacion: auditoria manual 2026-04-04, build no ejecutado en esta sesion (pendiente tras correcciones de Codex)
- Riesgos pendientes:
  - Cart.jsx con CRLF pendiente de reescritura limpia
  - Broadcast debe eliminarse en esta sesion de Codex
  - Chatbot debe reconvertirse a modo soporte en esta sesion de Codex
  - Duplicados de archivos CSS y hooks deben resolverse

## Update 2026-04-05 · Fix multi-tienda completo — 5 problemas resueltos

- Area: routing multi-tienda, manifest PWA, cache settings, headers Vercel, UI links
- Motivo: las rutas por slug de tienda redireccionaban la URL (perdiendo la URL limpia), el manifest dinámico no existía, useSettings tenía singleton cache, los headers noindex no cubrían rutas /s/*, y no había UI para conocer los links propios de cada tienda.

### Archivos modificados

- `vercel.json`
  - Se añaden headers `X-Robots-Tag: noindex` y `Cache-Control: no-store` para `/s/:storeSlug/admin`, `/s/:storeSlug/pedidos` y `/s/:storeSlug/repartidor`
  - Se eliminó la duplicación del bloque headers que quedó accidentalmente en sesión anterior

- `api/manifest.js` (NUEVO)
  - Vercel Serverless Function que genera manifests PWA dinámicos por tienda
  - Lee `business_name`, `logo_url`, `theme_primary_color`, `theme_surface_color` de Supabase (`config_tienda` para default, `store_settings` para sedes)
  - Soporta tipos: `menu`, `cocina`, `repartidor`
  - URL: `/api/manifest?store=<storeId>&type=<tipo>`
  - Usa `SUPABASE_SERVICE_ROLE_KEY` o `VITE_SUPABASE_ANON_KEY`

- `src/lib/currentStore.js`
  - `getRequestedStoreId()` ahora detecta el store en dos fuentes:
    1. Query param `?store=<slug>` (comportamiento anterior)
    2. Path `/s/<slug>/...` (nuevo — para URLs limpias sin redirect)

- `src/main.jsx`
  - Las rutas `/s/:storeSlug/*` ya NO redirigen a `?store=`. Renderizan la página directamente.
  - `StoreSlugRedirect` se mantiene como fallback/compatibilidad pero no se usa en rutas activas
  - `syncManifestForRoute` actualizado para detectar storeId también desde el path

- `src/lib/useSettings.js`
  - Se elimina la variable `cache` (singleton global que causaba colisiones entre tiendas)
  - Se sustituye por `cacheByStore` (Map keyed by storeId)
  - Los 5 handlers de realtime actualizados para usar `cacheByStore.set()` en lugar de `cache =`
  - Se extrae `reloadAndBroadcast(storeId)` como función utilitaria para reducir duplicación
  - `getUrlStoreId()` actualizado para detectar también path `/s/:slug/...`

- `src/components/admin/StoreLinksPanel.jsx` (NUEVO)
  - Componente que muestra los 5 links independientes de cada tienda con botón "Copiar"
  - Links: Menú, Admin, Portal afiliados, PWA Cocina, PWA Repartidor
  - Construye URLs usando `window.location.origin` + prefix `/s/<storeCode>` si no es default
  - Integrable en cualquier panel de admin

- `src/pages/AdminStoreCustomizationPanel.jsx`
  - Importa y monta `StoreLinksPanel` al inicio del return, antes del formulario
  - Se cierra correctamente con Fragment `<>...</>`

### URLs de tienda por slug (ejemplo con storeCode="carmona")

| Recurso | URL limpia | Permanece en barra |
|---------|-----------|-------------------|
| Menú cliente | `/s/carmona/menu` | ✅ Sí |
| Panel admin | `/s/carmona/admin` | ✅ Sí |
| Portal afiliados | `/s/carmona/afiliado` | ✅ Sí |
| PWA Cocina | `/s/carmona/pedidos` | ✅ Sí |
| PWA Repartidor | `/s/carmona/repartidor` | ✅ Sí |
| Manifest PWA | `/api/manifest?store=carmona&type=cocina` | ✅ Sí |

### Para probar

1. `npm run build` en `C:\Users\steven\Downloads\carmocream\carmocream`
2. Desplegar en Vercel (push a main)
3. Navegar a `/admin` → tab "Negocio y personalización" → ver el panel "Links de esta tienda"
4. Navegar a `/s/default/menu` → debe cargar el menú sin redirect
5. Verificar `/api/manifest?store=default&type=cocina` en Vercel → debe devolver JSON válido

- Verificacion: build pendiente tras esta sesion
- Riesgos pendientes:
  - `/api/manifest.js` requiere que las env vars `SUPABASE_SERVICE_ROLE_KEY` y `VITE_SUPABASE_URL` estén en Vercel Dashboard
  - El storeCode "default" no genera prefix /s/ en los links (comportamiento correcto)
  - Si el storeCode en `config_tienda` es diferente al slug usado en la URL, los links del panel mostrarán el code guardado en DB (correcto, usar siempre el mismo slug)

---

## Sesión de auditoría y corrección global — 2026-04-05

### Auditoría realizada por: Claude (Agente OXIDIAN)

Revisión completa archivo por archivo de todo el proyecto. Se identificaron y corrigieron los siguientes bugs:

### 🔴 BUGS CRÍTICOS CORREGIDOS

**1. Encoding UTF-8 corrupto — `chatbot-local/chatbot-logic.js`**
- `reseÃ±a` → `reseña` en array `INTENT.review` (el intent fallaba silenciosamente)
- `âœ…` → `✅` en mensaje de cancelación exitosa al cliente
- `reseÃ±a` → `reseña` en dos respuestas del intent review
- Causa: archivo guardado con encoding Windows-1252 mezclado con UTF-8

**2. Encoding UTF-8 corrupto — `src/pages/AdminChatbotTab.jsx`**
- `â€"` → `—` en comentario de cabecera
- 4× `Â·` → `·` en placeholders de proveedores IA (Gemini, HuggingFace, Groq, Anthropic, OpenAI-compatible)
- Causa: misma corrupción de encoding Windows, archivo guardado con CRLF

**3. Aislamiento multi-tenant roto — `chatbot-local/server.js`**
- `/chatbot/vip-customers`: consulta `orders` sin filtro `store_id` → mezclaba clientes de TODAS las tiendas
- `/chatbot/inactive-customers`: mismo problema
- Fix: añadido filtro condicional `.eq('store_id', runtimeStoreId)` cuando `runtimeStoreId !== 'default'`

**4. Dead code + handlers duplicados — `chatbot-local/server.js`**
- En `handleAdminRelayMessage`: bloque `list` tenía código inalcanzable tras `return` (8 líneas muertas)
- Handlers `release` y `resolve` definidos dos veces: uno con `inferSingleTakenTarget` (correcto) y uno con `currentTarget` directo (duplicado, inalcanzable, eliminado)

### 🟠 BUGS ALTOS CORREGIDOS

**5. Variables GROQ apuntando a Gemini — `chatbot-local/.env`**
- `GROQ_API_KEY` tenía la API key de Gemini (valor incorrecto, aunque inactivo)
- `GROQ_MODEL` tenía `gemini-2.5-flash` en vez de `llama-3.3-70b-versatile`
- Fix: `GROQ_API_KEY` vaciado, `GROQ_MODEL` corregido a modelo Groq real

### 🔒 SEGURIDAD CORREGIDA

**6. `.gitignore` incompleto — archivos `.env` con secrets expuestos**
- Faltaban: `chatbot-local/.env`, `chatbot-local/.env.*`, `.env.production`, `.env.staging`, `admin-desktop/.env`
- Fix: añadidas todas las rutas de `.env` al `.gitignore` con comentario explícito

### 🛠️ DEUDA TÉCNICA RESUELTA

**7. CRLF en 13 archivos src — build inestable en CI/CD**
- Detectados con PowerShell: `AdminChatbotTab.jsx` + 12 archivos más
- Convertidos todos a UTF-8 LF puro (sin BOM) mediante script PowerShell
- Archivos afectados: `AdminChatbotTab.jsx`, `LoyaltyWidget.jsx`, `PostOrderScreen.jsx`,
  `AdminAffiliatesTab.jsx`, `AdminCombosTab.jsx`, `AdminDashboardTab.jsx`, `AdminFormContext.jsx`,
  `AdminReviewsTab.jsx`, `AdminStaffTab.jsx`, `AdminStockTab.jsx`, `AffiliatePortal.jsx`,
  `PedidosContent.jsx`, `adminOrderUtils.js`
- Resultado verificado: scan post-fix → `OK - Ningún archivo src con CRLF`

**8. `useNotifications.js` — comentario mejorado**
- Re-export a `.jsx` es intencional (compatibilidad con imports sin extensión)
- Comentario actualizado para que futuros Codex no lo eliminen por error

### Estado post-sesión

- Build: ✅ Listo para `npm run build`
- Chatbot local: ✅ Reiniciar con `iniciar.bat` para cargar fixes de `chatbot-logic.js` y `server.js`
- `.env`: ⚠️ Revisar que `chatbot-local/.env` NO esté en el historial git (`git rm --cached chatbot-local/.env` si ya fue commiteado)
- Siguiente prioridad: test de intents del chatbot tras fix de encoding

## Update 2026-04-11 · Arreglos de arquitectura multi-tenant — 6 fixes aplicados

- Area: staff presence, rate limiting, token onboarding, super admin dashboard
- Motivo: cerrar gaps de fiabilidad y seguridad identificados en auditoría de arquitectura multi-tenant

### Archivos modificados

- `src/lib/staffPresence.js`
  - NUEVO: `startStaffHeartbeat(staffId, storeId)` — envía `last_seen + is_online=true` cada 60s
  - NUEVO: `stopStaffHeartbeat(staffId)` — limpia el interval (llamado en beacon y en cleanup)
  - FIX: `setStaffOnlineState` ahora actualiza también `last_seen` en ambos estados
  - FIX: `sendStaffOfflineBeacon` llama `stopStaffHeartbeat` antes del beacon para evitar carreras

- `src/pages/Pedidos.jsx` y `src/pages/Repartidor.jsx`
  - Integrado `startStaffHeartbeat` / `stopStaffHeartbeat` en el useEffect de sesión

- `api/_lib/rateLimiter.js` (NUEVO)
  - Rate limiter en memoria: `checkRateLimit(req, { max, windowMs, key })`
  - No requiere Redis; suficiente para bloquear ráfagas en la misma instancia Vercel

- `api/oxidian/create-checkout-session.js`
  - Rate limiting: max 5 sesiones / IP / 5 min, responde 429 + Retry-After

- `api/oxidian/onboarding.js`
  - Rate limiting: max 10 intentos / IP / 10 min (previene fuerza bruta de tokens)

- `api/_lib/oxidianSaas.js`
  - `loadCheckoutRecordByToken`: token expira a las 48h desde `created_at`

- `src/pages/OxidianSuperAdminTab.jsx`
  - Dashboard con métricas reales: tiendas activas/draft, pagos, onboardings pendientes,
    GMV 30d, tabla de últimos 10 checkouts con estado de onboarding y email

- `supabase/migrations/20260411_staff_heartbeat_last_seen.sql` (NUEVO)
  - Columna `last_seen` en `staff_users`
  - Función `mark_stale_staff_offline()` para pg_cron cada 2 min

### Acción requerida

1. Ejecutar `20260411_staff_heartbeat_last_seen.sql` en Supabase SQL Editor
2. `npm run build`
3. Push a Vercel
4. (Opcional) Activar pg_cron para `mark_stale_staff_offline` cada 2 min

### Riesgos pendientes

- Rate limiter en memoria no persiste entre instancias Vercel; para escala usar @upstash/ratelimit
- La expiración 48h aplica solo a tokens nuevos; tokens sin `created_at` no expiran (seguro)
- Dashboard super admin consulta `oxidian_checkout_sessions` — verificar RLS de esa tabla

### Verificacion

- `npm run build` pendiente tras aplicar migración
