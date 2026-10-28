@echo off
rem Uruchamia lokalny edytor osob i otwiera go w przegladarce (dwuklik w Eksploratorze).
chcp 65001 >nul
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Nie znaleziono Node.js. Zainstaluj go z https://nodejs.org i uruchom ponownie.
  pause
  exit /b 1
)
node tools\edytor\server.js --otworz
pause
