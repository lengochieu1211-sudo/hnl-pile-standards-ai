@echo off
setlocal
title HNL Offline AI - Install Models
where ollama >nul 2>&1 || (
  echo Chua cai Ollama: https://ollama.com/download
  pause
  exit /b 1
)
echo =====================================================
echo HNL OFFLINE AI - TAI MODEL MIEN PHI
ECHO =====================================================
echo 1. Nhe hon: qwen3:4b + gemma3:4b
ECHO 2. Thong minh hon: qwen3:8b + gemma3:4b
set /p CHOICE=Chon 1 hoac 2 [mac dinh 2]: 
if "%CHOICE%"=="1" (
  ollama pull qwen3:4b
) else (
  ollama pull qwen3:8b
)
ollama pull gemma3:4b
echo.
echo Da xong. Trong app:
echo - Model van ban: qwen3:8b hoac qwen3:4b
ECHO - Model doc anh: gemma3:4b
pause
