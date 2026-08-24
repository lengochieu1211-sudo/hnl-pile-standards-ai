# HNL v1.25.4 — Full Table Golden Benchmark Audit

## Kết quả tổng
- Golden cases: **1.130**
- PASS: **1.130**
- FAIL: **0**
- Source regression: **275/275 PASS**
- Search Brain normalized SHA-256: `f9b65e5e6fb61dcca233a4fe43950e3174c73536f2fa83452da3041fbd0021d2`

## Phạm vi theo bảng
| Bảng | Cases | PASS | FAIL |
|---|---:|---:|---:|
| 2 | 247 | 247 | 0 |
| 3 | 342 | 342 | 0 |
| 4 | 8 | 8 | 0 |
| 6 | 42 | 42 | 0 |
| 7 | 140 | 140 | 0 |
| 8 | 121 | 121 | 0 |
| 12 | 11 | 11 | 0 |
| 15 | 104 | 104 | 0 |
| 16 | 46 | 46 | 0 |
| 17 | 69 | 69 | 0 |

## Loại case
- EXACT: kiểm đúng mốc bảng.
- MID / MID-2D: nội suy một chiều và song tuyến tại các khoảng hợp lệ.
- BOUNDARY / EDGE-BAND: chỉ áp dụng plateau hoặc miền ≤/≥ khi tiêu chuẩn cho phép.
- OUTSIDE / NULL: phải BLOCK; không ngoại suy và không nội suy xuyên ô trống.
- DISCRETE: bảng phân loại rời rạc không được nội suy.

## Lỗi phát hiện nhờ benchmark
Bảng 8 là bảng thưa: tại độ sâu 30 m và 40 m, các cột IL=0,5 và 0,6 có ô trống. Engine `bilinear2DStrict()` cũ quét tất cả cột IL trước khi chọn bracket, nên các case hoàn toàn hợp lệ như `z=30; IL=0,3` hoặc `z=35; IL=0,35` bị BLOCK sai.

Golden matrix ban đầu: **102/121 PASS, 19 FAIL** cho Bảng 8.

Đã sửa engine theo logic:
1. xác định bracket IL cần dùng;
2. chỉ đánh giá hai cột IL đó;
3. sau đó nội suy theo z;
4. vẫn BLOCK nếu chính bracket đang dùng đi qua ô trống.

Sau sửa: **121/121 PASS** cho Bảng 8.

## Excel cell-by-cell
Workbook `HNL-Full-Table-Golden-Benchmark-v1.25.4.xlsx` có 1.130 dòng. Mỗi dòng chứa:
- Input;
- loại chính sách;
- mốc nội suy;
- HNL result;
- Expected từ bảng/công thức;
- Excel formula độc lập;
- sai lệch;
- trạng thái HNL↔Expected;
- trạng thái HNL↔Excel.

Formula scan: không có `#REF!`, `#DIV/0!`, `#VALUE!`, `#NAME?`, `#N/A`.

## Release gate
Chưa khóa RC. Bước sau benchmark là GitHub checkout sạch → `npm ci` → `npm test` → `npm run build:web` → build Setup/Portable Windows → smoke test xuất Excel thực tế bằng runtime ExcelJS và mở bằng Microsoft Excel.
