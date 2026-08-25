# P1 Pass 8 – One-Click Calculation UI / Workflow Router v19

## Mục tiêu
Người dùng chỉ nhập/chọn loại cọc, địa chất + SPT, vật liệu và file kết cấu, sau đó bấm **TÍNH**. Router gọi đúng chuỗi Pass 7 đã khóa và trả về diễn giải tiếng Việt theo 8 bước.

## Golden
- Rsoil = 843.4285714285716 kN
- Rmaterial = 2952 kN
- Rpile = 843.4285714285716 kN
- γn = 1.15
- Nd,max = 733.4161490683232 kN/cọc
- Governing = Point 168 / EULS
- Kết luận = ĐẠT

## UI
- 4 khối: Loại cọc / Địa chất + SPT / Vật liệu / File kết cấu.
- Nút **TÍNH**.
- Kết quả KPI + diễn giải 8 bước.
- Nút **XUẤT EXCEL TIẾNG VIỆT**.
- SVG-only icons/flow assets.

## Export Excel
Router tạo export contract dùng template v18. Export client chỉ POST payload tới `/api/hnl/pile/export-excel`; không chứa công thức kỹ thuật. Backend exporter động cần gate runtime riêng khi tích hợp full app.
