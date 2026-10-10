@echo off
rem Double-click: downloads the latest Goal Setting + French IPA files from GitHub into THIS folder.
rem Your own data (goals database) and public\app.html are never touched. Old files are saved in "update-backup".
setlocal
cd /d "%~dp0"
set "BASE=https://raw.githubusercontent.com/cpabhargavpatel-ux/Bhargav/claude/trusting-goldberg-zqrwem"
if not exist "update-backup" mkdir "update-backup"
if not exist "public" mkdir "public"

echo.
echo   Stopping the server (if it is running)...
if exist "Stop Goal Setting.vbs" wscript //nologo "Stop Goal Setting.vbs" >nul 2>nul

echo   Downloading the latest files...
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
 "$ErrorActionPreference='Stop'; $b='%BASE%'; $ok=$true;" ^
 "foreach($f in @('server.mjs','public/french-ipa.html','Goal Setting.vbs','Stop Goal Setting.vbs','French IPA.vbs')){" ^
 "  try{ $dest=$f -replace '/','\'; if(Test-Path $dest){ Copy-Item $dest ('update-backup\'+($dest -replace '\\','_')) -Force };" ^
 "       Invoke-WebRequest -UseBasicParsing -Uri ($b+'/'+($f -replace ' ','%%20')) -OutFile ($dest+'.new'); Move-Item ($dest+'.new') $dest -Force; Write-Host ('  updated  '+$f) }" ^
 "  catch{ $ok=$false; Write-Host ('  FAILED   '+$f+'  ('+$_.Exception.Message+')') } };" ^
 "if(-not $ok){ exit 1 }"
if errorlevel 1 (
  echo.
  echo   Some files could not be downloaded. Check your internet connection and try again.
  pause
  exit /b 1
)
echo.
echo   Done. Now double-click your "Goal Setting" shortcut, then press Ctrl+F5 in the browser.
pause
