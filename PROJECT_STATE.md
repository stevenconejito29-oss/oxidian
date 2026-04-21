# PROJECT_STATE

## Fecha

- 2026-04-21
- 2026-04-20
- 2026-04-19
- 2026-04-17
- 2026-04-18

## Iteracion 2026-04-21 - pipeline de admision y acceso inicial del dueno

### Implementado

- `frontend/src/modules/admin/components/SuperAdminPipelineTab.jsx`
  - El flujo de admision deja de intentar crear la primera tienda del dueno desde Super Admin.
  - Ahora la activacion real crea el tenant y admite al dueno con invitacion de acceso.
  - El lead pasa a `onboarding` cuando ya existe acceso real al panel del dueno.
  - Se eliminaron acciones secundarias que invitaban sin crear tenant ni membresia.
- `frontend/src/core/router/AppRouter.jsx`
  - Se elimina el bloqueo que forzaba a `tenant_owner` y `tenant_admin` a onboarding antes de entrar al panel.
  - El dueno ya puede entrar a `/tenant/admin` aunque todavia no tenga tiendas.
- `frontend/src/modules/tenant/pages/TenantAdminPage.jsx`
  - Se elimina la redireccion automatica a `/onboarding` cuando el tenant no tiene tiendas.
  - El dueno usa el empty state del panel para crear su primera tienda desde su propia cuenta.
- `frontend/src/shared/lib/backendBase.js`
  - Nueva resolucion canonica del backend:
    - desarrollo local -> rutas proxied sin prefijo
    - produccion same-domain -> `/api/backend`
- `frontend/src/shared/lib/supabaseApi.js` y `frontend/src/modules/admin/pages/OnboardingPage.jsx`
  - Ambos usan la resolucion canonica del backend para no romper entre local y Vercel.
- `frontend/src/modules/admin/lib/pipelineAdmission.js`
  - Centraliza la ruta real de login del dueno (`/login`) y el estado posterior a la admision.
- `api/index.py`
  - Se agregan endpoints serverless que el frontend ya esperaba para Vercel:
    - `GET/POST/PATCH /api/backend/admin/tenants`
    - `POST /api/backend/admin/tenants/<tenant_id>/invite-owner`
    - `POST /api/backend/tenant/stores`
    - `PATCH /api/backend/tenant/stores/<store_id>`
    - `POST /api/backend/tenant/branches`
  - Se corrige el redirect por defecto de invitaciones hacia `/login`.
- `backend/app/modules/admin/routes.py`
  - Se alinea el redirect por defecto de invitacion con `/login` para el backend Flask local.

### Decision de arquitectura

- El pipeline comercial no debe "simular conversion" creando estados sin acceso funcional.
- La admision valida del lead es:
  - tenant creado
  - dueno con membresia activa o invitacion valida
  - entrada posible al panel del dueno
- La creacion de tiendas pertenece al panel del dueno, no al Super Admin.

### Validacion

- `node --test frontend/tests/backendBase.test.mjs`
- `node --test frontend/tests/pipelineAdmission.test.mjs`
- `python -m py_compile api/index.py backend/app/modules/admin/routes.py`
- `npm run build` en `frontend`

### Nota de schema

- No hubo cambios de DDL ni de RLS en esta iteracion.
- `database_schema.sql` no requirio actualizacion.

## Iteracion 2026-04-20 - Schema/RLS minimo alineado con el frontend

### Implementado

- `RESET_COMPLETE.sql` ahora refleja `tenant_subscriptions.feature_overrides` y `notes`, que el frontend usa para el cambio de plan y feature gating.
- La RPC `public.change_tenant_plan` en `0008_plans_and_feature_overrides.sql` queda fijada con `SET search_path = public` para evitar dependencias ambiguas.
- `database_schema.sql` documenta el contrato real vigente: `stores.id` es `text` tipo slug y `tenant_subscriptions` soporta overrides por tenant.

### Validacion

- Se reviso la coherencia con el frontend que consume `tenant_subscriptions.feature_overrides` desde `usePlan()` y `changeTenantPlan()`.
- Sin cambios funcionales en frontend requeridos para este ajuste de schema.

## Iteracion 2026-04-20 - diseno de Fase 1 para paneles administrativos

