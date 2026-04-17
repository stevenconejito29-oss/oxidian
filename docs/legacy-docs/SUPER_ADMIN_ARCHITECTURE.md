# Super Admin Architecture

## Objetivo

Convertir el ecosistema actual de tienda unica en una plataforma que permita:

- Crear tiendas nuevas sin duplicar codigo.
- Supervisar cada sede desde un centro maestro.
- Adaptar modulos y flujo operativo segun plan y proceso real.
- Mantener una instancia portable por tienda para el admin desktop y el chatbot local.

## Principio de migracion

No se fuerza `store_id` sobre pedidos, productos y stock en esta fase.

Primero se crea una capa de orquestacion:

- `config_tienda` sigue controlando la sede actual.
- `stores` y sus perfiles permiten al super admin modelar nuevas sedes.
- La tienda actual se sincroniza como `default` para no romper produccion.

## Capas de datos

### 1. `config_tienda`

Representa la configuracion activa de la sede local.

Campos nuevos relevantes:

- `store_code`
- `business_type`
- `plan_slug`
- `order_flow_type`
- `catalog_mode`
- flags de proceso
- flags de modulos

Esta tabla sigue siendo la fuente local para:

- branding
- horario
- numero admin
- prompt del bot
- theme visual
- modulos visibles del admin de la sede

### 2. `store_plans`

Define el alcance comercial del producto:

- limites estimados
- capacidades premium
- supervision multi-tienda

El plan no decide por si solo el flujo.
El flujo lo define el perfil operativo de la tienda.

### 3. `stores`

Es la ficha maestra de una sede:

- nombre
- slug
- codigo
- estado
- plan
- responsable
- carpeta portable sugerida

### 4. `store_process_profiles`

Define como opera la tienda:

- `standard`
- `direct_dispatch`
- `pickup_only`
- `catalog_only`

Y activa o apaga modulos:

- chatbot
- stock
- fidelidad
- afiliados
- cocina/reparto
- finanzas

### 5. `store_runtime_profiles`

Define el runtime portable de la sede:

- puerto local del bot
- url del bot
- arranque automatico
- metadata del proveedor AI
- observaciones de despliegue

La API key completa debe seguir local a la carpeta portable.

## Flujo operativo recomendado

### Alta de tienda

1. El super admin crea la tienda en `stores`.
2. Asigna plan.
3. Define flujo operativo.
4. Activa solo los modulos necesarios.
5. Define runtime portable sugerido.
6. Entrega una carpeta portable por sede.
7. En la sede se completa la API key local y se vincula el QR.

### Supervisión

El super admin revisa:

- estado de la sede
- plan contratado
- flujo operativo elegido
- modulos habilitados
- metadata del runtime local

### Ejemplos de procesos

#### Tienda de comida con cocina y delivery

- `order_flow_type = standard`
- `requires_preparation = true`
- `requires_dispatch = true`

#### Tienda de retail que despacha sin cocina

- `order_flow_type = direct_dispatch`
- `requires_preparation = false`
- `requires_dispatch = true`

#### Tienda que solo permite recogida

- `order_flow_type = pickup_only`
- `enable_delivery = false`
- `enable_pickup = true`

#### Catalogo sin checkout operativo

- `order_flow_type = catalog_only`
- se ocultan cocina, reparto y modulos no necesarios

## Siguiente fase tecnica

Cuando esta base ya este estable, la migracion real multi-tenant debe introducir:

- `store_id` en productos
- `store_id` en combos
- `store_id` en toppings
- `store_id` en pedidos
- `store_id` en stock
- `store_id` en settings migrables
- RLS por tienda

Solo entonces el super admin podra operar varias sedes reales sobre una misma base de datos compartida.
