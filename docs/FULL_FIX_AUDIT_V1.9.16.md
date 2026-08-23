# HNL Pile Standards AI v1.9.16 — Full Fix Audit

## Đã sửa

### 1. API key trên PC
- `Kiểm tra kết nối` thành công sẽ kích hoạt API key ngay trong `sessionStorage` của đúng provider.
- Direct và HNL Bridge đều dùng cùng key đang hoạt động.
- HNL Bridge nhận `apiKey` tạm thời trong request chat và header `X-HNL-API-Key` khi lấy danh sách model.
- Bridge không ghi key này xuống `.env` hay source.

### 2. AI Offline / Ollama
- Nếu chưa có Ollama, HNL Desktop có nút **Cài Ollama tự động**.
- Ưu tiên `winget install Ollama.Ollama`; fallback tải `OllamaSetup.exe` từ `ollama.com`.
- Fallback installer được kiểm tra Authenticode trước khi chạy silent.
- Có endpoint trạng thái cài đặt và polling UI.
- Sau khi Ollama có mặt, luồng tải model tiếp tục bình thường.

### 3. RAR
- Thêm production dependency `node-unrar-js@^2.0.2` và đóng gói module vào Desktop EXE.
- RAR ưu tiên bộ giải nén tích hợp HNL trước.
- 7-Zip / WinRAR / tar chỉ là fallback.
- Hỗ trợ luồng password required / bad password.
- Có sanitize tên entry để giảm nguy cơ path traversal.

### 4. PDF chọn chữ / OCR vùng
- PDF có text: render text overlay để bôi chọn và Ctrl+C.
- PDF scan/ảnh: công cụ **T▧** tự chuyển sang kéo vùng OCR.
- Chỉ crop vùng đã kéo, giới hạn output khoảng 1.8 MP trước khi gửi Vision/OCR.
- Không cần render/gửi toàn bộ trang khi chỉ muốn đọc một vùng nhỏ.

### 5. Windows identity
- `win.icon` vẫn dùng `build/icon.ico` đa kích thước.
- NSIS installer/uninstaller/header cũng ép dùng cùng icon HNL.
- `executableName` được cố định là `HNL Pile Standards AI`.

## Kiểm tra tự động
- Version Gate: PASS
- Node syntax: `src/main.js`, `src/ai.js`, `src/pdf.js`, `bridge/server.mjs`, `electron/main.cjs`: PASS
- Test suite: **68/68 PASS**
- `build/icon.ico`: hợp lệ, đa kích thước 16–256 px.

## Chưa thể xác nhận trong môi trường hiện tại
- `npm install` từ registry bị timeout trong môi trường chạy hiện tại, nên chưa build EXE cục bộ ở đây.
- Cần GitHub Actions build Windows thật để xác nhận `node-unrar-js` + Electron packaging + NSIS trên runner Windows.
- Sau khi build, cần chạy EXE thật trên máy Windows để kiểm tra Ollama installer/winget và RAR thực tế.
