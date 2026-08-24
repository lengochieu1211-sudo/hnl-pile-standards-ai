# HNL Pile Standards AI v1.9.26 — Stable RAG Merge Audit

## Mục tiêu merge

Theo yêu cầu: **giữ “bộ não tìm kiếm” của v1.9.23, lấy “giao diện và phạm vi quét” của v1.9.25**.

## Cách merge thực tế

### Giữ nguyên v1.9.23
- `src/search.js` được chép nguyên từ v1.9.23 và giữ **byte-for-byte**.
- SHA-256 khóa regression: `f9b65e5e6fb61dcca233a4fe43950e3174c73536f2fa83452da3041fbd0021d2`.
- Các logic tokenizer tiếng Việt, exact/compact match, TOC target, balanced/deep search, ranking và local answer nằm trong `src/search.js` không bị chỉnh bởi UI scope.
- Các code path RAG/Hỏi đáp/Visual rescue của v1.9.23 trong `src/main.js` không bị thay bằng pipeline lookup mới của v1.9.25.

### Lấy từ v1.9.25
- UI de-duplication: Provider/Model/trạng thái kết nối chỉ có một nguồn điều khiển.
- Native PDF compact.
- Tra cứu có phạm vi: Thông minh / Vùng chọn / Trang hiện tại / Nhiều trang / Tài liệu hiện tại / Tài liệu đã tick / Toàn thư viện.
- Công thức có phạm vi: Vùng chọn / Trang hiện tại / Nhiều trang / Tài liệu hiện tại / Tài liệu đã tick / Toàn thư viện.
- Công thức mặc định Trang hiện tại; OCR/Vision bị giới hạn trong phạm vi người dùng chọn.
- UI State Guard, responsive, history, Offline AI và archive hardening giữ nguyên.

### Chống regression
- Parser trang (`28-35`, `28,31,45`) được tách sang `src/scope.js`, không đặt trong `src/search.js`.
- `runLookup()` nhận corpus đã scope rồi dùng lại hành vi lookup v1.9.23 (`searchEveryPage` + TCVN 7888 table assist), tránh chồng ranking/rescue pipeline mới.
- Test tự tính SHA-256 `src/search.js`; khác hash v1.9.23 thì FAIL.

## Kiểm tra

- Version: **1.9.26**
- `npm test`: **116/116 PASS, 0 FAIL**
- `npm run check:version`: **PASS**
- Syntax JS/MJS/CJS: **16/16 PASS**
- JSON parse: **3/3 PASS**
- GitHub Actions YAML parse: **2/2 PASS**
- Secret scan runtime/source: **0 key thật phát hiện**
- `src/search.js` hash v1.9.23: **MATCH**

## Build

`npm run build:web` chưa thể chạy trong môi trường hiện tại vì ZIP không kèm `node_modules`; lỗi thực tế: `vite: not found` (exit 127). Vì vậy báo cáo không đánh dấu Web/EXE build là PASS.

## Ca regression quan trọng

Sau deploy/build, cần thử trên chính PDF TCVN đã dùng thực tế:
1. Chọn nguồn TCVN 10304:2025.
2. Hỏi/tra `cọc chống` và `cọc chống là gì`.
3. Kết quả bản mới phải **ít nhất bằng v1.9.23**.
4. Sau đó thử đổi phạm vi Trang hiện tại / Nhiều trang / Toàn thư viện để xác nhận UI v1.9.25 không làm thay đổi search brain.
