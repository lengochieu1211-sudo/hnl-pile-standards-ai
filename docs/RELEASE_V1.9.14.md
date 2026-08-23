# HNL Pile Standards AI v1.9.14

## PDF compatibility
- Dùng `pdfjs-dist/legacy/build/pdf.mjs` và `legacy/build/pdf.worker.mjs` để tránh lỗi `Map.prototype.getOrInsertComputed` trên Electron/Chromium chưa hỗ trợ API mới.
- Thêm compatibility shim Map/WeakMap trước entry module.
- Toast lỗi PDF được chống lặp và phân loại lỗi tương thích.

## Desktop / Offline AI
- Ollama không còn được xem là đang tải model nếu executable không tồn tại; Bridge trả lỗi hướng dẫn rõ ràng.
- Giữ cơ chế mở UI trước, Bridge cổng dự phòng, model đồng bộ trên/dưới và responsive v1.9.13.

## Validation
- Version Gate phải PASS.
- Test bắt buộc xác minh PDF legacy API + legacy worker và không còn import build mặc định.
