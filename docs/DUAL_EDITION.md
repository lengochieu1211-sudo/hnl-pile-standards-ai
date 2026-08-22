# Kiến trúc Dual Edition v1.8

## Web
Browser → IndexedDB / PDF.js / RAG → API trực tiếp Gemini/OpenAI/Claude/Grok.

Không cho chọn Ollama trên GitHub Pages để loại bỏ lỗi mixed-content HTTPS → HTTP.

## Desktop
Electron → localhost HNL Bridge → Ollama / semantic embedding / Vision / archive extraction.

Electron tự chạy Bridge; người dùng không phải mở `START_HNL_LOCAL_AI.bat`. BAT chỉ giữ lại để chẩn đoán hoặc chạy web-local không qua Electron.

## Quy tắc dữ liệu
- Offline: dữ liệu không rời máy.
- Online: chỉ nội dung/context mà ứng dụng gửi cho provider online mới rời máy.
