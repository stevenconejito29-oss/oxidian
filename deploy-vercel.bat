@echo off
chcp 65001 >nul
title Oxidian — Deploy a Vercel

echo.
echo  ╔══════════════════════════════════════╗
echo  ║   OXIDIAN SAAS — Deploy a Vercel    ║
echo  ╚══════════════════════════════════════╝
echo.

cd /d C:\Users\steven\Downloads\carmocream\carmocream\frontend

echo [1/5] Verificando Node.js...
node --version >nul 2>&1
if errorlevel 1 (
    echo  ERROR: Node.js no encontrado. Instálalo desde nodejs.org
    pause & exit /b 1
)
for /f %%v in ('node --version') do echo  Node: %%v

echo.
echo [2/5] Instalando dependencias...
call npm install
if errorlevel 1 (
    echo  ERROR en npm install
    pause & exit /b 1
)

echo.
echo [3/5] Compilando para producción...
call npm run build
if errorlevel 1 (
    echo  ERROR: El build falló. Revisa los errores arriba.
    pause & exit /b 1
)
echo  Build completado en: dist\

echo.
echo [4/5] Verificando Vercel CLI...
vercel --version >nul 2>&1
if errorlevel 1 (
    echo  Instalando Vercel CLI...
    call npm install -g vercel
)
for /f %%v in ('vercel --version') do echo  Vercel CLI: %%v

echo.
echo [5/5] Deploy a Vercel...
echo.
echo  IMPORTANTE: La primera vez te pedirá login y nombre del proyecto.
echo  - Login: presiona Enter o usa tu cuenta existente
echo  - Proyecto: "oxidian" o el nombre que prefieras
echo  - Root directory: . (punto, directorio actual)
echo.
set /p CONFIRM="¿Hacer deploy a PRODUCCIÓN? (s/n): "
if /i "%CONFIRM%"=="s" (
    vercel --prod
) else (
    echo  Haciendo deploy de preview...
    vercel
)

echo.
echo  ✅ Deploy completado
echo.
echo  SIGUIENTE PASO: Actualiza en Supabase Dashboard:
echo  Authentication → URL Configuration
echo  Site URL: https://TU-PROYECTO.vercel.app
echo.
pause
