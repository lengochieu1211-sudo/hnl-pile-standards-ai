# Audit v1.25.5 — Chat-to-Calculation-to-Excel + Math Display Fix

## Lỗi tái hiện từ ảnh/video
AI hiển thị LaTeX thô trong kết luận, ví dụ:
- `$P_v \approx 1234,79 \text{kN}$`
- `$R_d \approx 302,14 \text{kN}$`
- `$N_{d,\max} \approx 262,73 \text{kN}$`

Ngoài ra, câu trả lời kỹ thuật có thể không hiện nút Excel khi workflow VERIFIED nhưng thiếu một vài input.

## Sửa v1.25.5
1. Renderer riêng `src/math-render.js` hỗ trợ `$...$`, `\(...\)`, `$$...$$`, ký hiệu LaTeX thông dụng, `\text{}`, chỉ số dưới/trên và double-backslash từ JSON/provider.
2. Câu trả lời engineering có thanh hành động riêng:
   - `Xuất Excel tính toán` khi VERIFIED + đủ input.
   - `Bổ sung dữ liệu để xuất Excel` khi VERIFIED nhưng thiếu input.
   - `Mở trong Tính` để chuyển nguyên đề bài.
   - `Xem nguồn tính` để mở provenance/citation.
3. Tab Tính có `Bài toán từ Hỏi đáp`: sửa/bổ sung đề bài, chạy lại deterministic Calculation Engine, rồi xuất Excel.
4. Excel vẫn đi qua `exportUnifiedEngineeringWorkbook()` → Lean Formula-Only workflow exporter. Không chép số prose của AI thành kết quả chết.
5. REVIEW/INDEXED không xuất numeric Excel; VERIFIED METHOD giữ method-only gate.
6. GitHub workflows tự đồng bộ package-lock khi version package đổi, không còn chỉ kiểm trường hợp file lock bị thiếu.

## Regression đã chạy
- `npm test`: 281/281 PASS.
- `npm run golden:tables`: 1.130/1.130 PASS.
- Search Brain: SHA-256 chuẩn vẫn `f9b65e5e6fb61dcca233a4fe43950e3174c73536f2fa83452da3041fbd0021d2`.
- YAML 3 workflows: parse PASS.
- Node syntax: main.js / math-render.js / excel-export.js PASS.
- Math screenshot regression: PASS, không còn `\approx`, `\text{kN}` hoặc dấu `$` thô trong HTML render.

## Chưa chạy trong sandbox
- `npm ci`, Vite Web build, Electron Setup/Portable và ExcelJS binary smoke cần GitHub Actions vì môi trường hiện tại không có node_modules/package-lock mới của repo.
- RC workflow sẽ tự refresh package-lock v1.25.4 → v1.25.5 rồi chạy full gate ở lượt tiếp theo.
