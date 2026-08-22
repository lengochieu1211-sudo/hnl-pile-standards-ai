# HNL Pile Standards AI v1.7.0 — Local Intelligence Engine

**Cập nhật:** 22/08/2026 22:55 GMT+7

## Mục tiêu

Bản 1.7 tập trung làm AI cục bộ thông minh hơn mà không chỉ tăng kích thước model. Luồng tra cứu mới là:

`Quét toàn bộ trang → Deep/keyword retrieval → local embedding → semantic rerank → cân bằng nhiều PDF → trang lân cận → LLM trả lời + citation`.

## Thay đổi chính

- Thêm **Hybrid Semantic RAG** qua Ollama embedding.
- Mặc định embedding: `bge-m3`; có thể đổi sang `nomic-embed-text`.
- Bổ sung 4 chế độ tìm kiếm: **Auto / Hybrid Semantic / Deep Lexical / Nhanh**.
- Semantic rerank chỉ chạy với HNL Offline AI qua Bridge; nếu embedding lỗi, app tự rơi về Deep/lexical RAG thay vì làm nút hỏi đáp chết.
- Bridge có cache embedding trong RAM để các câu hỏi lặp lại nhanh hơn.
- Chẩn đoán Local đọc RAM, thử NVIDIA GPU/VRAM, model Ollama đang cài và đề xuất model phù hợp.
- `INSTALL_OFFLINE_MODELS.bat` có 3 cấu hình máy: nhẹ / cân bằng / mạnh, kèm embedding model.
- Sửa lỗi khai báo trùng `fileToBase64` trong `ingest.js`.
- Giữ Deep Full-Library RAG, Formula Library, archive ZIP/RAR/7Z/TAR/GZ/BZ2/XZ, PWA và nhiều nhà cung cấp AI từ v1.6.

## Giới hạn chưa giả vờ đã giải quyết

- PDF scan không có lớp text vẫn cần OCR/Vision trước khi có thể full-text search 100% nội dung.
- Embedding v1.7 được cache trong RAM Bridge; chưa lưu vector bền vững vào SQLite.
- Công thức tự phát hiện từ PDF vẫn phải kiểm tra trang gốc trước khi cho tính tự động.
- DOCX/XLSX/PPTX chưa được parser trực tiếp trong bản này.

## Kiểm thử

- `npm test`: 26/26 PASS tại thời điểm đóng gói.
- `node --check`: main.js, ai.js, ingest.js, bridge/server.mjs PASS.
- `npm run build`: môi trường đóng gói hiện tại không có `node_modules`; `npm install` bị timeout nên chưa thể chạy Vite build tại đây. GitHub Actions vẫn cài dependency trước khi build.
