# HNL Pile Standards AI v1.9.9 — Full Logic, UI & Version Hardening

## Mục tiêu
Khóa chặt logic đổi model, loại bỏ side-effect khi refresh/test, chuẩn hóa responsive và ngăn lệch version giữa Web/Desktop/GitHub artifacts.

## Version
- `package.json` là nguồn version duy nhất.
- `scripts/check-version-sync.mjs` bắt buộc README, `public/changelog.json` và release hiện hành phải khớp.
- GitHub Web/Windows chạy Version Gate trước test/build.
- `dist/build-info.json` tiếp tục lấy version từ `package.json` và thời gian của chính build thành công.

## AI model
- Text/Vision/Embedding model: mọi thay đổi đều cần OK.
- Refresh model/Test connection không lưu model, URL hay API key.
- API key chỉ commit vào `sessionStorage` khi Lưu.
- Fallback chỉ dùng danh sách model đã xác minh qua API/Ollama và vẫn hỏi OK.
- Catalog gợi ý chỉ để nhập/chọn thủ công, không được coi là model đang khả dụng.

## UI
- Desktop >= 881 px: 3 panel co theo viewport, không tự biến mất.
- <= 880 px: chuyển thành 3 tab Thư viện/PDF/Trợ lý.
- Nút phục hồi panel và Reset Layout vẫn hoạt động khi người dùng chủ động thu gọn.
