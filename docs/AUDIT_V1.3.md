# Audit v1.3 — Offline AI & Multi-Import

## Lỗi gốc xác nhận từ video

- Frontend đang chạy trên GitHub Pages HTTPS.
- Ollama cấu hình `http://127.0.0.1:11434`.
- UI đã tự cảnh báo khả năng bị chặn; khi kiểm tra kết nối thực tế trả lỗi do HTTPS → HTTP.
- Vì vậy `Tra cứu cục bộ` vẫn chạy nhưng đó chỉ là search/trích xuất, không phải LLM offline.

## Sửa kiến trúc

- Bridge có thể phục vụ luôn thư mục `dist` sau build.
- Chế độ Local mở ở `http://127.0.0.1:8787` nên frontend và Bridge cùng origin HTTP; Bridge gọi Ollama ở localhost.
- `?offline=1` tự chuyển provider sang Ollama và connection sang Bridge.
- `/api/health` kiểm tra thật Ollama `/api/tags`, không còn báo `ollama:true` giả khi Ollama chưa chạy.
- Body limit Bridge tăng để nhận ảnh base64.

## RAG thông minh hơn

- Bổ sung từ đồng nghĩa kỹ thuật: nghiệm thu/chấp nhận/xuất xưởng, vết nứt/rạn nứt, sức chịu tải/sức kháng nén, sai số/sai lệch, mối nối/măng xông/mặt bích...
- Top hit được bổ sung trang trước/sau để giảm mất ngữ cảnh điều khoản và bảng.
- Ảnh được thêm thành nguồn đa phương thức thay vì giả vờ OCR.

## Nhập dữ liệu

- PDF
- Folder recursive do browser trả danh sách relative path
- ZIP parser nội bộ: central directory + store/deflate
- Image: PNG/JPEG/WebP/BMP/GIF
- Text: TXT/MD/CSV/JSON/XML/HTML/YAML
- Chặn ZIP có mật khẩu, giới hạn 800 entries và 350 MB giải nén.
- HNL Local bổ sung endpoint giải RAR/7Z: thử `tar`, sau đó `7z`; không chạy từ GitHub Pages HTTPS.
- Phát hiện file trùng vẫn dùng SHA-256.

## Kiểm tra

- `node --test tests/*.test.mjs`: 11/11 PASS.
- `node --check` toàn bộ `src/*.js` và `bridge/*.mjs`: PASS.
- Build Vite chưa chạy trong môi trường tạo ZIP vì không có `node_modules`/npm registry, nhưng workflow GitHub vẫn cài dependency trước build như bản v1.2.