### Decision de arquitectura

- La mejora de backoffice se ejecutara en dos fases.
- La Fase 1 prioriza `super_admin` y `tenant_owner` / `tenant_admin`.
- `store_admin` y `branch_manager` quedan fuera del rediseño profundo inicial; solo recibiran ajustes de compatibilidad para no romper el flujo.
- La razon es reducir errores de permisos, ownership, onboarding y navegacion antes de tocar la capa operativa de sede.

### Documento de diseno

- Se agrego la especificacion de trabajo en:
  - `docs/superpowers/specs/2026-04-20-admin-phase-1-design.md`

### Alcance validado para Fase 1

- `SuperAdminPage` pasa a ser el control plane de plataforma con seis vistas:
  - `overview`
  - `tenants`
  - `owners`
  - `plans`
  - `pipeline`
  - `stores`
- `TenantAdminPage` pasa a ser el control plane del negocio con cinco vistas:
  - `overview`
  - `stores`
  - `branches`
  - `staff`
  - `customize`

### Hallazgos tecnicos fijados en la spec

- `frontend/src/core/providers/AuthProvider.jsx` sigue apoyandose en cliente legacy y debe alinearse con el cliente canonico antes del rediseño amplio.
- `frontend/src/modules/admin/pages/SuperAdminPage.jsx` y `frontend/src/modules/tenant/pages/TenantAdminPage.jsx` duplican primitivas UI locales en vez de consolidarse sobre `DashboardLayout` y `OxidianDS`.
- La Fase 1 debe fortalecer primero el gobierno de plataforma y tenant para evitar reescrituras posteriores en roles inferiores.

### Pendiente inmediato

- Esperar revision del usuario sobre la spec escrita antes de pasar al plan detallado de implementacion y luego a cambios de codigo.

## Iteracion 2026-04-19 - correccion canonica del panel del dueno y acceso local al backend

### Implementado

- `frontend/src/modules/tenant/pages/TenantAdminPage.jsx`
  - Reescrito en limpio para eliminar codificacion rota y semantica mezclada.
  - El alta de tiendas ya no mezcla `business_type` con `template_id`.
  - Se limita a nichos canonicos del proyecto: `barbershop`, `fastfood`, `restaurant`, `minimarket`, `clothing`, `universal`.
  - La creacion de tienda guarda una plantilla base valida para `store_templates` y deja la eleccion del estilo visual real al panel de personalizacion.
  - La vista del dueno ahora explica claramente la diferencia entre `business_type`, plantilla base y estilo del menu.
- `frontend/src/modules/tenant/lib/storeCatalog.js`
  - Nueva capa canonica y testeable para mapear nichos, business types, plantilla base y estilo recomendado.
- `frontend/tests/storeCatalog.test.mjs`
  - Pruebas unitarias minimas para evitar volver a introducir `booking` como template inexistente o mezclar el dominio de tienda con el dominio visual.
- `frontend/vite.config.js`
  - Se agrego proxy local para `/admin`, `/tenant`, `/branch`, `/store` y `/public` apuntando a `VITE_LOCAL_BACKEND_URL` con fallback `http://127.0.0.1:5000`.
  - Esto permite probar el backoffice en desarrollo sin depender de `VITE_BACKEND_URL`.
- `frontend/.env` y `frontend/.env.example`
  - Se retiraron secretos de servidor del frontend.
  - El frontend conserva solo variables publicas `VITE_*`.
  - La configuracion privada queda documentada y aislada en `backend/.env`.

## Iteracion 2026-04-19 - endurecimiento del backend serverless y cierre de bugs criticos

### Implementado

- `api/index.py`
  - Se elimino el fallback inseguro que aceptaba JWT sin verificar firma.
  - Ahora el backend falla si `SUPABASE_JWT_SECRET` no existe, en lugar de abrir una via de bypass.
- `frontend/src/modules/admin/pages/SuperAdminPage.jsx`
  - El Pipeline ya no llama `adminApi` inexistente.
  - El envio de invitacion usa `inviteLandingRequest()` de `supabaseApi`.
