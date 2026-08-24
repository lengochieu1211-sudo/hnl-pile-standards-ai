# HNL Pile Standards AI v1.12.0

## Verified engineering workflow + UI layout audit

- Nạp cấu trúc **Bảng 2, 3, 4 TCVN 10304:2025** với provenance trang chuẩn/PDF và trạng thái VERIFIED.
- Thêm Calculation Engine cho **cọc đóng/ép không moi đất** theo công thức (9): hình học → lớp mũi → qb → fi từng lớp → hệ số thi công → Rmũi → Rma sát → Rk → Rd.
- Thiếu địa chất/IL: dừng an toàn, báo đúng dữ liệu thiếu; không bịa qb/fi.
- Thêm **Excel workflow** nhiều lớp có input, bảng địa chất, bảng tra, công thức, kết quả và sheet thuyết minh nguồn.
- AI guardrail: không còn được trả lời rằng Bảng 2/3/4 “không có trong tài liệu” khi Code Pack đã nạp; phải tính phần hình học chắc chắn và nêu dữ liệu còn thiếu.
- UI 1366×768/Windows 125%: thu gọn AI & kết nối, giảm chiều cao header/tabs, tăng cỡ chữ nội dung chính, chat composer luôn ở đáy và không bị toolbar che.
- Không thay đổi `src/search.js`; Golden search brain v1.9.23 vẫn khóa regression LF/CRLF-safe.
