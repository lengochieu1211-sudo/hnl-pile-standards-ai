@echo off
setlocal
set "HERE=%~dp0"
set "ROOT=%HERE%..\.."
set "OUT=%HERE%PASS5_REPLAY_VALIDATION"
if not exist "%OUT%" mkdir "%OUT%"

node "%ROOT%\tools\p1-pass5-live-golden.mjs" ^
 --mode replay ^
 --live "%ROOT%\artifacts\p1-pass5-live-api-replay-v14.json" ^
 --dce-fixture "%ROOT%\artifacts\p1-pass5-dce-table-bundle-fixture-v13.json" ^
 --out "%OUT%\replay-golden.json"
if errorlevel 1 exit /b %errorlevel%

pushd "%ROOT%"
node "%ROOT%\tools\p1-pass5-final-lock-gate.mjs" ^
 --mode replay ^
 --live-golden "%OUT%\replay-golden.json" ^
 --gate-status "%ROOT%\artifacts\gate-status-v1.25.7.json" ^
 --search-hash-override f9b65e5e6fb61dcca233a4fe43950e3174c73536f2fa83452da3041fbd0021d2 ^
 --out-dir "%OUT%"
set "ERR=%ERRORLEVEL%"
popd
echo Replay validation exit=%ERR%
exit /b %ERR%
