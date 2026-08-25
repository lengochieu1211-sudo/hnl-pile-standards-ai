@echo off
setlocal
set "HERE=%~dp0"
if not exist "%HERE%HnlCsiLiveBridge.exe" call "%HERE%BUILD_CSI_BRIDGE.cmd" || exit /b 2
set "CSI_DLL=%~1"
if "%CSI_DLL%"=="" set "CSI_DLL=%HERE%CSiAPIv1.dll"
"%HERE%HnlCsiLiveBridge.exe" --csi-dll "%CSI_DLL%" --product auto %*
