# Oxidian Multi-Store Branch Platform Design

**Fecha:** 2026-04-22

## Objetivo

Definir el contrato funcional y técnico de Oxidian como SaaS multi-tenant B2B2C jerárquico, donde:

- un `tenant` representa la cuenta empresarial dueña
- un `tenant` puede tener múltiples `stores`
- cada `store` puede pertenecer a nichos distintos dentro del mismo tenant
- cada `store` tiene un catálogo base, un modo principal único y módulos compatibles con su nicho
- cada `branch` tiene página pública propia, personalización visual propia y contenido visible propio sobre el catálogo base
- el `super_admin` aprueba y gobierna
- el `tenant_owner` crea sus stores con wizard y administra su operación
- el `staff` entra a vistas operativas específicas por sede

## Alcance funcional

### Jerarquía

- `super_admin`
  - aprueba leads
  - activa tenants y dueños
  - gestiona planes, módulos globales y operaciones sensibles
- `tenant_owner` / `tenant_admin`
  - gestionan varias `stores` dentro del mismo tenant
  - pueden mezclar nichos distintos dentro de la misma cuenta empresarial
- `store`
  - define la unidad comercial base
  - contiene nicho, modo principal, módulos, branding base y catálogo base
- `branch`
  - define la sede operativa y pública real
  - tiene página pública propia
  - tiene staff, operación y personalización local propios

### Flujo principal

1. El dueño se registra como lead.
2. El `super_admin` aprueba o rechaza.
3. Si aprueba:
   - se activa el `tenant`
   - se habilita el acceso del `tenant_owner`
   - no se crea ninguna `store` automáticamente
4. El dueño entra aunque todavía no tenga stores.
5. El dueño crea su primera `store` mediante wizard.
6. El dueño crea su primera `branch`.
7. Cada `branch` publica su propia página.
8. El staff de cada sede accede a vistas específicas por rol.

## Modelo de negocio

### Tenant

El `tenant` es la cuenta empresarial propietaria. No define el nicho del negocio. Puede operar múltiples marcas o líneas de negocio distintas dentro de la misma cuenta.

### Store

La `store` es la unidad comercial base y sí define el tipo de negocio. Cada `store` tiene:

- `niche`
- `primary_mode`
- `enabled_modules`
- branding base
- catálogo base
- configuración comercial base

Cada `store` puede pertenecer a un nicho distinto dentro del mismo tenant.

### Branch

La `branch` es la sede operativa y pública. Cada `branch` tiene:

- URL pública propia
- estilo visual propio
- plantilla propia
- contenido visible propio sobre el catálogo base
- dirección, horarios, teléfono y disponibilidad
- personal operativo propio

## Modo principal y módulos

### Regla

Cada `store` tiene un solo `primary_mode`. No existen stores con múltiples modos principales simultáneos. La flexibilidad se obtiene mediante módulos extra compatibles con el nicho y el modo principal.

### Modos principales

- `catalogo`
- `pedido_delivery`
- `pedido_retail`
- `reservas_servicios`
- `mixto_servicio_catalogo`

### Módulos extra

- `checkout`
- `delivery`
- `pick_up`
- `reservas`
- `staff_kitchen`
- `staff_riders`
- `coupons`
- `reviews`
- `loyalty`
- `affiliates`
- `chatbot_basic`
- `chatbot_portable`
- `analytics`
- `stock`
- `custom_menu_style`
- `branch_public_overrides`

### Compatibilidad

Los módulos disponibles para una `store` dependen de:

- su `niche`
- su `primary_mode`
- su plan activo

## Wizard de creación de store

El wizard del dueño debe crear una `store` y su primera `branch`.

### Pasos

1. Elegir nicho
2. Elegir modo principal recomendado para ese nicho
3. Elegir módulos compatibles sugeridos
4. Definir branding base de la `store`
5. Crear la primera `branch`
6. Abrir la personalización pública de esa `branch`

### Comportamiento esperado

- el dueño puede entrar sin stores existentes
- el dashboard del tenant debe mostrar estado vacío con CTA claro
- el wizard debe ser la forma principal de bootstrap de una nueva marca

## Página pública por branch

### Regla

Cada `branch` tiene una página pública propia. El modelo es `branch-first`.

### Herencia

La `store` define:

- catálogo base
- identidad comercial base
- módulos disponibles
- configuración comercial base

La `branch` define:

