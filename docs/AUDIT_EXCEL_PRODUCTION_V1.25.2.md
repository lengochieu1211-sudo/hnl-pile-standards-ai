# HNL Excel Production Audit v1.25.2

## Mục tiêu
Audit đường xuất Excel thực tế trước GitHub/EXE theo 4 gate:
1. Thay input → kết quả Excel thay đổi.
2. Không chép kết quả HNL thành số chết.
3. Không có sheet tiêu chuẩn/workflow không liên quan.
4. HNL ↔ Excel cho cùng kết quả tại Golden Case.

## Lỗi tìm thấy và đã sửa

### 1. TCVN 7888 bị đóng băng giá trị tra bảng
Root cause: exporter cũ lấy `t`, `σce`, `Mcr`, bền cắt bằng JavaScript tại thời điểm xuất. Một số ô còn dùng công thức dạng hằng số (`{formula: "90"}`), nên thay D/cấp/loại trong Excel không làm bảng tra thay đổi.

Sửa v1.25.2:
- Bảng 1/2 giữ trong `02_BANG_TRA`.
- `t`, `σce`, `Mcr`, bền cắt dùng `SUMIFS` theo `Loại + Cấp + D thân` từ `01_INPUT`.
- A0 → Ra dài hạn → Ra ngắn hạn → Pmax là công thức liên kết.
- NPH-AB và σcu dưới ngưỡng khóa kết quả.

Audit recalculation:
- PHC D600-B: t=90; Mcr=245,2; A0=144199,1028 mm²; Ra dài=3007,581287 kN; Pmax=4812,130059 kN.
- Đổi D600 → D800: t=110; Mcr=539,6; A0=238446,8824 mm²; Ra dài=4973,320690 kN; Pmax=7957,313104 kN.
- Đổi NPH-AB: `Safety=BỊ KHÓA`, Ra dài trống.

### 2. TCVN 5574 Phụ lục D/L/M còn sheet Benchmark QA trong file người dùng
Root cause: `export5574AnnexDLMWorkbook()` luôn tạo `05_BENCHMARK`.

Sửa v1.25.2:
- Bỏ sheet Benchmark khỏi workbook Production người dùng.
- Benchmark chỉ nằm trong test/audit nội bộ.

### 3. Một ô kết quả TCVN 5574 là chuỗi `="..."`, không phải formula object
Root cause: nhánh kiểm tra chung dùng string bắt đầu bằng `=` thay vì `{formula: ...}`.

Sửa v1.25.2:
- Chuyển thành formula object ExcelJS thật.

### 4. Workbook master v1.25.0 bị giữ trong runtime dù Lean Export không dùng
Root cause: pass v1.25.0 từng nạp nguyên template master. Sau v1.25.1 dispatcher đã chuyển sang generator workflow nhưng loader/template runtime vẫn còn.

Sửa v1.25.2:
- Xóa loader/injector template không dùng.
- Xóa template khỏi `public/` để Web/EXE không mang file thừa.
- Giữ workbook master trong `artifacts/` làm tài liệu QA/tham chiếu, không phải file export runtime.

## Actual exporter structure audit
Các exporter thật đã được gọi bằng ExcelJS API-compatible workbook mock để ghi lại chính xác sheet và formula object do source tạo:

- TCVN 7888 PHC: 7 sheet; 16 formula; không Benchmark; không sheet 10304/5574.
- TCVN 10304 cọc đóng: 7 sheet; 55 formula; không Benchmark; không sheet tiêu chuẩn khác.
- TCVN 10304 CPT: 4 sheet; 3 formula; lean.
- TCVN 5574 uốn: 7 sheet; 19 formula; không Benchmark.
- TCVN 5574 Phụ lục D: 3 sheet; 5 formula; `05_BENCHMARK` đã loại bỏ.

## Recalculation audit bằng workbook công thức
Do sandbox hiện không cài được package `exceljs`, không thể tạo binary XLSX bằng runtime browser/ExcelJS. Để không báo PASS giả:
- Đã chạy actual exporter function qua mock workbook để audit sheet/formula structure.
- Đã tái hiện chính các chuỗi công thức quan trọng bằng `artifact_tool` và thay input trực tiếp để xác nhận recalculation.

Kết quả:
- TCVN 7888: PASS.
- TCVN 10304 cọc đóng CT(9): fi lớp 2 44→50 làm R ma sát 672→748,8 kN; Rk 1264→1340,8 kN: PASS.
- TCVN 10304 CPT: qs 5000→6000 kPa làm Ru 880→960 kN: PASS.
- TCVN 5574 uốn: M 200→250 chỉ đổi M/Mu 0,65022→0,812775; As 1800→2000 làm Mu 307,588→336,961 kN.m: PASS.
- Formula error scan workbook audit: 0 lỗi #REF/#DIV0/#VALUE/#NAME/#N/A.

## Source regression
- `npm test`: PASS 259/259.
- Version Gate: PASS v1.25.2.
- Search Brain: PASS; normalized SHA-256 `f9b65e5e6fb61dcca233a4fe43950e3174c73536f2fa83452da3041fbd0021d2`.
- Secret scan: 0 hit cho mẫu Gemini/OpenAI/GitHub token.

## Build Gate
`npm run build:web`: NOT PASS trong sandbox vì `vite: not found` (dependencies không có trong ZIP và npm install không hoàn tất trong môi trường này).

Trước Release Candidate trên GitHub/Windows phải chạy:
1. `npm install --no-audit --no-fund`
2. `npm test`
3. `npm run build:web`
4. `npm run dist:win`
5. Mở EXE, xuất 3 workbook Golden bằng ExcelJS runtime thật, thay input trong Microsoft Excel và xác nhận recalc.

## Kết luận
Source v1.25.2 đạt gate logic Excel Production/Lean/Formula-Only trong phạm vi có thể chạy tại sandbox. Build Web/EXE và binary ExcelJS runtime smoke vẫn là bước tiếp theo; chưa được báo PASS.
