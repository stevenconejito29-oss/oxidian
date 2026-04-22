@echo off
chcp 65001 >nul
setlocal
title Oxidian - Build + Deploy Vercel

set "REPO_ROOT=%~dp0"
if "%REPO_ROOT:~-1%"=="\" set "REPO_ROOT=%REPO_ROOT:~0,-1%"
set "FRONTEND_DIR=%REPO_ROOT%\frontend"

echo.
echo  ============================================
echo    OXIDIAN - Deploy completo a Vercel
echo  ============================================
echo.
echo  Repo root : %REPO_ROOT%
echo  Frontend  : %FRONTEND_DIR%
echo.

echo [1/5] Node.js...
node --version >nul 2>&1
if errorlevel 1 (
    echo  ERROR: Instala Node.js ^>= 18 desde nodejs.org
    pause & exit /b 1
)
for /f %%v in ('node --version') do echo  OK: %%v

echo.
echo [2/5] Instalando dependencias del frontend...
call npm --prefix "%FRONTEND_DIR%" install --legacy-peer-deps
if errorlevel 1 (
    echo  ERROR en npm install
    pause & exit /b 1
)

echo.
echo [3/5] Build de produccion...
call npm --prefix "%FRONTEND_DIR%" run build
if errorlevel 1 (
    echo  ERROR: build fallido. Lee los mensajes de arriba.
    pause & exit /b 1
)

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

echo.
echo [5/5] Deploy a Vercel desde la raiz del repo...
echo.
cd /d "%REPO_ROOT%"
call vercel --prod
if errorlevel 1 (
    echo  ERROR en el deploy. Intenta primero: vercel login
    pause & exit /b 1
)

echo.
echo  ============================================
echo   DEPLOY COMPLETADO
echo  ============================================
echo.
pause