- `frontend/src/modules/tenant/pages/TenantAdminPage.jsx`
  - Se reemplazo la version que seguia ofreciendo `booking` y mezclando `business_type` con `template_id`.
  - La creacion de tiendas vuelve a depender del catalogo canonico en `storeCatalog.js`.
  - La UI deja claro que `template_id` es la plantilla base persistida y que el estilo de menu real se ajusta en personalizacion.

### Validacion esperada

- El backend serverless ya no debe aceptar peticiones autenticadas si falta `SUPABASE_JWT_SECRET`.
- El flujo `Pipeline -> Aprobar y enviar invitacion` ya no debe romper por `ReferenceError`.
- La vista del dueno ya no debe insertar `booking` como `template_id` ni guardar `business_type = delivery/vitrina/...`.

## Iteracion 2026-04-19 - SQL unico para Supabase

### Nuevo archivo

- `scripts/supabase_single_setup.sql`

### Contenido

- Consolida en una sola corrida:
  - `supabase/migrations/RESET_COMPLETE.sql`
  - `supabase/migrations/0005_testing_readiness.sql`
  - `supabase/migrations/0006_fix_rls_auth_errors.sql`

### Limite conocido

- El repo actual no contiene `0007_modules_engine.sql`.
- Por eso el archivo unico incluye todo el SQL real y verificable del proyecto, pero no puede incorporar ese SQL externo sin inventarlo.

### Estado de pruebas

- El frontend queda listo para pruebas funcionales locales si el Flask corre en `127.0.0.1:5000`.
- En Vercel sigue siendo obligatorio configurar `VITE_BACKEND_URL` con la URL publica del backend; sin eso, el panel admin responde con error limpio pero no puede operar end-to-end.

## Estado actual

- Verificacion operativa completada sobre `git`, `vercel`, `frontend`, `backend` y `supabase`.
- El repo local esta enlazado a `origin = https://github.com/stevenconejito29-oss/oxidian.git`.
- `main` local y `origin/main` quedaron sincronizados en el commit `46509b1`.
- El proyecto Vercel activo es `oxidian` (`prj_Oq80no8rgJItzeJGUZtD63zhzqM6`).
- El proyecto `oxidian` ya esta conectado al repo GitHub `stevenconejito29-oss/oxidian`.
- El `Root Directory` remoto de Vercel fue corregido a `frontend`.
- Se verifico un deployment productivo `READY` via Git/deploy hook sobre el commit `46509b1`.
- Revision de memoria externa (`AGENTS.md`, `MEMORY_LOG.md`, parches y hooks en `C:\Users\steven\Downloads\codex`) contrastada contra el repo real.
- El login por `supabase.auth.signInWithPassword()` y magic link existe y el `AuthProvider` ya escucha sesion nativa de Supabase.
- El acceso a vistas protegidas sigue dependiendo de filas validas en `public.user_memberships`.
- Existe un bootstrap SQL local para asignar accesos en una sola corrida: `scripts/bootstrap_access_users.sql`.
- El bootstrap SQL de accesos ahora autodetecta `tenant`, `store` y `branch` si las referencias de ejemplo no existen.
- Se separo el cliente de auth (`supabaseAuth`) del cliente scoped por `appSession` para evitar el error de `onAuthStateChange` con `accessToken`.
- Existe documentacion operativa local para roles y visibilidad en `docs/architecture/ROLE_ACCESS_NOTE.md`.
- Existe un seed SQL local para perfilar todos los roles en `scripts/seed_role_profiles.sql`.
- Existe un SQL dedicado para acceso total de prueba de un solo usuario en `scripts/grant_full_access_pepemellamoyoo.sql`.
- Existe un helper local soportado por la Admin API de Supabase para crear usuarios de Auth: `scripts/create_auth_user.py`.

## Hallazgos de arquitectura y despliegue

- El frontend Vite si compila y despliega en Vercel.
- El despliegue verificado corresponde al proyecto Vercel `oxidian`, alineado con el repo Git actual `oxidian`.
- El proyecto de Vercel actual esta configurado como frontend-only; hoy no hay evidencia de que el backend Flask se despliegue en ese mismo proyecto.
- En la raiz existe `api/` con funciones Node para Vercel, pero el flujo operativo actual de deploy se esta ejecutando desde `frontend`, por lo que esa capa no forma parte del deploy verificado.
- Existen dos configuraciones de Vercel:
  - `frontend/vercel.json`: coherente con un deploy Vite estatico.
  - `vercel.json` en raiz: preparado para importar el repo completo y compilar `frontend/dist`.
