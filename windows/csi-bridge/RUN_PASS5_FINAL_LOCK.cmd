@echo off
setlocal EnableExtensions
set "HERE=%~dp0"
set "ROOT=%HERE%..\.."

if "%~1"=="" goto :usage
if "%~2"=="" goto :usage
if "%~3"=="" goto :usage

set "CSI_DLL=%~1"
set "FULL_SOURCE_ROOT=%~2"
set "GATE_STATUS=%~3"
set "PRODUCT=%~4"
if "%PRODUCT%"=="" set "PRODUCT=auto"
set "COMBOS=%~5"

set "SEARCH_FILE=%FULL_SOURCE_ROOT%\src\search.js"
set "OUT=%HERE%PASS5_FINAL_GATE_OUTPUT"
set "RAW=%OUT%\live-csi-output.json"
set "GOLDEN=%OUT%\live-golden-result.json"

if not exist "%CSI_DLL%" (
  echo ERROR: CSiAPIv1.dll not found: %CSI_DLL%
  exit /b 2
)
if not exist "%SEARCH_FILE%" (
  echo ERROR: Search Brain file not found: %SEARCH_FILE%
  exit /b 2
)
if not exist "%GATE_STATUS%" (
  echo ERROR: Gate status JSON not found: %GATE_STATUS%
  exit /b 2
)
if not exist "%HERE%HnlCsiLiveBridge.exe" (
  call "%HERE%BUILD_CSI_BRIDGE.cmd"
  if errorlevel 1 exit /b %errorlevel%
)

if not exist "%OUT%" mkdir "%OUT%"

echo [1/3] Reading LIVE ETABS/SAP through CSi API...
if "%COMBOS%"=="" (
  "%HERE%HnlCsiLiveBridge.exe" --csi-dll "%CSI_DLL%" --product "%PRODUCT%" > "%RAW%"
) else (
  "%HERE%HnlCsiLiveBridge.exe" --csi-dll "%CSI_DLL%" --product "%PRODUCT%" --combos "%COMBOS%" > "%RAW%"
)
if errorlevel 1 (
  echo BLOCKED: CSi live bridge failed.
  exit /b 2
)

echo [2/3] Running Live API ^<^> DCE ^<^> Canonical Golden...
node "%ROOT%\tools\p1-pass5-live-golden.mjs" ^
  --mode live ^
  --live "%RAW%" ^
  --dce-fixture "%ROOT%\artifacts\p1-pass5-dce-table-bundle-fixture-v13.json" ^
  --out "%GOLDEN%"
if errorlevel 1 (
  echo BLOCKED: Live Golden failed.
  exit /b 2
)

echo [3/3] Running final Pass 5 LOCK gate...
pushd "%ROOT%"
node "%ROOT%\tools\p1-pass5-final-lock-gate.mjs" ^
  --mode live ^
  --live-golden "%GOLDEN%" ^
  --gate-status "%GATE_STATUS%" ^
  --search-file "%SEARCH_FILE%" ^
  --out-dir "%OUT%"
set "ERR=%ERRORLEVEL%"
popd

if not "%ERR%"=="0" (
  echo.
  echo PASS 5 = BLOCKED
  echo See: %OUT%\P1_PASS5_FINAL_GATE_AUDIT.json
  exit /b %ERR%
)

if not exist "%OUT%\P1_PASS5_LOCKED.json" (
  echo ERROR: gate returned success but LOCKED manifest was not created.
  exit /b 2
)

echo.
echo ============================================================
echo P1 PASS 5 = LOCKED
echo Manifest: %OUT%\P1_PASS5_LOCKED.json
echo Audit:    %OUT%\P1_PASS5_FINAL_GATE_AUDIT.json
echo ============================================================
exit /b 0

:usage
echo Usage:
echo   RUN_PASS5_FINAL_LOCK.cmd ^<CSiAPIv1.dll^> ^<FULL_SOURCE_ROOT^> ^<gate-status-v1.25.7.json^> [auto^|etabs^|sap2000] [combos]
echo.
echo Example:
echo   RUN_PASS5_FINAL_LOCK.cmd "C:\ETABS\CSiAPIv1.dll" "D:\HNL-Pile-Standards-AI" "D:\gate-status-v1.25.7.json" etabs "EULS"
exit /b 2