- plantilla pública elegida
- tokens visuales propios
- bloques, banners y portada
- categorías visibles
- productos visibles
- orden local
- destacados y promos locales

### Tipo de personalización

La `branch` puede personalizar:

- capa visual
- contenido visible

No se duplica el catálogo completo. Se trabaja con overrides sobre la base de `store`.

## Modelo de datos

### Datos en store

- identidad comercial base
- `niche`
- `primary_mode`
- `enabled_modules`
- branding base
- catálogo base
- precios base
- variantes y modificadores
- plantilla por defecto

### Datos en branch

- slug público de sede
- configuración operativa local
- configuración pública local
- overrides visuales
- overrides de contenido visible
- staff y operación local

### Overrides necesarios

- `branch_public_settings`
- `branch_catalog_visibility`
- `branch_product_overrides`
- `branch_category_overrides`

### Regla de resolución

- si la `branch` no define override, hereda de `store`
- si la `branch` define override, solo pisa ese fragmento
- nunca se duplica el catálogo completo a nivel branch

## Paneles por rol

### Super Admin

- pipeline de leads
- aprobación/rechazo de dueños
- gestión de tenants
- gestión de owners
- gestión de planes
- operaciones sensibles

### Tenant Owner / Tenant Admin

- dashboard multi-store
- creación de stores con wizard
- catálogo base por store
- creación y gestión de branches
- gestión de módulos
- gestión de staff
- control de límites por plan

### Branch Admin / Branch Manager

- pedidos
- staff local
- promos locales
- configuración operativa
- personalización de página pública

### Staff

- `kitchen`
- `rider`
- `cashier`
- `branch_manager`
- `store_operator`

Cada rol debe entrar a una vista cerrada y específica por sede.

## Arquitectura técnica

### Frontend

Responsabilidades:

- paneles por rol
- wizard de creación de store
- personalización pública por branch
- storefront público por sede

### API Flask

Responsabilidades:

- operaciones sensibles con service role
- aprobación de dueños
- creación de cuentas staff
- login staff por PIN
- creación segura de pedidos públicos

### Supabase

Responsabilidades:

- schema canónico
- RLS
- RPC seguras
- tablas de overrides store-branch

## Decisiones técnicas obligatorias

### Staff auth

Se abandona la pseudo-sesión legacy sin JWT válido. El login staff por PIN debe resolverse en backend y entregar identidad útil para:

- guards
- scope por `tenant_id`, `store_id`, `branch_id`
- RLS
- vistas `branch/*`

### Checkout público

La creación de pedidos públicos no debe depender de insertar `orders` directamente con cliente anónimo. Debe pasar por endpoint o RPC segura y quedar asociada a la `branch` pública concreta.

### Feature gating

El sistema de planes existente debe aplicarse de forma real en:

- panel tenant
- panel branch
- wizard
- módulos y límites

### Contrato de schema

El repo debe tener una única fuente de verdad. Si el storefront necesita entidades o columnas adicionales, el SQL versionado debe reflejarlas explícitamente.

## RLS

### Público

- lectura solo de `branches` públicas activas
- lectura solo de catálogo visible de la sede
- creación pública controlada solo mediante endpoint o RPC segura

### Tenant

- acceso scoped a sus `stores` y `branches`

### Staff

- acceso solo al scope operativo de su sede

### Super Admin

- control total

## Rutas objetivo

- `/tenant/admin`
- `/branch/admin?store_id=...&branch_id=...`
- `/branch/kitchen?store_id=...&branch_id=...`
- `/branch/riders?store_id=...&branch_id=...`
- ruta pública de sede:
  - `/s/:storeSlug/:branchSlug`

## Prioridades de implementación

1. Corregir auth staff para panel nuevo
2. Corregir storefront y checkout público por branch
3. Alinear schema SQL con el contrato funcional
4. Aplicar feature gating real
5. Endurecer wizard de store y personalización por branch
6. Verificar flujos end-to-end

## Riesgos conocidos

- el frontend público actual asume tablas y columnas no versionadas en el schema canónico
- el login staff actual no genera una identidad compatible con el panel nuevo
- el checkout público actual no es seguro ni fiable por branch
- el sistema de planes existe, pero hoy no gobierna toda la UI

## Fuera de alcance inmediato

- rediseño visual completo de todas las plantillas
- automatizaciones avanzadas de marketing
- analítica avanzada multi-tenant
- sincronización externa con ERPs o POS de terceros
