@echo off
chcp 65001 >nul
title Kamieniarstwo 24h - wdrozenie workera
cd /d "%~dp0"

rem ---------------------------------------------------------------------
rem  WDROZENIE WORKERA (czesc serwerowa)
rem
rem  Worker obsluguje zgloszenia z kalkulatora, maile, SMS-y i asystenta.
rem  Strona na kam24h.pl wdraza sie sama po wypchnieciu zmian, ale worker
rem  NIE - jego trzeba wdrozyc osobno, ta komenda.
rem
rem  Kiedy to klikac: po kazdej zmianie, ktora dotyka serwera - nowy
rem  dostawca w cenniku (asystent musi go znac), zmiana tresci maili,
rem  SMS-ow albo wytycznych asystenta.
rem
rem  CLOUDFLARE_ACCOUNT_ID jest potrzebny, bo bez niego wrangler
rem  odbija sie bledem 7403 (konto nalezy do dwoch organizacji).
rem ---------------------------------------------------------------------

set "CLOUDFLARE_ACCOUNT_ID=8d0b9237e0be0f0375301a50ae5f1f3e"

echo.
echo   WDROZENIE WORKERA
echo   -----------------
echo.
echo   Potrwa to okolo minuty. Prosze nie zamykac okna.
echo.

if not exist node_modules (
  echo   Pierwsze uruchomienie - instaluje potrzebne pliki...
  call npm install
  echo.
)

echo   [1 z 2] Skladam workera z szablonu i cennikow...
call npm run worker
if errorlevel 1 goto blad

echo.
echo   [2 z 2] Wysylam na Cloudflare...
call npx wrangler deploy
if errorlevel 1 goto blad

echo.
echo   ======================================================
echo    GOTOWE. Worker wdrozony.
echo   ======================================================
echo.
pause
exit /b 0

:blad
echo.
echo   ======================================================
echo    COS POSZLO NIE TAK - worker NIE zostal wdrozony.
echo.
echo    Strona dziala dalej bez zmian, nic sie nie zepsulo.
echo    Prosze pokazac tresc tego okna sesji Claude Code.
echo.
echo    Najczestsza przyczyna: wygasle logowanie do Cloudflare.
echo    Wtedy pomaga komenda:  npx wrangler login
echo   ======================================================
echo.
pause
exit /b 1
