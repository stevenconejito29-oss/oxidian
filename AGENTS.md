# Instrucciones del Proyecto

## Regla principal

Este proyecto debe ser nuevo en:

- estructura
- diseño visual
- experiencia de usuario
- organización de módulos

Del proyecto anterior solo se debe reutilizar:

- lógica de negocio
- funciones
- utilidades
- integración con Supabase
- flujos operativos
- piezas reutilizables no visuales

No se debe clonar la UI anterior como solución final.

## Regla de investigación

Antes de implementar cambios importantes:

1. investigar en internet cómo se resuelve el problema hoy
2. revisar documentación oficial y fuentes primarias cuando aplique
3. buscar inspiración de estructura y diseño para evitar una interfaz genérica
4. adaptar lo aprendido al proyecto, no copiarlo ciegamente

## Regla de frontend

El frontend nuevo debe:

- tener diseño nuevo
- evitar wrappers permanentes sobre pantallas legacy
- usar `core`, `modules` y `shared`
- migrar gradualmente la lógica útil del proyecto anterior
- crear módulos nuevos para:
  - super admin
  - tenant admin
  - store customization
  - branch operations
  - public storefront

## Regla de reutilización

Se permite reutilizar del proyecto origen:

- hooks de datos
- helpers de carrito
- helpers de pedidos
- helpers de fidelidad
- helpers de afiliados
- utilidades de tematización
- integración de chatbot portable

Se debe reemplazar progresivamente:

- páginas completas heredadas
- layouts heredados
- CSS heredado como diseño final

## Regla de implementación

Cada cambio nuevo debe seguir esta secuencia:

1. investigar
2. diseñar la estructura objetivo
3. reutilizar solo lógica útil
4. implementar UI nueva y modular
5. validar que encaje con la jerarquía `tenant -> store -> branch`
