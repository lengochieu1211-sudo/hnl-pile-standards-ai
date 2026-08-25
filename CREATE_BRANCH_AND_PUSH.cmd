@echo off
setlocal
if "%~1"=="" (
  echo Usage: CREATE_BRANCH_AND_PUSH.cmd ^<duong-dan-repo-hnl^>
  exit /b 2
)
set "REPO=%~1"
cd /d "%REPO%" || exit /b 2
git checkout main || exit /b 2
git pull --ff-only origin main || exit /b 2
git checkout -b p1/pass8.3-runtime-cert-v21 || exit /b 2
echo.
echo Da tao branch. Hay copy NOI DUNG thu muc Overlay v22 vao repo, KHONG xoa package-lock.json.
echo Sau do chay:
echo   git add -A
echo   git commit -m "P1 Pass 8.3: runtime certification v21"
echo   git push -u origin p1/pass8.3-runtime-cert-v21
endlocal
