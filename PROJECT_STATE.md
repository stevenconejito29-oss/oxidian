# PROJECT_STATE

## Fecha

- 2026-04-17

## Estado actual

- Segunda auditoria completada sobre `git`, `vercel`, `frontend`, `backend` y `supabase`.
- El repo local esta enlazado a `origin = https://github.com/stevenconejito29-oss/oxidian.git`.
- `main` local y `origin/main` estan sincronizados en el commit `bdd501f`.
- El remoto `https://github.com/stevenconejito29-oss/oxidian2.git` no existe o no es accesible actualmente.
- El arbol SaaS local fue preparado para ser versionado completo en `oxidian`.
- El proyecto enlazado en Vercel desde `frontend/.vercel/project.json` fue realineado a `oxidian`.
- Se verifico un deploy productivo exitoso en Vercel sobre `oxidian`.

## Hallazgos de arquitectura y despliegue

- El frontend Vite si compila y despliega en Vercel.
- El despliegue verificado ya corresponde al proyecto Vercel `oxidian`, alineado con el repo Git actual `oxidian`.
- El proyecto de Vercel actual esta configurado como frontend-only; hoy no hay evidencia de que el backend Flask se despliegue en ese mismo proyecto.
- En la raiz existe `api/` con funciones Node para Vercel, pero el flujo operativo actual de deploy se esta ejecutando desde `frontend`, por lo que esa capa no forma parte del deploy verificado.
- Existen dos configuraciones de Vercel:
  - `frontend/vercel.json`: coherente con un deploy Vite estatico.
  - `vercel.json` en raiz: preparado para importar el repo completo y compilar `frontend/dist`.
- El proyecto Vercel no esta conectado a un repositorio Git, por eso hoy el deploy automatico por push no esta garantizado.
- El deploy hook compartido por el usuario pertenece al proyecto `oxidian`; el enlace local fue ajustado para apuntar a ese mismo proyecto.

## Hallazgos de seguridad

- `frontend/.env.production` estaba trackeado en git con secretos reales.
- `test_oxidian_db.py` tenia claves de Supabase embebidas en el codigo.
- Se cargaron variables criticas en el entorno `Production` del proyecto `oxidian2` en Vercel para reducir dependencia de secretos dentro del repo.
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

- Subir realmente este arbol SaaS al repo correcto o corregir `origin` hacia el repositorio deseado.
- Consolidar una estrategia unica de despliegue Vercel:
  - `frontend` estatico solamente
  - o raiz con `frontend + api`
- Conectar el proyecto Vercel `oxidian2` a GitHub si se quiere deploy automatico por push.
- Ejecutar y validar en Supabase el esquema canonico real (`RESET_COMPLETE.sql` y parches faltantes).
- Revisar grants/policies de `store_templates`, `tenants` y tablas jerarquicas.
- Rotar `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_JWT_SECRET` y cualquier secreto comprometido.
- Sacar definitivamente `frontend/.env.production` del control de versiones mediante commit.
