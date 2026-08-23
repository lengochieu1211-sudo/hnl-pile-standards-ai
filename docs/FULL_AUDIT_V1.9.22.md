# Full Audit v1.9.22

## Phạm vi

PDF/PDF.js, OCR vùng chọn, Hybrid RAG, PDF native Gemini/OpenAI, lịch sử chat và tính toán, API key theo phiên, Bridge/Offline Ollama, archive, UI responsive, PWA, GitHub Pages và Windows packaging.

## Kết quả

- Version metadata đồng bộ và syntax gate đạt.
- Regression suite đạt toàn bộ bài kiểm thử hiện có.
- Không phát hiện API key hard-code; key UI chỉ giữ trong memory/sessionStorage.
- Electron giữ `nodeIntegration: false`, `contextIsolation: true`, `sandbox: true`; Bridge bind `127.0.0.1`.
- Sửa mất nội dung lỗi upstream khi provider trả text/non-JSON.
- Thêm request guard cho Bridge và cảnh báo thiếu PDF khi mở lại chat.
- OpenAI PDF detail đã được xác minh theo tài liệu chính thức.

## Giới hạn kiểm chứng

- Không gọi live Gemini/OpenAI vì gói nguồn không chứa API key và audit không được phép tự dùng key người dùng.
- Không tạo EXE trên Linux; workflow Windows sẽ build và kiểm tra đủ Setup + Portable sau khi push GitHub.
- ZIP không chứa `.git` hoặc URL repository, nên chỉ có thể push khi kho đích được kết nối/xác định.
