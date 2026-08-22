# Kiến trúc HNL Pile Standards AI v1.0

## Frontend GitHub Pages
- Vite + JavaScript thuần, không cần database cloud.
- PDF.js đọc PDF trực tiếp trên thiết bị.
- IndexedDB lưu PDF và text đã trích xuất cục bộ.
- RAG đơn giản: chia text theo từng trang, tìm đoạn liên quan trước khi gửi AI.
- Citation luôn gắn tên tiêu chuẩn/file + số trang.

## HNL AI Bridge
Frontend không chứa API key. `bridge/server.mjs` chạy riêng ở máy cá nhân hoặc backend riêng.

Provider hỗ trợ:
- Ollama (offline)
- Gemini
- OpenAI / ChatGPT API
- Anthropic Claude
- xAI Grok

## Nguyên tắc an toàn kỹ thuật
1. Mặc định bật “Chỉ trả lời theo tài liệu”.
2. Nếu không đủ căn cứ, AI phải báo không tìm thấy đủ thông tin.
3. Không dùng AI để âm thầm thay thế điều khoản/công thức gốc.
4. Kết quả tính toán là hỗ trợ kỹ thuật; hồ sơ thiết kế và tiêu chuẩn gốc vẫn là căn cứ chính.
