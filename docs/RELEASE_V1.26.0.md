# HNL Pile Standards AI v1.26.0

## Release identity

- Version sản phẩm duy nhất: **v1.26.0**
- Giai đoạn chứng nhận: **Master System Audit**
- Golden Baseline: **1.25.7**
- Search Brain: **v1.9.23 LOCKED**
- Baseline commit: `660bda57ca50a7326e13c3b858f05c4864875f3c`

## Thay đổi chính

1. Excel Production dùng dropdown tiếng Việt cho các trường hữu hạn đã triển khai; mã kỹ thuật nằm trong sheet `99_MA_NOI_BO` ở trạng thái `veryHidden`.
2. SPT explicit dùng `VLOOKUP + IF + MIN` cho `q_b` và `f_s`, loại phụ thuộc `LET/XLOOKUP` tại đường tính đã gây `#NAME?`.
3. Thêm biểu đồ Excel native động cho SPT explicit và cọc đóng/ép.
4. Sửa DCE Golden path trên Windows bằng `fileURLToPath()` và bảo toàn absolute Windows path.
5. Đồng bộ Web / Desktop / PWA / RC / EXE về **một version duy nhất `1.26.0`**.
6. `jszip=3.10.1` là dependency trực tiếp vì lớp chart/smoke import trực tiếp package này.
7. Bổ sung **Master System Audit & Golden Certification** để tạo Gap Matrix P0/P1/P2 cho Web + Engine + Excel + Windows + CI + provenance + cross-workflow.

## Quy tắc chứng nhận

- `P0` mở → chặn mọi promotion.
- `P1` mở → chưa được gọi Production Verified; phải đóng trước RC Final.
- `P2` là coverage/usability/maintainability; xử lý sau P0/P1 theo Gap Matrix, trừ mục được ghi `DEFERRED` có chủ đích.
- Các file Golden mang hậu tố `v1.25.7` là **Golden Baseline**, không đổi tên giả để khớp release mới.
- Search Brain `v1.9.23` giữ LOCKED; không sửa `src/search.js` trong vòng audit này.

## Không làm trong Master Audit này

- Chưa thực hiện Raw SPT Pass tiếp theo.
- Chưa đưa VBA vào Production.
- Không biến DCE/XLL thành authority.
