@echo off
setlocal
set "HERE=%~dp0"
set "CSC=%WINDIR%\Microsoft.NET\Framework64\v4.0.30319\csc.exe"
if not exist "%CSC%" set "CSC=%WINDIR%\Microsoft.NET\Framework\v4.0.30319\csc.exe"
if not exist "%CSC%" (
  echo ERROR: .NET Framework C# compiler not found.
  exit /b 2
)
"%CSC%" /nologo /target:exe /platform:anycpu /optimize+ /r:System.Web.Extensions.dll /out:"%HERE%HnlCsiLiveBridge.exe" "%HERE%HnlCsiLiveBridge.cs"
if errorlevel 1 exit /b %errorlevel%
echo Built: %HERE%HnlCsiLiveBridge.exe
