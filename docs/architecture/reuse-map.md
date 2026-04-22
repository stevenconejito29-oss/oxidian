# Reutilizacion del Proyecto Actual

Proyecto origen:

- repo actual de Oxidian

## Frontend a reutilizar

Mover o refactorizar estas piezas al nuevo arbol:

- `src/pages/Menu.jsx` -> `frontend/src/modules/public-menu/pages/MenuPage.jsx`
- `src/components/menu/*` -> `frontend/src/modules/public-menu/components/`
- `src/components/Cart.jsx` -> `frontend/src/modules/public-menu/components/`
- `src/components/ProductModal.jsx` -> `frontend/src/modules/public-menu/components/`
- `src/components/ComboModal.jsx` -> `frontend/src/modules/public-menu/components/`
- `src/components/PostOrderScreen.jsx` -> `frontend/src/modules/public-menu/components/`
- `src/lib/useMenuData.js` -> `frontend/src/modules/public-menu/hooks/`
- `src/lib/storeSettings.js` -> dividir entre `shared/supabase/` y `modules/theming/resolvers/`
- `src/lib/storeExperience.js` -> `frontend/src/modules/theming/presets/`
- `src/lib/productSections.js` -> `frontend/src/modules/public-menu/services/`

## SQL y Supabase a reutilizar

Tomar como referencia, no copiar literal:

- `supabase/migrations/20260404_super_admin_multistore_foundation.sql`
- `supabase/migrations/20260404_storefront_theme_and_config.sql`
- `supabase/migrations/20260413_rls_tenant_isolation.sql`

## Que no conviene arrastrar tal cual

- `src/pages/*` como carpeta plana
- `src/lib/*` mezclando auth, negocio, hooks y acceso a datos
- `api/*` actual basado en Node/Vercel si el nuevo backend sera Flask

## Resultado Esperado

La UI publica y la logica de tematizacion pueden reaprovecharse casi completas, pero envueltas en una arquitectura modular donde el scope ya no sea solo `store_id`, sino `tenant_id -> store_id -> branch_id`.
