# Arbol Propuesto

```text
nuevoproyectooxidian/
├── README.md
├── docs/
│   └── architecture/
│       ├── project-tree.md
│       └── reuse-map.md
├── frontend/
│   └── src/
│       ├── core/
│       │   ├── app/
│       │   ├── providers/
│       │   ├── router/
│       │   ├── guards/
│       │   ├── config/
│       │   └── services/
│       ├── modules/
│       │   ├── admin/
│       │   │   ├── routes/
│       │   │   ├── pages/
│       │   │   ├── components/
│       │   │   └── services/
│       │   ├── tenant/
│       │   │   ├── routes/
│       │   │   ├── pages/
│       │   │   ├── components/
│       │   │   └── services/
│       │   ├── store/
│       │   │   ├── routes/
│       │   │   ├── pages/
│       │   │   ├── components/
│       │   │   └── services/
│       │   ├── branch/
│       │   │   ├── routes/
│       │   │   ├── pages/
│       │   │   ├── components/
│       │   │   └── services/
│       │   ├── public-menu/
│       │   │   ├── routes/
│       │   │   ├── pages/
│       │   │   ├── components/
│       │   │   ├── hooks/
│       │   │   └── services/
│       │   └── theming/
│       │       ├── engine/
│       │       ├── presets/
│       │       ├── resolvers/
│       │       └── tokens/
│       ├── shared/
│       │   ├── ui/
│       │   ├── layouts/
│       │   ├── forms/
│       │   ├── hooks/
│       │   ├── utils/
│       │   ├── constants/
│       │   ├── types/
│       │   └── supabase/
│       └── styles/
│           ├── globals.css
│           ├── tokens.css
│           └── themes.css
├── backend/
│   └── app/
│       ├── core/
│       │   ├── config.py
│       │   ├── auth.py
│       │   ├── extensions.py
│       │   ├── errors.py
│       │   └── rls_context.py
│       ├── middlewares/
│       │   └── tenant_scope.py
│       ├── modules/
│       │   ├── admin/
│       │   │   ├── routes.py
│       │   │   ├── services.py
│       │   │   └── schemas.py
│       │   ├── tenant/
│       │   │   ├── routes.py
│       │   │   ├── services.py
│       │   │   └── schemas.py
│       │   ├── store/
│       │   │   ├── routes.py
│       │   │   ├── services.py
│       │   │   └── schemas.py
│       │   ├── branch/
│       │   │   ├── routes.py
│       │   │   ├── services.py
│       │   │   └── schemas.py
│       │   └── public/
│       │       ├── routes.py
│       │       ├── services.py
│       │       └── schemas.py
│       ├── repositories/
│       ├── integrations/
│       ├── models/
│       └── tests/
├── supabase/
│   └── migrations/
│       └── 0001_hierarchy_foundation.sql
└── scripts/
```

# Criterio de Separacion

## `frontend/src/core`

Infraestructura transversal:

- bootstrap de React
- router principal
- providers globales
- cliente Supabase
- guards por rol y alcance

## `frontend/src/modules`

Dominios funcionales separados por contexto:

- `admin`: tu panel de Super Admin
- `tenant`: panel del duenio
- `store`: configuracion comercial de la marca
- `branch`: operacion de sede
- `public-menu`: experiencia del cliente final
- `theming`: motor de plantillas y tokens

## `frontend/src/shared`

Piezas reutilizables y agnosticas al modulo:

- UI base
- layouts
- hooks genericos
- helpers
- tipos

## `backend/app/core`

Infraestructura Flask:

- configuracion
- auth
- carga de contexto RLS
- manejo de errores

## `backend/app/middlewares`

Middleware centralizado para:

- resolver `tenant_id`, `store_id` y `branch_id`
- rechazar accesos cruzados
- pasar el scope a Supabase/Postgres

## `backend/app/modules`

Separacion exacta de rutas:

- `/admin`
- `/tenant`
- `/store`
- `/branch`
- `/public`

# Decisiones Tecnicas Iniciales

1. `stores.id` se mantiene como `text` en fase 1 para no romper el proyecto actual, que ya lo usa extensivamente.
2. `tenants.id` y `branches.id` se definen como `uuid`.
3. Las tablas operativas recibiran siempre `tenant_id`, `store_id` y `branch_id`.
4. En tablas de alcance tienda, `branch_id` puede quedar `null`.
5. La tematizacion dinamica se resuelve con:
   - `store_templates`
   - `stores.template_id`
   - `stores.theme_tokens`
   - `branches.theme_override`
