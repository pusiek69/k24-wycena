@echo off
chcp 65001 >nul
title Kamieniarstwo 24h - dodaj cennik
cd /d "%~dp0"

echo.
echo   DODAWANIE CENNIKA
echo   -----------------
echo   Za chwile otworzy sie strona w przegladarce.
echo   Zeby zamknac narzedzie - zamknij to okno.
echo.

if not exist node_modules ( call npm install )
call npm run cennik:dodaj
