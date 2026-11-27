@echo off
rem Ten bat zostal uogolniony - wdrozenie workera obsluguje teraz
rem wdroz-worker.bat (ta sama czynnosc, tylko nazwa bez "umywalka",
rem bo dotyczy kazdej zmiany po stronie serwera). Stary skrot dziala
rem dalej: przekazujemy sterowanie tam.
call "%~dp0wdroz-worker.bat"
