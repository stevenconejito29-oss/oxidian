# Reglas de Implementación

## Objetivo

Construir un sistema nuevo para tiendas clonadas, multi-tenant y multi-sede, tomando del proyecto anterior solo la lógica y los flujos útiles.

## Qué reutilizar

- lógica de pedidos
- lógica de cocina
- lógica de reparto
- lógica de staff
- lógica financiera
- fidelidad
- afiliados
- tematización
- conexión con Supabase
- runtime del chatbot portable

## Qué no reutilizar como solución final

- diseño visual antiguo
- pantallas antiguas completas
- estructura plana de `pages/components/lib`
- experiencia visual actual del menú y del admin

## Método de trabajo

Siempre antes de una implementación grande:

1. buscar referencias en internet
2. revisar documentación oficial
3. definir una versión adaptada a este proyecto
4. implementar con arquitectura nueva

## Estado actual

Actualmente existe una capa `legacy` para acelerar pruebas locales.

Esa capa es transitoria y solo sirve para:

- mantener compatibilidad temporal
- extraer lógica útil
- permitir refactor por módulos

No debe considerarse arquitectura final.
