# Oxidian SaaS - Deploy en Vercel

Este repo ya esta preparado para desplegarse como un solo proyecto de Vercel desde la raiz:

- frontend Vite servido desde `frontend/dist`
- backend serverless Python servido desde `api/index.py`
- rutas API same-domain bajo `/api/backend/*`

No configures `Root Directory = frontend`. El deploy correcto usa la raiz del repo y el `vercel.json` actual.

## Opcion A - Deploy desde GitHub

1. Sube este repo completo a GitHub.
2. En Vercel crea `New Project`.
3. Importa el repo.
4. En la configuracion del proyecto deja:
   - Root Directory: vacio / repo root
   - Framework Preset: Other
   - Build Command: se toma de `vercel.json`
   - Output Directory: se toma de `vercel.json`
5. Carga las variables de entorno indicadas abajo.
6. Ejecuta el primer deploy.
7. Cuando Vercel te de la URL final de produccion, copia esa URL en `FRONTEND_URL` y redepliega una vez mas.

## Opcion B - Deploy con Vercel CLI

```powershell
cd <repo-root>
npm install -g vercel
vercel login
vercel
vercel --prod
```

Igual que en GitHub, el deploy debe hacerse desde la raiz del repo.

## Variables de entorno obligatorias

Configuralas en `Vercel Dashboard -> Settings -> Environment Variables`.

```env
SUPABASE_URL=https://ljnfjlwlvabpsrwahzjk.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<service_role_key>
SUPABASE_JWT_SECRET=<jwt_secret>

VITE_SUPABASE_URL=https://ljnfjlwlvabpsrwahzjk.supabase.co
VITE_SUPABASE_ANON_KEY=<anon_key>

VITE_BACKEND_URL=
FRONTEND_URL=https://tu-app.vercel.app

SUPER_ADMIN_EMAIL=pepemellamoyoo@oxidian.app
```

Notas:

- `VITE_BACKEND_URL` debe quedar vacio si frontend y backend viven en el mismo proyecto Vercel.
- `FRONTEND_URL` debe ser la URL publica final del proyecto. Se usa para redirects de invitacion y CORS.
- Replica estas variables al menos en `Production`. Si quieres validar previews, replica tambien en `Preview`.

## Archivo de referencia

Puedes copiar los nombres base desde:

- `.env.vercel.example`

## Que hace el deploy actual

La configuracion vigente esta en `vercel.json`:

- instala dependencias del frontend con `cd frontend && npm install --legacy-peer-deps`
- compila el frontend con `cd frontend && npm run build`
- publica `frontend/dist`
- expone `api/index.py` como funcion Python
- enruta `/api/backend/*` al backend serverless

## Checklist rapido despues del deploy

1. Abre `https://tu-app.vercel.app/`
2. Verifica que carga el frontend sin pantalla en blanco.
3. Abre `https://tu-app.vercel.app/login`
4. Inicia sesion con el super admin.
5. En Pipeline, admite un lead.
6. Verifica que el dueño puede entrar con su cuenta.
7. Desde `/tenant/admin`, crea una tienda.

## Si algo falla

- Error de login o invitacion:
  - revisa `FRONTEND_URL`
  - revisa `SUPABASE_JWT_SECRET`
  - revisa `SUPABASE_SERVICE_ROLE_KEY`
- Error de llamadas API:
  - confirma que `VITE_BACKEND_URL` esta vacio
  - confirma que el proyecto se desplego desde la raiz y no desde `frontend`
- Error de CORS o redirects:
  - revisa `FRONTEND_URL`
  - revisa la configuracion de URLs en Supabase Auth

## URLs a configurar en Supabase

En `Supabase Dashboard -> Authentication -> URL Configuration`:

- Site URL: `https://tu-app.vercel.app`
- Redirect URLs:
  - `https://tu-app.vercel.app/**`
  - `http://localhost:5173/**` para desarrollo si lo necesitas
