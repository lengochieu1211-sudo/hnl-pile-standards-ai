# HNL Offline AI

## Vì sao Ollama không chạy khi mở từ GitHub Pages?
GitHub Pages dùng HTTPS, còn Ollama mặc định chạy tại `http://127.0.0.1:11434`. Trình duyệt có thể chặn kết nối HTTPS → HTTP cục bộ. Đây là giới hạn bảo mật của trình duyệt, không phải lỗi mô hình.

## Cách dùng đúng
1. Cài Node.js LTS và Ollama một lần.
2. Chạy `INSTALL_OFFLINE_MODELS.bat` để tải model.
3. Chạy `START_HNL_OFFLINE_AI.bat`.
4. App mở tại `http://127.0.0.1:8787/?offline=1` và tự chuyển sang HNL Offline AI.

Sau khi npm packages và model đã tải xong, việc hỏi đáp PDF/text/ảnh bằng Ollama có thể chạy không cần Internet.

## Model đề xuất
- Văn bản nhẹ: `qwen3:4b`
- Văn bản tốt hơn: `qwen3:8b`
- Đọc ảnh: `gemma3:4b`

Khi dùng ảnh, app tự chuyển sang model đọc ảnh đã cấu hình.
