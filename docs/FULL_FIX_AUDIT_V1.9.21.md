# HNL Pile Standards AI v1.9.21 — Native PDF / History / Hybrid RAG Audit

## Nguồn sửa

Bản này được nâng trực tiếp từ source **v1.9.20-RAG-Reindex-Fix** đang được audit, không suy đoán theo source cũ.

## 1. Native PDF AI

### Gemini
- HNL có thể gửi trực tiếp PDF gốc (`application/pdf`, base64 inline data) cùng câu hỏi.
- AI được yêu cầu đọc cả chữ, ảnh, bảng, sơ đồ và công thức trong PDF.
- Bundle native của HNL giữ giới hạn an toàn: từng PDF dưới 50 MB và tổng tối đa 1000 trang/request cho Gemini.
- Request có PDF native có timeout riêng dài hơn request text thường.

### OpenAI
- Khi có PDF native, HNL chuyển sang **Responses API** và dùng `input_file` thay vì chỉ Chat Completions/RAG text.
- Có `detail = low / auto / high` để điều chỉnh mức xử lý ảnh trang PDF.
- Bundle native raw của HNL giới hạn khoảng 42 MB để chừa dung lượng cho base64/prompt và nằm dưới giới hạn file request.

### Ba chế độ
1. **Tiết kiệm** — HNL RAG + targeted OCR/Vision, không gửi toàn PDF native.
2. **Cân bằng (mặc định)** — RAG chạy trước; chỉ gửi PDF native nếu câu hỏi rộng, căn cứ text yếu, hoặc cần đọc ảnh/scan.
3. **Toàn tài liệu** — gửi các PDF đủ điều kiện trực tiếp cho AI; HNL yêu cầu xác nhận khi có nguy cơ dùng nhiều quota/token.

HNL vẫn giữ Hybrid RAG ở mọi chế độ để tìm nhanh, Exact Phrase Guard, citation, adjacent/targeted page và fallback khi native PDF không phù hợp.

## 2. Hội thoại nối tiếp

- HNL đưa một số lượt trước vào prompt để hiểu câu hỏi nối tiếp/đại từ.
- Câu trả lời cũ **không được coi là nguồn tiêu chuẩn**.
- Mọi kết luận kỹ thuật mới vẫn phải đối chiếu lại PDF/RAG hiện tại.
- Khi mở lại phiên chat, HNL khôi phục các PDF nguồn của phiên đó nếu chúng còn tồn tại trong thư viện cục bộ.

## 3. Lịch sử Local-first

IndexedDB nâng lên DB version 2 với:
- `documents`
- `chatSessions`
- `calculations`

### Hỏi đáp
Lưu theo phiên:
- tiêu đề tự động;
- thời gian;
- provider/model;
- scope;
- danh sách PDF nguồn;
- câu hỏi/câu trả lời;
- citation/hit trang.

Có: tạo chat mới, mở lại chat, xóa phiên. API key không được ghi vào bản ghi lịch sử.

### Tính toán
Lưu:
- loại phép tính;
- input;
- kết quả;
- nguồn/tiêu chuẩn/trang;
- version HNL;
- thời gian.

Có thể nạp lại input rồi bấm Tính để chạy lại.

Retention: 30 / 90 / 365 ngày / không tự xóa. Đã sửa logic `0 = không tự xóa` để không bị ghi nhầm thành 365 ngày.

## 4. Chi phí/quota guard

- Không tự dùng PDF native ở chế độ Tiết kiệm.
- Cân bằng không gửi lại toàn PDF nếu RAG đã đủ căn cứ.
- Native toàn tài liệu hoặc OpenAI PDF lớn sẽ hỏi xác nhận trước.
- Không tự đổi provider/model khi quota/lỗi; retry model hiện tại trước và chỉ fallback sau khi người dùng bấm OK.

## 5. UI

- Cài đặt có thẻ **Đọc PDF native** cho Gemini/OpenAI.
- OpenAI có lựa chọn `Low / Auto / High` cho ảnh trang PDF.
- Chat có **+ Mới / Lịch sử**, hiển thị chế độ đọc PDF và số nguồn.
- Lịch sử chat hiển thị thời gian, số nguồn, provider/model.
- Tính toán có lịch sử thu gọn, không làm rối giao diện chính.
- Các khối dữ liệu đầu vào/chẩn đoán/changelog vẫn giữ thiết kế compact disclosure từ v1.9.19.

## 6. File chính đã sửa

- `src/main.js`
- `src/ai.js`
- `src/db.js`
- `src/styles.css`
- `bridge/server.mjs`
- `tests/wiring.test.mjs`
- `package.json`
- `README.md`
- `public/changelog.json`
- `docs/BUILD_METADATA.md`
- `docs/RELEASE_V1.9.21.md`
- `docs/FULL_FIX_AUDIT_V1.9.21.md`

## 7. Kiểm thử

- `npm run check:version`: **PASS — v1.9.21**
- `npm test`: **101/101 PASS, 0 FAIL**
- Syntax JS/MJS/CJS (`src`, `bridge`, `electron`, `scripts`): **13/13 PASS**
- Workflow YAML: `pages.yml` + `desktop-win.yml`: **parse PASS**
- Quét chuỗi API key thật trong source: **không phát hiện**
- Windows artifact template:
  - `HNL-Pile-Standards-AI-Setup-${version}-${arch}.${ext}`
  - `HNL-Pile-Standards-AI-Portable-${version}-${arch}.${ext}`
- Workflow Windows vẫn verify bắt buộc có cả Setup + Portable trước upload.

## 8. Chưa thể xác nhận runtime trong môi trường audit

`npm run build:web` **không chạy được** vì source không có `node_modules` và môi trường hiện tại không có `vite` (`vite: not found`). Vì vậy không đánh dấu PASS giả cho:
- Vite production build thực tế;
- Windows Setup/Portable build thực;
- request bằng API key Gemini/OpenAI thật;
- token/quota thực tế của tài khoản;
- tải model Ollama nhiều GB trên Windows thật.

Các phần này cần GitHub Actions hoặc máy Windows/Internet có dependency đầy đủ để xác nhận runtime.

## 9. Ghi chú kiến trúc

v1.9.21 dùng **native inline PDF input theo từng request**, không lưu provider file ID lâu dài. Đây là lựa chọn Local-first/privacy-first: tránh để tài liệu tồn tại remote ngoài ý muốn. Đổi lại, khi thật sự dùng native PDF ở nhiều lượt, dữ liệu PDF có thể phải truyền lại. Chế độ **Cân bằng** giảm việc này bằng cách chỉ bật native khi RAG/ảnh cho thấy cần thiết.