- El error `FLASK_ENTRYPOINT_NOT_FOUND` ocurria porque el proyecto Git de Vercel estaba construyendo desde `.` y detectaba `backend/` como servicio Flask.
- La correccion efectiva fue cambiar `Root Directory` a `frontend`, siguiendo la documentacion oficial de Vercel para monorepos.
- El deploy hook compartido por el usuario pertenece al proyecto `oxidian`; se uso para forzar un redeploy del mismo commit despues de corregir `Root Directory`.
- Se corrigio `vercel.json` de raiz eliminando un BOM UTF-8 que hacia que Vercel lo reportara como JSON invalido.
- La documentacion oficial de Vercel indica que para desplegar frontend + backend como un solo proyecto se necesita `experimentalServices` y framework `Services`; hoy el camino estable del proyecto sigue siendo desplegar `frontend` como raiz del proyecto Vercel.
- La memoria externa esta parcialmente desfasada respecto al repo:
  - `AuthProvider` fix ya esta aplicado.
  - `useStoreModules` y `useFeatureFlag` ya existen en `frontend/src/shared/hooks/`.
  - `ModuleGate.jsx` no existe todavia.
  - `BranchAdminPage.jsx` sigue con tabs fijos, sin filtrado por modulos.
  - `SuperAdminPage.jsx` sigue parcial; no tiene tabs `tenants`, `pipeline` ni `plans`.
  - En el repo no existen migraciones `0005`, `0006`, `0007`; la memoria las menciona como trabajo externo no integrado.

## Hallazgos de seguridad

- `frontend/.env.production` estaba trackeado en git con secretos reales.
- `test_oxidian_db.py` tenia claves de Supabase embebidas en el codigo.
- Se cargaron variables criticas en el proyecto `oxidian` de Vercel para reducir dependencia de secretos dentro del repo.
- Las variables siguen cargadas solo en `Production`; no existe configuracion equivalente visible para `Preview`.
- `frontend/.gitignore` fue endurecido para excluir `.env*`, `dist/`, `node_modules/` y logs al desplegar desde esa carpeta.
- Sigue siendo obligatorio rotar las claves de Supabase ya expuestas en historial de git y en deployments previos.

## Hallazgos de Supabase

- Frontend y backend apuntan al mismo proyecto Supabase.
- `auth/v1/settings` responde correctamente.
- Las consultas REST a tablas (`store_templates`, `tenants`) estan devolviendo `permission denied`.
- Esto indica que la conectividad base existe, pero la autorizacion SQL/RLS/grants del proyecto no esta alineada con el esquema esperado.
- `RESET_COMPLETE.sql` contiene politicas publicas para `store_templates` que no parecen estar activas en el proyecto remoto actualmente.

## Decisiones tomadas

- Mantener `PROJECT_STATE.md` como memoria de trabajo del proyecto.
- Crear `database_schema.sql` como indice canonico del esquema actual mientras las migraciones siguen siendo la fuente operativa.
- Endurecer `.gitignore` para archivos sensibles.
- Quitar secretos hardcodeados de scripts utilitarios.

## Pendientes inmediatos

- Consolidar una estrategia unica de despliegue Vercel:
  - mantener `frontend` como proyecto actual estable
  - o redisenar a `Services` si se quiere desplegar backend y frontend juntos desde raiz
- Confirmar en Supabase SQL Editor que existen usuarios en `auth.users` y membresias en `public.user_memberships` antes de probar login por rol.
- Crear usuarios reales por Auth y luego asignar roles con `make_super_admin()` o `invite_member()`.
- Ajustar y ejecutar `scripts/bootstrap_access_users.sql` con correos reales para poblar `user_memberships` sin UUIDs manuales.
- Ejecutar y validar en Supabase el esquema canonico real (`RESET_COMPLETE.sql` y parches faltantes).
- Revisar grants/policies de `store_templates`, `tenants` y tablas jerarquicas.
- Rotar `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_JWT_SECRET` y cualquier secreto comprometido.
- Sacar definitivamente `frontend/.env.production` del control de versiones mediante commit.
- Replicar variables criticas tambien en `Preview` si se quiere validar flujos no productivos en Vercel.

