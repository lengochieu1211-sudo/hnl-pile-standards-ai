# HNL Pile Standards AI v1.25.7 — P0 Pass 3 End-to-End Lock

Ngày: 2026-08-25

## 1. Mục tiêu

Khóa chuỗi `PDF TCVN → deterministic Engine → Formula-Only Excel graph → Golden benchmark → Production status` cho ba workflow P0 Pass 2:

1. `10304-end-bearing-rock` — cọc chống trên đá, §7.2.1, CT (5)–(8), Bảng 1.
2. `10304-bored-raw` — cọc có moi đất/khoan nhồi, §7.2.3, CT (13)–(16), Bảng 3, 6, 7, 8.
3. `10304-spt-raw` — sức chịu tải theo SPT, Phụ lục D, D.1–D.6, Bảng D.1.

XLSM `10.1 DCE_SctCoc_10304 2025.xlsm` chỉ là workflow/benchmark reference. Không XLL nào được dùng làm production dependency.

## 2. Nguồn chuẩn

Nguồn pháp lý dùng để xác minh là PDF `TCVN 10304:2025 – Thiết kế móng cọc` trong File Library của dự án.

- §7.2.1: CT (5)–(8), Bảng 1, trang 28–30.
- §7.2.3: CT (13)–(16), Bảng 6–8, trang 37–42.
- SPT: Phụ lục D, D.1–D.6 và Bảng D.1, trang 110–111.

Các cached value của XLSM không được dùng để thay thế PDF.

## 3. Thay đổi source

### 3.1 Production status registry

Thêm `src/production-status-registry.js`.

- `pile-geometry`: LOCKED.
- `borehole`: LOCKED.
- `interpolation-10304`: LOCKED.
- `10304-driven`: LOCKED.
- `10304-end-bearing-rock`: LOCKED numeric algorithm.
- `10304-bored-raw`: LOCKED numeric algorithm.
- `10304-spt-raw`: LOCKED numeric algorithm.
- `_xll.GetKsFromRQD`: REFERENCE / không chạy Production.
- `_xll.NoiSuySPT`: REFERENCE / cố ý không clone.
- `_xll.qb_SPT2025`: REFERENCE / không chạy Production.
- `_xll.flu_SPT2025`: REFERENCE / không chạy Production.
- EQ: REVIEW.
- TCVN 10304:2014: LEGACY.

`engineering-router.js` dùng registry này để quyết định numeric/export gate. Kết quả cọc đá `VERIFIED_PRELIMINARY` không được xuất Excel thiết kế cuối khi thiếu lower-bound có provenance.

### 3.2 Independent Excel formula model

Thêm `src/p0-pass3-excel-model.js` để dựng lại computation graph độc lập ở cấp formula-model. Module này không gọi wrapper `calculateRockEndBearing10304`, `calculateBoredPile10304`, `calculateSptPile10304`; chỉ chia sẻ primitive tra bảng đã LOCKED.

Mục đích là bắt lỗi kiểu: Engine đúng nhưng Excel formula graph sai hoặc thiếu intermediate.

### 3.3 Formula-Only workbook mới

`src/excel-export.js` có ba builder raw-profile:

- `export10304RockRawWorkbook`
- `export10304BoredRawWorkbook`
- `export10304SptRawWorkbook`

Các workbook chỉ nhận normalized INPUT. Không đưa `qb`, `fi`, `Qb`, `Qs`, `Rk`, `Rd` do Engine tính sẵn vào ô kết quả.

#### Rock workbook

Sheets: `README`, `INPUT`, `LOOKUP_BANG1`, `CALC_ROCK`, `SOURCE`.

Chuỗi formula: `geometry → RQD → Ks → Rm → embedment factor → qb cap/lower-bound → Rk → Rd → Nd,max`.

#### Bored workbook

Sheets: `README`, `INPUT`, `SOIL_PROFILE`, `LOOKUP_BANG3_6`, `LOOKUP_MUI`, `SHAFT_SEGMENTS`, `CALC_TIP_RK_RD`, `SOURCE`.

Chuỗi formula: `layer profile → tip layer → embedment gate → Bảng 7/8 → Bảng 3/6 từng phân tố → Qb/Qs → Rk → Rd → Nd,max`.

`SHAFT_SEGMENTS` sử dụng ranh giới địa tầng và `maxSegmentM`, không cắt xuyên ranh giới lớp. Bảng 3 không ngoại suy ngoài miền.

#### SPT workbook

Sheets: `README`, `INPUT`, `SOIL_PROFILE`, `SPT_POINTS`, `LOOKUP_D1`, `CALC_TIP`, `CALC_SHAFT`, `CALC_RK_RD`, `SOURCE`.

Chuỗi formula: `SPT measured points → normative tip window → measured-window average → Bảng D.1 → Qb/Qs → Rk → Rd → Nd,max`.

Không có `_xll.NoiSuySPT`, `_xll.qb_SPT2025`, `_xll.flu_SPT2025` trong workbook Production.

