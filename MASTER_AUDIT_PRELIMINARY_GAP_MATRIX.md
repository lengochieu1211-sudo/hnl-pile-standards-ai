# HNL v1.26.0 — Preliminary Gap Matrix trước khi chạy Actions

Đây là kết quả **pre-flight/static** từ source `main` hiện tại + gói overwrite v1.26.0. Kết quả chính thức sẽ do `scripts/master-system-audit.mjs` tạo trong GitHub Actions sau khi dán đè và Push.

| Nhóm | Priority | Trạng thái | Nhận định trước CI |
|---|---:|---|---|
| Một version sản phẩm v1.26.0 | P0 | PRE-FLIGHT PASS | package/release/build/workflow trong overwrite đã được chuẩn hóa về một version. |
| Search Brain v1.9.23 | P0 | EXPECT PASS | Hash khóa hiện hành trên `main` đã được giữ; overwrite không sửa `src/search.js`. |
| DCE/XLL authority separation | P0 | EXPECT PASS | Registry hiện tại giữ XLL ở REFERENCE/REVIEW, không mở numeric Production. |
| Windows DCE path | P0 | PRE-FLIGHT PASS | Có `fileURLToPath`/absolute-path repair và smoke regression. |
| Exact 574 + Golden + DCE + SPT | P0 | PENDING CI | Phải chạy trên repo đầy đủ sau Push; không suy đoán PASS. |
| Excel LET/XLOOKUP/LAMBDA toàn exporter | P1 | OPEN EXPECTED | Source core vẫn còn nhiều workflow dùng hàm Microsoft 365; chỉ SPT explicit đã có compatibility repair. |
| Sheet user-facing tiếng Anh | P1 | OPEN EXPECTED | Source core còn `INPUT/CALC/LOOKUP/README/SOURCE...` ở nhiều workflow. |
| Dropdown tiếng Việt toàn bộ finite-choice | P1 | OPEN EXPECTED | SPT explicit + driven đã xử lý; bored/raw SPT/material/multi-borehole còn cần audit theo workflow. |
| Provenance Điều/Bảng/CT/Trang | P0/P1 | PENDING AUDIT | Core có provenance rộng nhưng cần gate từng workbook numeric. |
| Native chart coverage | P2 | PARTIAL | Hiện mới tập trung SPT explicit + driven; mở rộng sau P0/P1 khi có ý nghĩa kỹ thuật. |
| Raw SPT tiếp theo | P2 | DEFERRED | Chủ đích chưa làm trong Master Audit. |
| VBA Advanced | P2 | DEFERRED | Chưa đưa vào Production cho tới khi `.xlsx` ổn định. |

## Kết luận pre-flight

Không có cơ sở để gọi `PRODUCTION VERIFIED` trước Actions. Master Audit được thiết kế để **P0 chặn ngay**, còn các P1/P2 được gom thành Gap Matrix để xử lý theo cụm thay vì sửa lỗi rời rạc.