## Iteracion 2026-04-18 - gestion de cuentas y visibilidad por rol

### Implementado

- Backend:
  - Se creo `backend/app/core/accounts.py` para centralizar llamadas al Supabase Admin API con `httpx`.
  - `POST /admin/accounts/owners` ya crea o reactiva usuarios Auth y les asigna `tenant_owner` o `tenant_admin`.
  - `GET /admin/accounts/owners` lista cuentas de dueños/admins de tenant con tenant, email y estado.
  - `PATCH /admin/accounts/owners/<member_id>` permite pausar/reactivar acceso y resetear password.
  - `POST /tenant/accounts/staff` ya crea o reactiva cuentas de staff con scope `tenant`, `store` o `branch`.
  - `GET /tenant/accounts/staff` lista staff del tenant.
  - `PATCH /tenant/accounts/staff/<member_id>` permite pausar/reactivar acceso y resetear password.
  - Se reforzo `tenant/routes.py` para que solo `super_admin`, `tenant_owner` o `tenant_admin` puedan gestionar cuentas y membresias del tenant.

### Frontend

- `frontend/src/modules/admin/pages/SuperAdminPage.jsx`
  - Nuevo tab de dueños.
  - Formulario para crear cuentas de `tenant_owner` y `tenant_admin`.
  - Listado de cuentas con acciones de pausar/reactivar y reset de password.
- `frontend/src/modules/tenant/pages/TenantAdminPage.jsx`
  - Se eliminaron accesos directos a cocina, reparto y afiliados desde la vista del dueño.
  - Nuevo bloque de creacion de staff por rol y alcance.
  - Nuevo bloque de gestion de staff con acciones de estado y reset de password.
- `frontend/src/modules/admin/pages/LandingPage.jsx`
  - Se limpiaron links internos. El landing ahora expone `login` y `storefront`, no vistas operativas.
- `frontend/src/core/app/UserMenu.jsx`
  - Se removieron links globales a afiliados desde `tenant_owner`.
  - Se removieron links globales a cocina y reparto desde `branch_manager`.
- `frontend/src/modules/branch/pages/BranchAdminPage.jsx`
  - Se agrego un bloque de accesos operativos dentro del propio panel de sede.
  - Ya admite `?tab=affiliates` para abrir el tab interno de afiliados desde la misma vista administrativa.
- `frontend/src/shared/lib/backofficeApi.js`
  - Helper comun para consumir `/admin/*` y `/tenant/*` con el token actual.

### Validacion

- `python -m compileall backend/app` equivalente: correcto.
- `npm run build` en `frontend`: correcto.

### Riesgos y notas

- La creacion de usuarios depende de que `SUPABASE_SERVICE_ROLE_KEY` siga presente y valido en `backend/.env`.
- No se desplego este corte todavia.
- No se añadieron tablas nuevas; por eso `database_schema.sql` no requirio cambios estructurales en esta iteracion.

### Verificacion adicional antes de pruebas

- `supabase/migrations/0007_modules_engine.sql` no existe en este repo. Si ese motor de modulos vive fuera del workspace, hay que ejecutarlo manualmente en Supabase antes de esperar tabs dinamicos.
- La dependencia de `stores.slug` es real en el frontend:
  - `TenantAdminPage` arma links de staff con `/s/{storeSlug}/{branchSlug}/login`
  - `StaffLoginPage` resuelve la tienda con `eq('slug', storeSlug)`
  - si `stores.slug` esta `NULL`, esos links fallan aunque exista `store_id`
- El Pipeline actual si tiene un bug critico real:
  - `frontend/src/modules/admin/pages/SuperAdminPage.jsx`
  - `PipelineTab.sendInvite()` llama `sb.auth.admin.inviteUserByEmail(...)` desde el navegador
  - eso requiere service role y por tanto debe moverse al backend Flask
- Solucion temporal valida mientras no se cablee el backend del pipeline:
  - crear/invitar el usuario desde Supabase Dashboard → Authentication → Users
  - luego usar su email para el flujo de onboarding/membresias

## Iteracion 2026-04-18 - fix backend del Pipeline

### Implementado

