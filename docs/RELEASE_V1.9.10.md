# HNL Pile Standards AI v1.9.10 — Full Sync, Logic & UI Hardening

## Trọng tâm
- `package.json` là nguồn version duy nhất.
- Version Gate kiểm tra README, changelog, release hiện hành, BUILD_METADATA và build-info sinh từ source.
- Workflow Web/Windows dừng trước build nếu version lệch.
- Test version dùng động từ package, không khóa số bản cũ.

## AI / nút nhấn
- Đổi provider, Text model, Vision model, Embedding model và cấu hình đề xuất đều phải được người dùng xác nhận.
- Refresh model và Kiểm tra kết nối chỉ dùng dữ liệu nháp để thử, không lưu nháp/API key.
- Fallback chỉ đề nghị model đã xác minh và vẫn hỏi OK/Cancel.

## UI
- Desktop >= 881 px: 3 vùng Thư viện / PDF / Trợ lý tự co, không tự ẩn khi resize.
- <= 880 px: chuyển 3 tab, không mất chức năng.
- Cài đặt/model picker/panel recovery luôn có đường truy cập.

## Windows
- Setup: `HNL-Pile-Standards-AI-Setup-${version}-${arch}.${ext}`
- Portable: `HNL-Pile-Standards-AI-Portable-${version}-${arch}.${ext}`
- Workflow chỉ upload khi verify đủ hai EXE.
