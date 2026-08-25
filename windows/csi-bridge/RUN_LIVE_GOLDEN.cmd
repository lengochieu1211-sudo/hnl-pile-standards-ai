@echo off
setlocal
set "HERE=%~dp0"
set "ROOT=%HERE%..\.."
if not exist "%HERE%HnlCsiLiveBridge.exe" call "%HERE%BUILD_CSI_BRIDGE.cmd" || exit /b 2
if "%~1"=="" (
  echo Usage: RUN_LIVE_GOLDEN.cmd ^<path-to-CSiAPIv1.dll^> [etabs^|sap2000] [combos]
  exit /b 2
)
set "CSI_DLL=%~1"
set "PRODUCT=%~2"
if "%PRODUCT%"=="" set "PRODUCT=auto"
set "COMBOS=%~3"
set "RAW=%HERE%live-csi-output.json"
set "GOLDEN=%HERE%live-golden-result.json"
if "%COMBOS%"=="" (
  "%HERE%HnlCsiLiveBridge.exe" --csi-dll "%CSI_DLL%" --product "%PRODUCT%" > "%RAW%"
) else (
  "%HERE%HnlCsiLiveBridge.exe" --csi-dll "%CSI_DLL%" --product "%PRODUCT%" --combos "%COMBOS%" > "%RAW%"
)
if errorlevel 1 exit /b %errorlevel%
node "%ROOT%\tools\p1-pass5-live-golden.mjs" --live "%RAW%" --dce-fixture "%ROOT%\artifacts\p1-pass5-dce-table-bundle-fixture-v13.json" --out "%GOLDEN%"
if errorlevel 1 exit /b %errorlevel%
echo PASS: %GOLDEN%