## 4. Workflow Golden

Script mới: `scripts/p0-pass3-workflow-golden.mjs`.

Artifact: `artifacts/p0-pass3/workflow-golden-v1.25.7.json`.

Kết quả:

- 3/3 workflow PASS.
- 35/35 intermediate metrics Engine ↔ Excel formula-model PASS.
- 5/5 XLSM cached benchmarks có cùng input/trace PASS.
- 5/5 boundary/safety cases PASS.

### XLSM benchmark trace đã tái lập

Rock:

- `7.2.1-10304-Cọc Chống!F38`: `Ks = 0.24` — PASS.
- `F40`: `Rm = 5365.714285714286 kPa` — PASS.
- `F41`: `qb = 16097.142857142859 kPa` — PASS.

Bored isolated-tip benchmark:

- `qb = 1149.6421145496095 kPa` — PASS.
- `Qb = 902.9268053316222 kN` — PASS.

SPT không dùng cached XLL như Golden khi không tái tạo được chính xác cùng raw input. Trạng thái XLSM của case SPT là `REFERENCE_UNAVAILABLE_FOR_SAME_INPUT`, không biến thành PASS giả.

## 5. Boundary gates

PASS:

- RQD ngoài 0–100 bị chặn.
- Mũi đúng ranh giới địa tầng dùng lớp sâu hơn và vẫn kiểm chiều sâu ngàm tối thiểu.
- Bảng 3 không ngoại suy ngoài miền.
- SPT không có điểm đo trong cửa sổ mũi bị chặn; không tự sinh N bằng nội suy XLL.
- Cọc driven hở mũi với `L/d_in < 2` bị chặn.

## 6. Full regression / table Golden

Sau toàn bộ P0 Pass 3:

- Full regression: **328/328 PASS**.
- Full Table Golden: **1242/1242 PASS**.
- Workflow Golden: **3/3 workflows, 35/35 metrics, 5/5 XLSM benchmarks, 5/5 boundary PASS**.
- Version Gate: PASS v1.25.7.
- Search Brain Guard: PASS; normalized SHA-256 `f9b65e5e6fb61dcca233a4fe43950e3174c73536f2fa83452da3041fbd0021d2`.

Full Table Golden giữ nguyên toàn bộ Bảng 2/3/4/6/7/8/12/15/16/17 và bổ sung Bảng 1 + Bảng D.1 từ P0 Pass 2.

## 7. Excel runtime / Release gate

Đã mở rộng `scripts/excel-runtime-smoke.mjs` để tạo và mở lại bằng ExcelJS cả ba workbook raw P0 Pass 3, ngoài các workbook 7888 / driven / 5574 hiện có.

Đã mở rộng `scripts/verify-excel-com.ps1` để khi chạy trên Windows có Microsoft Excel sẽ kiểm recalculation thực tế:

- đổi RQD → Ks/Rk phải đổi;
- đổi IL địa tầng cọc khoan → Rk phải đổi;
- đổi N-SPT đo trong cửa sổ → N mũi/Rk phải đổi.

CI `rc-final.yml` đã thêm `npm run golden:workflows` cho Linux và Windows, đồng thời upload workflow Golden artifact.

### Local sandbox hiện tại

Không đánh PASS giả:

- `npm ci`: **BLOCKED**, source ZIP đầu vào không có `package-lock.json`.
- `npm run excel:smoke`: **BLOCKED**, không có `exceljs` vì dependency chưa cài.
- `npm run build:web`: **BLOCKED**, không có `vite`.
- Windows `dist:win` / Excel COM: **NOT RUN** trong Linux sandbox.

Repo GitHub hiện có lockfile v1.25.7; khi đưa source này vào repo cần giữ lockfile của repo rồi để CI chạy Release Gate.

## 8. Định nghĩa trạng thái LOCKED trong Pass 3

`LOCKED` ở registry hiện biểu thị **numeric algorithm + source provenance + boundary Golden + Engine↔Formula-model parity đã khóa**. Nó không đồng nghĩa rằng binary release đã được build trong sandbox này.

Release artifact chỉ được gọi là fully green sau `npm ci → regression → table Golden → workflow Golden → ExcelJS smoke → web build → Windows build`, và Excel COM recalculation khi môi trường có Microsoft Excel.

## 9. Những thứ vẫn không được Production hóa

- DCE XLL binary implementation.
- `NoiSuySPT` của DCE.
- EQ/seismic XLL.
- TCVN 10304:2014 logic legacy.
- Bất kỳ cached result nào không truy được cùng input + PDF source.

## 10. Kết luận P0 Pass 3

**Algorithm Gate: PASS.**

Ba raw workflow Rock / §7.2.3 Bored / SPT đã có deterministic Engine, independent formula-model, Formula-Only exporter, provenance registry, workflow Golden và CI wiring.

**Release Runtime Gate: PENDING/BLOCKED BY LOCAL DEPENDENCY ENVIRONMENT**, không phải do Golden mismatch.
