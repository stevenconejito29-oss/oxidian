# PROJECT_STATE

## Fecha

- 2026-04-17
- 2026-04-18

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