- Se agrego `invite_auth_user_by_email()` en [backend/app/core/accounts.py](C:/Users/steven/Downloads/carmocream/carmocream/backend/app/core/accounts.py) usando el Admin API de Supabase del lado servidor.
- Se agrego `POST /admin/pipeline/<request_id>/invite` en [backend/app/modules/admin/routes.py](C:/Users/steven/Downloads/carmocream/carmocream/backend/app/modules/admin/routes.py).
- El boton "Aprobar y enviar invitacion" del `PipelineTab` ahora llama a Flask en lugar de intentar `sb.auth.admin` desde el navegador en [frontend/src/modules/admin/pages/SuperAdminPage.jsx](C:/Users/steven/Downloads/carmocream/carmocream/frontend/src/modules/admin/pages/SuperAdminPage.jsx).
- Se restauro el tab `owners` en la barra de tabs del Super Admin.
- Se corrigio un bloque JSX duplicado en [frontend/src/modules/branch/pages/BranchAdminPage.jsx](C:/Users/steven/Downloads/carmocream/carmocream/frontend/src/modules/branch/pages/BranchAdminPage.jsx) que estaba rompiendo el build.

### Validacion

- `python -m compileall backend/app`: correcto.
- `npm run build` en `frontend`: correcto.

### Cambios de base de datos necesarios para empezar a probar

- Obligatorio si quieres staff login por URL amigable:
  - `update stores set slug = id where slug is null;`
- Obligatorio si quieres tabs dinamicos por modulos:
  - ejecutar el SQL externo `0007_modules_engine.sql` en Supabase, porque no vive en este repo.
- Muy probable si quieres que `overview`, `pipeline` y `tenants` del Super Admin funcionen completos:
  - confirmar que existan las tablas `landing_requests`, `tenant_subscriptions` y `store_plans`
  - esas tablas hoy se usan en frontend y la migracion `0005_testing_readiness.sql` ya las define como esquema canonico
- Recomendado para pruebas de invitaciones por email:
  - configurar SMTP en Supabase Auth si vas a invitar correos fuera del equipo del proyecto

## Iteracion 2026-04-18 - archivo de base listo para pruebas

### Nuevos archivos

- [supabase/migrations/0005_testing_readiness.sql](C:/Users/steven/Downloads/carmocream/carmocream/supabase/migrations/0005_testing_readiness.sql)
- [scripts/prepare_database_for_testing.sql](C:/Users/steven/Downloads/carmocream/carmocream/scripts/prepare_database_for_testing.sql)

### Que resuelve

- Consolida `store_plans` y crea `tenant_subscriptions` y `landing_requests` si faltan.
- Inserta y normaliza los planes base `starter`, `growth` y `enterprise`.
- Corrige `landing_requests.source` y hace backfill de `stores.slug` y `branches.slug`.
- Crea `store_process_profiles` por defecto para tiendas que no lo tengan.
- Publica RPCs canonicas:
  - `get_store_modules(text)`
  - `get_store_features(text)`
  - `apply_niche_preset(text, uuid, text)`
- Añade grants y RLS minimos para que el frontend actual pueda empezar a operar.

### Nota

- Este SQL ya no es una capa de compatibilidad; ahora representa el esquema canonico faltante respecto a `RESET_COMPLETE.sql`.

## Iteracion 2026-04-18 - correccion canonica de esquema

### Decision

- Se descarta la estrategia de "compatibilidad para que funcione".
- El catalogo canonico de planes del proyecto queda unificado en `public.store_plans`.
- `public.saas_plans` deja de ser parte del esquema objetivo y se elimina en la migracion 0005.

### Correcciones aplicadas

- `frontend/src/modules/tenant/pages/TenantAdminPage.jsx` ahora lee la relacion correcta `tenant_subscriptions -> store_plans`.
- `frontend/src/modules/admin/pages/OnboardingPage.jsx` ahora:
  - obliga sesion valida
  - usa el email autenticado como `owner_email`
  - crea primero la membresia `tenant_owner`
  - luego hace `upsert` de `tenant_subscriptions`
