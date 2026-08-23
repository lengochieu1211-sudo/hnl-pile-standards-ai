# HNL Pile Standards AI v1.9.14 — PDF & Desktop AI Stability Audit

## Root cause PDF
Ảnh lỗi thực tế hiển thị `this[#e].getOrInsertComputed is not a function`. Đây là lỗi tương thích JavaScript của PDF.js build hiện đại với Electron/Chromium chưa có Map upsert API mới. Ứng dụng trước đó import `pdfjs-dist` build mặc định cho cả API và worker.

## Fix
- Chuyển API sang `pdfjs-dist/legacy/build/pdf.mjs`.
- Chuyển worker sang `pdfjs-dist/legacy/build/pdf.worker.mjs?url`.
- Pin `pdfjs-dist` đúng `5.4.149` để build không tự trôi phiên bản.
- Thêm shim `Map/WeakMap.prototype.getOrInsertComputed` trước entry module làm lớp bảo vệ bổ sung.
- Lỗi PDF giống nhau được chống lặp 12 giây; không còn toast che giao diện Cài đặt liên tục.

## Offline AI
- Desktop/Bridge tìm `ollama.exe` theo biến môi trường, thư mục cài Windows và PATH.
- Nếu Ollama chưa cài, model pull trả `OLLAMA_NOT_INSTALLED` thay vì giả trạng thái running rồi lỗi ENOENT.
- Model Manager trả `ollamaInstalled` để UI chặn tải model và hướng dẫn đúng.

## Regression gates
- Test bắt buộc legacy PDF API + worker.
- Test cấm quay lại import `from 'pdfjs-dist'`.
- Test xác minh PDF error de-duplication.
- Test xác minh Ollama preflight ở Bridge + Electron + UI.
