@echo off
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Install Node.js from https://nodejs.org, then open this launcher again.
  pause
  exit /b 1
)
if not exist "node_modules\pdf-lib" (
  echo First run: open a terminal in this folder and run npm install.
  pause
  exit /b 1
)
echo Starting Folio. Open http://127.0.0.1:4173 in your browser.
echo Keep this window open while using the app. Press Ctrl+C to stop.
node server.mjs
pause