- `supabase/migrations/0005_testing_readiness.sql` fue reescrito como migracion canonica:
  - consolida `store_plans`
  - crea `tenant_subscriptions` apuntando a `store_plans(id)`
  - crea `landing_requests` con columna `source`
  - hace backfill de `stores.slug` y `branches.slug`
  - crea `get_store_modules`, `get_store_features` y `apply_niche_preset` como parte del esquema real
  - agrega policies para:
    - crear `tenants` cuando `owner_email` coincide con el email autenticado
    - insertar `tenant_subscriptions` cuando ya existe membresia activa del tenant
  - elimina `saas_plans` al final para evitar doble modelo
- `scripts/prepare_database_for_testing.sql` ahora es espejo exacto de esa migracion canonica.
- `database_schema.sql` se alineo para reflejar `store_plans` como tabla de planes valida.

### Impacto

- Se corrige el error de concepto entre `store_plans` y `saas_plans`.
- Se corrige el error de columna `yearly_price` eliminando ese supuesto del esquema.
- Se corrige el contrato de `landing_requests` agregando `source`, que ya era usado por el landing.
- Los tabs dinamicos dejan de depender de una tabla inventada adicional; ahora la resolucion base sale de `store_process_profiles` y del nicho de la tienda.
- Se corrige el `insert into store_process_profiles` de la migracion 0005, que tenia 21 columnas y solo 20 expresiones.

## Iteracion 2026-04-19 - auth productiva, super admin y panel de dueno

### Decision de arquitectura

- El backend deja de confiar en headers `X-App-Role`, `X-Tenant-Id`, `X-Store-Id` y `X-Branch-Id` en produccion.
- El contexto de identidad de Flask ahora se resuelve desde `user_memberships` usando el `sub` del JWT de Supabase como fuente canonica.
- La raiz `/` ya no puede mostrar el landing a un usuario autenticado; ahora redirige al panel correcto segun rol.
- El storefront publico vuelve a usar el renderer legacy, porque es el que respeta el motor real de estilos y layouts del menu.

### Correcciones aplicadas

- `backend/app/core/auth.py`
  - agrega resolucion server-side de membresia activa por prioridad de rol
  - limita headers debug a `ALLOW_INSECURE_LOCAL_AUTH`
  - usa `user_memberships` para derivar `app_role`, `tenant_id`, `store_id` y `branch_id`
- `backend/app/modules/tenant/routes.py`
  - agrega `POST /tenant/stores` para crear tiendas desde el panel del dueno
  - mejora `POST /tenant/branches` para aceptar `store_id` explicito validado
  - amplía `PATCH /tenant/stores/<store_id>` con campos de negocio reales
  - mejora `GET /tenant/dashboard` para agregar pedidos del tenant aunque no haya `store_id` scopeado
- `frontend/src/core/router/AppRouter.jsx`
  - redirige `/` al home correcto por rol autenticado
  - publica `/storefront/menu` y `/s/:storeSlug/menu` con `legacy/pages/Menu.jsx`
- `frontend/src/modules/admin/pages/SuperAdminPage.jsx`
  - el tab por defecto pasa a `owners`
  - `PipelineTab` vuelve a invitar via Flask `POST /admin/pipeline/:id/invite`
- `frontend/src/modules/tenant/pages/TenantAdminPage.jsx`
  - se reescribe sobre `tenantApi`
  - el dueno ya puede crear tiendas, crear sedes, crear cuentas de staff, pausar/reactivar accesos y resetear password
  - integra `AdminStoreCustomizationPanel` para modulos, flujo operativo y storefront
- `frontend/src/legacy/lib/storeExperience.js`
  - agrega un quinto preset real de menu: `despensa` / `Barrio`
- `frontend/src/legacy/pages/Menu.jsx`
  - trata `despensa` como una familia visual operativa del layout de barrio/minimal

### Validacion

- `npm run build` en `frontend`: correcto
- `compileall backend/app` usando `backend/.venv/Scripts/python.exe`: correcto

### Estado funcional esperado

- `pepemellamoyoo@oxidian.app` ya no debe caer de nuevo al landing cuando la sesion resuelva `super_admin`; debe entrar a `/admin`
- el super admin puede abrir directamente la gestion de dueños y crear cuentas owner/admin de tenant
- el owner, al entrar con su propia cuenta, recibe un panel con:
  - creacion de tiendas
  - creacion de sedes
  - creacion de staff con roles scopeados
  - personalizacion modular y de menu por tienda
