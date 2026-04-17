# Oxidian SaaS — Deploy a Vercel
# ==============================================
# OPCIÓN A: Deploy con Vercel CLI (recomendado)
# ==============================================

# 1. Instalar Vercel CLI si no lo tienes
npm install -g vercel

# 2. Entrar a la carpeta del frontend
cd C:\Users\steven\Downloads\carmocream\carmocream\frontend

# 3. Login en Vercel
vercel login

# 4. Deploy (primera vez — te pregunta el nombre del proyecto)
vercel

# 5. Para producción:
vercel --prod

# ==============================================
# OPCIÓN B: Deploy desde GitHub (más fácil)
# ==============================================
# 1. Sube el proyecto a GitHub (solo la carpeta frontend)
# 2. Ve a vercel.com → New Project
# 3. Importa el repo
# 4. Configura:
#    - Framework Preset: Vite
#    - Root Directory: frontend
#    - Build Command: npm run build
#    - Output Directory: dist
# 5. Añade las variables de entorno (ver abajo)
# 6. Deploy

# ==============================================
# VARIABLES DE ENTORNO EN VERCEL DASHBOARD
# Settings → Environment Variables → añadir:
# ==============================================
# VITE_SUPABASE_URL          = https://ljnfjlwlvabpsrwahzjk.supabase.co
# VITE_SUPABASE_ANON_KEY     = eyJhbGciOi...
# VITE_ALLOW_WEB_ADMIN       = true
# VITE_WHATSAPP_NUMBER       = 633096707
# VITE_PUBLIC_WEB_URL        = https://TU-PROYECTO.vercel.app
# VITE_OXIDIAN_TEMPLATE_STORE_ID = default
# APP_SESSION_TTL_HOURS      = 8

# ==============================================
# DESPUÉS DEL DEPLOY — Actualizar CORS en Supabase
# ==============================================
# Supabase Dashboard → Authentication → URL Configuration
# Site URL: https://TU-PROYECTO.vercel.app
# Redirect URLs: https://TU-PROYECTO.vercel.app/**

# También actualizar en backend .env:
# FRONTEND_ORIGIN=https://TU-PROYECTO.vercel.app
