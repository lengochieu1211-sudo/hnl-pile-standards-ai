# Audit — Lean Export + Formula-Only Production v1.25.1

## Đã sửa
1. `exportUnifiedEngineeringWorkbook()` không còn mở workbook master và giữ toàn bộ sheet.
2. Export được dispatch theo đúng workflow:
   - TCVN 7888 → workbook 7888.
   - TCVN 10304 driven → workbook cọc đóng nhiều lớp.
   - Các workflow 10304 khác → workbook chuyên biệt đúng workflow.
   - TCVN 5574 → workbook chuyên biệt đúng workflow.
3. Không còn chép `payload.result` vào sheet Production dưới dạng số chết.
4. Kết quả Production do generator workflow tạo bằng công thức Excel liên kết input/bảng tra.
5. REVIEW/INDEXED vẫn bị khóa numeric export.
6. Provenance ảnh chỉ thêm khi có image input.
7. Search Brain `src/search.js` không chỉnh sửa trong pass này.

## Test thực chạy
- `npm test`: PASS 255/255.
- Version gate: PASS v1.25.1.
- Search regression/golden suite nằm trong `npm test`: PASS.
- `npm run build:web`: CHƯA PASS trong môi trường hiện tại vì source ZIP không chứa Vite executable/package hợp lệ (`vite: Permission denied`; `node_modules/vite/bin/vite.js` không tồn tại). Không báo PASS giả.

## Gate trước GitHub/EXE
Trên checkout sạch cần chạy `npm ci`, sau đó:
- `npm test`
- `npm run build:web`
- `npm run dist:win`
Chỉ phát hành khi cả ba PASS.
