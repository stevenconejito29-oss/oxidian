@echo off
chcp 65001 >nul
title Oxidian — Build + Deploy Vercel

echo.
echo  ════════════════════════════════════════════
echo    OXIDIAN — Deploy completo a Vercel
echo  ════════════════════════════════════════════
echo.

cd /d "C:\Users\steven\Downloads\carmocream\carmocream\frontend"
echo  Carpeta: %CD%
echo.

:: ── 1. Node.js ────────────────────────────────────────────────
echo [1/5] Node.js...
node --version >nul 2>&1
if errorlevel 1 (
    echo  ERROR: Instala Node.js ^>= 18 desde nodejs.org
    pause & exit /b 1
)
for /f %%v in ('node --version') do echo  OK: %%v

:: ── 2. npm install ────────────────────────────────────────────
echo.
echo [2/5] Instalando dependencias...
call npm install --legacy-peer-deps
if errorlevel 1 (
    echo  ERROR en npm install
    pause & exit /b 1
)
echo  OK: node_modules listo

:: ── 3. npm run build ──────────────────────────────────────────
echo.
echo [3/5] Build de produccion...
call npm run build
if errorlevel 1 (
    echo.
    echo  ERROR: Build fallido. Lee los mensajes de arriba.
    echo  Pega el error en el chat para que lo corrija.
    pause & exit /b 1
)
echo  OK: dist/ generado

:: ── 4. Vercel CLI ─────────────────────────────────────────────
echo.
echo [4/5] Verificando Vercel CLI...
vercel --version >nul 2>&1
if errorlevel 1 (
    echo  Instalando Vercel CLI globalmente...
    call npm install -g vercel
    if errorlevel 1 (
        echo  ERROR instalando vercel CLI
        pause & exit /b 1
    )
)
for /f %%v in ('vercel --version') do echo  OK: Vercel %%v

:: ── 5. Deploy ─────────────────────────────────────────────────
echo.
echo [5/5] Deploy a Vercel...
echo.
echo  INSTRUCCIONES cuando pregunte:
echo  - Log in to Vercel: elige "Continue with GitHub" o email
echo  - Set up and deploy: Y
echo  - Which scope: elige tu cuenta
echo  - Link to existing project: N ^(primera vez^)
echo  - Project name: oxidian ^(o el que prefieras^)
echo  - In which directory: . ^(ENTER, ya estamos en frontend/^)
echo  - Override settings: N
echo.
call vercel --prod
if errorlevel 1 (
    echo  ERROR en el deploy. Intenta: vercel login   luego: vercel --prod
    pause & exit /b 1
)

echo.
echo  ════════════════════════════════════════════
echo   DEPLOY COMPLETADO
echo  ════════════════════════════════════════════
echo.
echo  PASOS POST-DEPLOY ^(en el navegador^):
echo.
echo  1. Copia tu URL de Vercel ^(ej: oxidian-xxx.vercel.app^)
echo.
echo  2. Supabase ^> Authentication ^> URL Configuration:
echo     https://supabase.com/dashboard/project/ljnfjlwlvabpsrwahzjk/auth/url-configuration
echo     Site URL: https://TU-URL.vercel.app
echo     Redirect URLs: https://TU-URL.vercel.app/**
echo.
echo  3. Vercel ^> Settings ^> Environment Variables:
echo     Añadir VITE_PUBLIC_WEB_URL = https://TU-URL.vercel.app
echo     Redeploy
echo.
echo  4. Crear Super Admin en SQL Editor de Supabase:
echo     SELECT public.make_super_admin^('TU_EMAIL@aqui.com'^);
echo.
pause
