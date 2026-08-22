@echo off
setlocal
title HNL Offline AI v1.7 - Install Models
where ollama >nul 2>&1 || (
  echo Chua cai Ollama. Hay cai Ollama truoc.
  pause
  exit /b 1
)
echo =====================================================
echo HNL LOCAL INTELLIGENCE ENGINE v1.7 - MODEL MIEN PHI
echo =====================================================
echo 1. May nhe: qwen3:4b + gemma3:4b + nomic-embed-text
echo 2. Can bang (khuyen nghi): qwen3:8b + gemma3:4b + bge-m3
echo 3. May manh: qwen3:14b + gemma3:4b + bge-m3
echo.
set /p CHOICE=Chon 1, 2 hoac 3 [mac dinh 2]: 
if "%CHOICE%"=="1" (
  ollama pull qwen3:4b
  ollama pull gemma3:4b
  ollama pull nomic-embed-text
) else if "%CHOICE%"=="3" (
  ollama pull qwen3:14b
  ollama pull gemma3:4b
  ollama pull bge-m3
) else (
  ollama pull qwen3:8b
  ollama pull gemma3:4b
  ollama pull bge-m3
)
echo.
echo Da cai xong model HNL v1.7.
echo Trong app, chon HNL Offline AI - Ollama va HNL Bridge.
echo Che do tim kiem: Auto hoac Hybrid Semantic.
pause
