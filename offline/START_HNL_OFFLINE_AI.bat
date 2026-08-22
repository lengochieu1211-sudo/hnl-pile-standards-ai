@echo off
setlocal
cd /d "%~dp0\.."
title HNL Pile Standards AI - Offline Launcher

echo =====================================================
echo       HNL PILE STANDARDS AI - OFFLINE MODE
echo =====================================================
echo.

where node >nul 2>&1 || (
  echo [LOI] Chua co Node.js. Cai Node.js LTS truoc, sau do chay lai file nay.
  echo https://nodejs.org/
  pause
  exit /b 1
)
where npm >nul 2>&1 || (
  echo [LOI] Khong tim thay npm.
  pause
  exit /b 1
)
where ollama >nul 2>&1 || (
  echo [LOI] Chua co Ollama. Cai Ollama mien phi truoc, sau do chay lai.
  echo https://ollama.com/download
  pause
  exit /b 1
)

echo [1/4] Kiem tra Ollama...
curl -s http://127.0.0.1:11434/api/tags >nul 2>&1
if errorlevel 1 (
  echo Dang khoi dong Ollama...
  start "Ollama" /min ollama serve
  timeout /t 4 /nobreak >nul
)

echo [2/4] Kiem tra thu vien Node...
if not exist node_modules (
  echo Lan dau can Internet de npm install. Sau khi cai xong co the dung offline.
  call npm install --no-audit --no-fund
  if errorlevel 1 goto :fail
)

echo [3/4] Build giao dien Local...
call npm run build
if errorlevel 1 goto :fail

echo [4/4] Khoi dong HNL Local AI...
start "HNL Local AI" cmd /k "cd /d "%CD%" && node bridge/server.mjs"
timeout /t 3 /nobreak >nul
start "" "http://127.0.0.1:8787/?offline=1"

echo.
echo HNL Offline AI dang chay tai: http://127.0.0.1:8787
echo Neu model chua co, chay offline\INSTALL_OFFLINE_MODELS.bat
exit /b 0

:fail
echo.
echo [LOI] Khoi dong that bai. Xem dong loi phia tren.
pause
exit /b 1
