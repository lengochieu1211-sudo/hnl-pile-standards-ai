# HNL Pile Standards AI v1.9.8 — Build & Model Audit

## GitHub Actions lỗi đã xác định
Run `32607420916`, job `97114586529` dừng ở bước **Build NSIS and Portable EXE**. Vite và test đều hoàn tất; electron-builder dừng vì `win.artifactName` chứa `${target}`, macro này không tồn tại trong ngữ cảnh đó.

### Sửa build
- Bỏ `win.artifactName` có `${target}`.
- `nsis.artifactName = HNL-Pile-Standards-AI-Setup-${version}-${arch}.${ext}`.
- `portable.artifactName = HNL-Pile-Standards-AI-Portable-${version}-${arch}.${ext}`.
- Workflow có bước Verify Windows EXEs; thiếu một file sẽ fail rõ ràng.

## Model AI
- Bộ chọn AI + model hiển thị ngay trong Trợ lý.
- Model được lấy động bằng API/Ollama khi bấm ↻.
- Refresh danh sách không tự thay model.
- Chuyển provider/model thủ công phải xác nhận.
- Fallback do quota/429/503: retry model hiện tại trước; sau đó hỏi người dùng OK/Cancel. Cancel giữ nguyên model.
- Không fallback chéo nhà cung cấp.
- Vision model không tự fallback.

## Kiểm thử
`npm test`: 48/48 PASS tại thời điểm đóng gói source.
