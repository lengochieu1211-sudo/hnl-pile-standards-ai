# HNL Pile Standards AI — P5 Full Calculation Gap Matrix

Baseline khi mở P5: `main@65296f120bb0b4da18143d253469b94ab94d5b45`.

> Lưu ý: hai commit cuối trên `main` chỉ tạo rồi xóa một placeholder, tree cuối cùng quay lại đúng tree ứng dụng đã chứng nhận trước đó. Không có thay đổi Search Brain hay Calculation Engine.

## Mục tiêu P5

P5 không viết lại các engine đã khóa. Mục tiêu là mở rộng coverage tính toán theo từng workflow, nhưng mỗi workflow chỉ được Production khi có đủ chuỗi:

`Input/PDF → deterministic engine → bảng/hệ số/điều kiện áp dụng → provenance → Excel công thức thật → runtime recalculation → Golden → registry Production gate`.

AI/OCR/Vision chỉ được hỗ trợ hiểu input hoặc tạo evidence ở mức REVIEW; không được tự thay thế deterministic engine.

## Coverage hiện tại

| Workflow | Trạng thái hiện tại | Registry / evidence chính | Hành động P5 |
|---|---|---|---|
| Cọc đóng/ép | PRODUCTION LOCKED | `10304-driven` | Giữ khóa; chỉ mở rộng regression/boundary cases. |
| Cọc khoan nhồi / cọc ma sát | PRODUCTION LOCKED | `10304-bored-raw`, `10304-end-bearing-rock` | Giữ khóa; không sửa core nếu Golden không chỉ ra lỗi. |
| SPT | PRODUCTION LOCKED / VERIFIED | `10304-spt-raw`, `10304-spt-summary-explicit` | Giữ geometry-first, layer integration, workbook parity. |
| Vật liệu cọc TCVN 5574 | PRODUCTION LOCKED | `5574-pile-material-near-centered-rect` | Giữ làm nhánh Rmaterial. |
| Tích hợp Rsoil ↔ Rmaterial | PRODUCTION LOCKED | `pile-capacity-integrated-square` | Giữ gate min/capacity basis. |
| Multi-borehole | PRODUCTION LOCKED | `pile-capacity-multiborehole-square` | Giữ governing audit. |
| CPT | MISSING PRODUCTION GATE | Chưa có registry Production riêng | P5.2. |
| Thí nghiệm tải tĩnh | MISSING PRODUCTION GATE | Chưa có registry Production riêng | P5.3. |
| Lún cọc đơn | MISSING PRODUCTION GATE | Chưa có registry Production riêng | P5.4. |
| Lún nhóm cọc | MISSING PRODUCTION GATE | Chưa có registry Production riêng | P5.5. |
| Khối móng quy ước | MISSING PRODUCTION GATE | Chưa có registry Production riêng | P5.5. |
| Cọc vít / helical | MISSING PRODUCTION GATE | Chưa có registry Production riêng | P5.6. |
| Thử động / PDA | MISSING PRODUCTION GATE | Chưa có registry Production riêng | P5.7. |
| Bè-cọc | MISSING PRODUCTION GATE | Chưa có registry Production riêng | P5.8. |

## Thứ tự triển khai bắt buộc

1. **P5.1 — Coverage Audit Gate**: đóng inventory máy đọc được, bảo vệ Search Brain + các Production workflow hiện có.
2. **P5.2 — CPT**: reverse-engineer authority → deterministic engine → Excel → Golden.
3. **P5.3 — Static Load Test**: ingest dữ liệu tải/chuyển vị + interpretation module + provenance; không dùng AI để kết luận numeric cuối.
4. **P5.4 — Single-pile Settlement**: soil-profile integration + SLS logic + Excel + Golden.
5. **P5.5 — Group Settlement + Equivalent Block**: geometry nhóm + equivalent block + boundary/applicability audit.
6. **P5.6 — Screw Pile**: chỉ mở Production khi có đủ authority và benchmark độc lập.
7. **P5.7 — Dynamic/PDA**: mặc định REVIEW; promotion cần evidence độc lập.
8. **P5.8 — Piled Raft**: REVIEW trước, không auto-promote từ OCR/AI.
9. **P5.9 — Full Cross-workflow Golden**: Engine ↔ Excel từng case, exact-head CI, PR, expected-head merge, exact-main certification.

## Gate an toàn

P5.1 được phép PASS dù còn workflow `MISSING_PRODUCTION_GATE`. Đây là Gap Matrix, không phải tuyên bố mọi workflow đã hoàn thiện. P5.1 chỉ FAIL khi một workflow Production hiện có bị mất registry lock, Search Brain `1.9.23` đổi hash, hoặc version identity lệch.

Không được đổi `src/search.js`; không sửa các engine LOCKED chỉ để làm cho audit xanh.
