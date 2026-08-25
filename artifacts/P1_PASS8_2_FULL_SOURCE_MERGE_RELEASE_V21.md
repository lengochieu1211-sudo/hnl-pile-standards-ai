# P1 Pass 8.2 — Full Source Merge + Production UI E2E Gate v21

## Kết luận

**FULL_SOURCE_MERGED_SOURCE_LOCKED**.

Pass 7 + Pass 8 + Pass 8.1 đã được đưa vào cây source ứng dụng HNL đầy đủ v1.25.7. Production Calc tab gọi đúng Pass 8 router, backend Bridge có endpoint dynamic Excel thật, template tiếng Việt v18 được đóng gói trong `bridge/templates`.

Runtime Web/Electron/Windows vẫn là **CERTIFICATION PENDING** trong môi trường audit Linux vì không có `node_modules`/Vite và không chạy Electron/Windows thực. Đây không phải lỗi source/golden.

## Luồng E2E đã kiểm

`UI thực (Calc tab)` → nhập cọc/địa chất/vật liệu/file kết cấu → `TÍNH` → Pass 8 Router → Pass 7 LOCKED → 8 bước diễn giải → `/api/hnl/pile/export-excel` → server chạy lại Pass 8 → so client/server → sinh XLSX tiếng Việt → mở lại workbook → so Golden.

Golden:
- Rsoil = 843.4285714285716 kN
- Rmaterial = 2952 kN
- Rpile = 843.4285714285716 kN
- γn = 1.15
- Nd,max = 733.4161490683232 kN/cọc
- governing pile = 168
- combination = EULS
- utilization = 0.4980692764464232
- kết luận = ĐẠT

## Gate

- Node full source: **574/574 PASS**
- Production UI E2E riêng: **8/8 PASS** (nằm trong 574)
- Full Table: **1242/1242 PASS**
- P0 Workflow: **35/35 metric PASS**
- Material: PASS
- DCE UDF behavioral: **213/213 acceptable; 0 FAIL**
- SPT normative decision: **26/26 PASS**
- Material E2E: PASS
- Multi-Borehole: PASS
- Pass4 Python fingerprint self-test: PASS
- Search Gate: PASS
- Version Gate: PASS
- Excel mở lại bằng spreadsheet parser: Golden đúng, **0 formula errors**

## Không regression các khối ngoài Pass 8.2

Byte SHA-256 trước/sau merge:
- `src/search.js`: `f9b65e5e6fb61dcca233a4fe43950e3174c73536f2fa83452da3041fbd0021d2`
- `src/pdf.js`: `5f9dd85f1c932b49f82def27d0c8c4002825a917c490ff11b3922ff5555b11a3`
- `src/ai.js`: `711f9dbe5e2c2e4255a980b8b59fa3fc4b801fad78e5e5dd1b7cd223538a7f11`

Cả ba file byte-identical với full source trước merge. `src/search.js` không bị sửa.

## Các thay đổi production chính

- `src/pass82-ui-controller.js`: controller UI, không chứa công thức kỹ thuật.
- `src/main.js`: chèn One-Click UI thật vào tab Tính toán; 4 khối Cọc / Địa chất+SPT / Vật liệu / Kết cấu; SVG inline; TÍNH; kiểm exporter; XUẤT EXCEL TIẾNG VIỆT.
- `src/styles.css`: responsive UI Pass8.2.
- `src/pass8-excel-export-client.js`: gọi endpoint theo `state.settings.bridgeUrl`.
- `bridge/server.mjs`: GET health + POST `/api/hnl/pile/export-excel`.
- `server/pass81-excel-route.mjs`: server rerun + anti-tamper + dynamic OOXML.
- `bridge/templates/HNL_P1_Pass7_Bao_Cao_Tinh_Toan_Coc_San_Xuat_v18.xlsx`: template production packaged.
- `package.json`: thêm `server/**/*` vào electron-builder files và gate script.
- Các module Pass4→Pass8.1 đã LOCKED được đưa vào full tree.

## Fail-safe

- UI không tính engineering formulas.
- Server không tin full engineering result từ client.
- Client/server summary lệch → HTTP 422 `PASS81_EXPORT_BLOCKED`.
- CSV không xác nhận `kN_m_C` → BLOCK.
- Kết quả có `KHÓA TÍNH` → không xuất Production Excel.

## Runtime build

`npm run build:web` trong môi trường audit: `vite: not found`, vì source không có `node_modules` và sandbox không cài dependency. Không đánh dấu lỗi này là regression source.
