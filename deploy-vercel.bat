@echo off
chcp 65001 >nul
setlocal
title Oxidian - Deploy a Vercel

set "REPO_ROOT=%~dp0"
if "%REPO_ROOT:~-1%"=="\" set "REPO_ROOT=%REPO_ROOT:~0,-1%"
set "FRONTEND_DIR=%REPO_ROOT%\frontend"

echo.
echo  ====================================
echo    OXIDIAN SAAS - Deploy a Vercel
echo  ====================================
echo.
echo  Repo root : %REPO_ROOT%
echo  Frontend  : %FRONTEND_DIR%
echo.

echo [1/5] Verificando Node.js...
node --version >nul 2>&1
if errorlevel 1 (
    echo  ERROR: Node.js no encontrado. Instalalo desde nodejs.org
    pause & exit /b 1
)
for /f %%v in ('node --version') do echo  Node: %%v

echo.
echo [2/5] Instalando dependencias del frontend...
call npm --prefix "%FRONTEND_DIR%" install --legacy-peer-deps
if errorlevel 1 (
    echo  ERROR en npm install
    pause & exit /b 1
)

echo.
echo [3/5] Compilando para produccion...
call npm --prefix "%FRONTEND_DIR%" run build
if errorlevel 1 (
    echo  ERROR: el build fallo. Revisa los errores arriba.
    pause & exit /b 1
)

echo.
echo [4/5] Verificando Vercel CLI...
vercel --version >nul 2>&1
if errorlevel 1 (
    echo  Instalando Vercel CLI...
    call npm install -g vercel
    if errorlevel 1 (
        echo  ERROR instalando Vercel CLI
        pause & exit /b 1
    )
)
for /f %%v in ('vercel --version') do echo  Vercel CLI: %%v

echo.
echo [5/5] Deploy desde la raiz del repo...
echo.
cd /d "%REPO_ROOT%"
set /p CONFIRM="Hacer deploy a PRODUCCION? (s/n): "
if /i "%CONFIRM%"=="s" (
    call vercel --prod
) else (
    call vercel
)
if errorlevel 1 (
    echo  ERROR en el deploy.
    pause & exit /b 1
)

echo.
echo  Deploy completado
echo.
pause
