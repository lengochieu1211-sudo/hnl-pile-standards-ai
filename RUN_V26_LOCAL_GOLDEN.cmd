@echo off
setlocal
cd /d "%~dp0"
echo ==========================================
echo HNL V26 - LOCAL GOLDEN / REGRESSION
 echo ==========================================
node tools\v26-spt-golden.mjs
if errorlevel 1 exit /b 1
node --test tests\*.test.mjs
if errorlevel 1 exit /b 1
node scripts\full-table-golden.mjs artifacts\full-table-golden-v1.25.7.json
if errorlevel 1 exit /b 1
node scripts\spt-pdf-decision-golden.mjs artifacts\spt-pdf-decision\spt-pdf-decision-v1.25.7.json
if errorlevel 1 exit /b 1
node scripts\check-search-brain.mjs
if errorlevel 1 exit /b 1
echo.
echo V26 LOCAL CORE GATES PASS.
echo ExcelJS/Vite/Windows runtime remain GitHub Actions certification gates.
endlocal
