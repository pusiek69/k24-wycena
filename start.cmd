@echo off
chcp 65001 >nul
title Kamieniarstwo 24h - podglad kreatora wyceny
cd /d "%~dp0"

echo.
echo   KAMIENIARSTWO 24H - kreator wyceny blatu
echo   ----------------------------------------
echo.

if not exist node_modules (
  echo   Pierwsze uruchomienie - instaluje potrzebne pliki, chwile to potrwa...
  call npm install
  echo.
)

echo   Otwieram podglad w przegladarce: http://localhost:5173
echo   Zeby zamknac podglad - zamknij to okno.
echo.

start "" http://localhost:5173
call npm run dev
