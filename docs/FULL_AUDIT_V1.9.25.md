# HNL Pile Standards AI v1.9.25 — Full UI / Scope / Logic Audit

Nguồn nâng cấp: source v1.9.23 đã chứa Runtime RAG Rescue, sau đó dọn UI thành v1.9.24 và bổ sung yêu cầu mới về phạm vi Tra cứu/Công thức trong v1.9.25.

## Mục tiêu đợt này

- Dọn trùng giao diện: Provider/Model/connection chỉ hiển thị ở một summary và một form điều khiển trong Cài đặt.
- Tách khái niệm **Nguồn mặc định AI/RAG** khỏi **Phạm vi thao tác** của Tra cứu/Tính.
- Tra cứu và quét công thức không mặc định quét nặng toàn bộ PDF.
- Cho phép Vùng chọn / Trang hiện tại / Nhiều trang / Tài liệu / Đã tick / Toàn thư viện.
- Không tự mở rộng phạm vi người dùng đã chọn.

## Thay đổi giao diện

### AI / Kết nối
- Topbar chỉ còn badge số nguồn; không còn badge Gemini/OpenAI lặp.
- Tiêu đề Trợ lý không lặp provider.
- Khối `AI & kết nối` hiển thị provider + model + trạng thái đúng một lần; bấm vào để mở Cài đặt.
- Cài đặt chỉ có một `providerSelect`, một `modelInput`, một `nativePdfModeInput`.
- Khóa nguồn chỉ có một công tắc visible tại Thư viện.

### Nguồn và phạm vi
- Sidebar đổi nhãn `Phạm vi hỏi đáp / tìm kiếm` thành **Nguồn mặc định AI / RAG**.
- Nguồn mặc định tiếp tục phục vụ Hỏi đáp/Tóm tắt và chế độ Tra cứu `Thông minh`.
- Tra cứu/Tính có phạm vi riêng, nên người dùng có thể giới hạn theo vùng/trang mà không làm thay đổi nguồn mặc định toàn ứng dụng.

### Tra cứu
Phạm vi mới:
1. Thông minh — exact/RAG trước, Fresh PDF.js khi index lỗi, Local OCR trang đích khi cần.
2. Vùng chọn gần nhất.
3. Trang hiện tại.
4. Nhiều trang — cú pháp `28-35`, `28,31,45`, hoặc trộn khoảng/danh sách.
5. Tài liệu hiện tại.
6. Tài liệu đã tick.
7. Toàn thư viện.

Nếu người dùng chọn phạm vi cụ thể, HNL không tự mở rộng ngoài phạm vi đó. `Fresh PDF.js rescue` cũng lọc ngược lại đúng các trang được phép.

### Công thức
Phạm vi mới:
1. Vùng chọn gần nhất — tiết kiệm nhất.
2. Trang hiện tại — **mặc định**.
3. Nhiều trang.
4. Tài liệu hiện tại.
5. Tài liệu đã tick.
6. Toàn thư viện — nặng nhất.

Phương pháp:
- Tự động Hybrid.
- Cục bộ nhanh / lớp chữ.
- AI/Vision **chỉ trong phạm vi đã chọn**.

Khi AI/Vision cần quét nhiều trang, hộp xác nhận ghi rõ số trang + phạm vi + cảnh báo quota/token. Không tự quét toàn thư viện nếu người dùng không chọn.

## Logic tìm kiếm / RAG giữ lại

- Exact Phrase Guard.
- Fresh PDF.js phrase rescue từ Blob gốc.
- Character-spaced glyph recovery.
- TOC target resolver.
- Targeted local OCR / Vision fallback.
- Native PDF mode không tự quay về Cân bằng.
- PDF > giới hạn native giữ mode nhưng fallback trang mục tiêu.
- Citation vẫn gắn docId + page và nhảy đúng PDF.

## Audit giao diện trùng

Không còn các control trùng đồng thời:
- `ai-badge`: 0.
- `mode-chip`: 0.
- `assistantSettingsSummary`: 1.
- `providerSelect`: 1.
- `modelInput`: 1.
- `strictSide`: 1.
- `nativePdfModeInput`: 1.

Các ID xuất hiện nhiều lần trong source (`pdfScroll`, `pageRange`, `aiChecklist`, `refreshLocalModelManager`) nằm ở các nhánh template loại trừ nhau và không xuất hiện đồng thời trong DOM.

## Kiểm thử

- `npm test`: **115/115 PASS, 0 FAIL**.
- Version Gate: **PASS v1.9.25**.
- JavaScript/MJS/CJS syntax: **13/13 PASS**.
- `package.json` + `public/changelog.json`: JSON parse PASS.
- GitHub workflow YAML: Pages + Windows parse PASS.
- Secret heuristic scan: không phát hiện API key thật theo pattern Gemini/OpenAI/Grok/Claude.

## Build thực tế

`npm run build:web` chưa chạy được trong môi trường audit vì source không có `node_modules` và lệnh `vite` không tồn tại (`vite: not found`). Vì vậy không ghi Web/EXE runtime build là PASS giả. GitHub Actions/Windows vẫn cần chạy để xác nhận Setup/Portable thật.

## Version

- Current: **1.9.25**.
- `package.json` là nguồn version chính.
- README, changelog, release hiện hành, build metadata và Windows artifact templates đã qua Version Gate.
