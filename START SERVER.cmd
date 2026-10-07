@echo off
title Goal Setting to the Now - server
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo   Node.js is not installed on this PC.
  echo   Install it from https://nodejs.org  (LTS version^), then run this again.
  echo.
  pause
  exit /b 1
)

echo.
echo   Starting the Goal Setting server...
echo   Leave this window OPEN. Closing it stops the server for everyone.
echo.
node server.mjs
echo.
echo   The server has stopped.
pause
