# HNL Pile Standards AI v1.22.0 — TCVN 5574 Annex D / L / M Audit

Ngày audit: 2026-08-24

## 1. Phạm vi pass

Pass này đi đúng thứ tự: **Phụ lục D → Phụ lục L → Phụ lục M**. Nguyên tắc: chỉ nhánh đã (1) đối chiếu PDF gốc, (2) khóa điều kiện áp dụng, (3) có Calculation Engine deterministic, và (4) có Excel formula độc lập + benchmark đạt tolerance mới được sinh số.

Search Brain `src/search.js` không thay đổi. Normalized SHA-256: `f9b65e5e6fb61dcca233a4fe43950e3174c73536f2fa83452da3041fbd0021d2`.

## 2. Phụ lục D — chi tiết đặt sẵn

### VERIFIED BRANCH
- D.1: tương tác trượt + kéo theo hàng neo nguy hiểm.
- D.2: `Nan,j = M/z + N/nan`.
- D.3: `Qan,j = (Q - 0.3 N'an)/nan`.
- D.4: `N'an = M/z - N/nan`, kèm quy tắc dấu và trường hợp chi tiết đặt sẵn ở mặt trên khi đổ bê tông.
- D.6: `Nan,j,0 = Rs Aan,j`.
- D.7: neo xiên 15°–30°, `Aan,inc = (Q - 0.3 N'an)/Rs`.

### REVIEW / safety gate
- **D.5 chưa tự máy hóa**: biểu thức text extraction của PDF chưa đủ rõ để xác nhận toàn bộ cấu trúc và đơn vị một cách độc lập. Vì vậy `Qan,j,0` bắt buộc là INPUT có provenance. Không tự suy đoán D.5.
- Các chi tiết thép ngoài và mối hàn vẫn theo TCVN 5575:2012, không bị thay thế bởi workflow D.

### Benchmark
- D.1: M=40 kN.m, N=100 kN, Q=150 kN, z=400 mm, nan=2, Aan=800 mm², Qan0=200 kN → utilization = `0.8732142857142857`; HNL = Excel; PASS.
- D.7: Q=200 kN, N'an=50 kN, CB400-V Rs=350 MPa, angle=20° → `Aan,inc = 528.5714285714286 mm²`; HNL = Excel; PASS.

## 3. Phụ lục L — Bảng L.1

### VERIFIED PARTIAL
Đã số hóa chắc chắn các mục nhìn rõ trong PDF:
- chữ nhật: γ=1.30;
- chữ T, cánh chịu nén: γ=1.30;
- chữ T, cánh chịu kéo:
  - bf ≤ 2b → γ=1.25;
  - bf > 2b và hf/h ≥ 0.2 → γ=1.25;
  - bf > 2b và hf/h < 0.2 → γ=1.20.

Các hình dạng còn lại của Bảng L.1 chưa được tự sinh số trong pass này.

Benchmark mục 3c: bf=900, b=300, hf=50, h=500 → γ=`1.20`; HNL = Excel; PASS.

## 4. Phụ lục M — độ võng và chuyển vị

### VERIFIED PARTIAL numeric branches
- M.4.1.3: trường hợp không được nêu riêng → `L/150`; công xôn → `Lcantilever/75`.
- Bảng M.1: các hàng đã đối chiếu trực tiếp gồm dầm cầu trục L/250, cabin A1–A6 L/400, A7 L/500, A8 L/600, mái/sàn nhìn thấy các mốc, lớp mặt có thể tách L/150, palăng/cần trục treo min(L/300,a/150) hoặc min(L/400,a/200), bản thang/sàn tự do 0.7 mm, lanh tô/tấm tường L/200.
- M.2 + Bảng M.2: giới hạn tâm sinh lý theo p, p1, q, n, b. `p1` khi phụ thuộc TCVN 2737 phải có nguồn, HNL không tự bịa.
- Bảng M.3: giới hạn ngang cột/trụ/dầm cần trục theo nhóm A1–A3/A4–A6/A7–A8, không nhỏ hơn 6 mm.
- Bảng M.4: chuyển vị ngang cấu tạo cho nhà nhiều tầng, tường gạch/panel, ceramic, nhà một tầng; nội suy mốc hs theo quy định.

### Benchmark
- M.4.1.3 L=6 m → 40 mm; PASS.
- M.2 p=1.5, p1=0.2, q=3 kPa, n=2 Hz, b=50 → `2.40140625 mm`; PASS.
- M.3 A4–A6, cột trong nhà h=12 m → `12 mm`; PASS.
- M.4 nhà một tầng hs=15 m → `75 mm`; PASS.

## 5. AI → workflow → Excel

- Router có workflow riêng `5574-annex-d`, `5574-annex-l`, `5574-annex-m`, được ưu tiên trước route biến dạng chung.
- Chat UI đã sửa để hiện nút **Xuất Excel** cho cả TCVN 5574 khi status bắt đầu bằng `VERIFIED`, không còn chỉ hiện cho TCVN 10304.
- Exporter TCVN 5574 không còn hard-code danh sách 7 workflow cũ; D/L/M có workbook riêng với INPUT màu vàng, công thức thật, thuyết minh, provenance và benchmark.
- D.5 vẫn bị safety-gate dù nút Excel tồn tại: workbook yêu cầu `Qan,j,0` có provenance.

## 6. Excel production v1.22.0

Thêm:
- `22_PHU_LUC_D`;
- `23_PHU_LUC_L`;
- `24_PHU_LUC_M`;
- cập nhật `15_BENCHMARK`, `21_PHU_LUC_INDEX`, `07_NGUON`, `00_TONG_QUAN`.

Benchmark production mới: 7/7 nhánh D/L/M PASS. Formula error scan: 0 hit `#REF!/#DIV0!/#VALUE!/#NAME?/#N/A` sau bản sửa cuối.

## 7. Test / audit kỹ thuật

- `npm test`: **232/232 PASS, 0 FAIL**.
- Version Gate: **PASS v1.22.0**.
- Search Brain normalized hash: **PASS**, không đổi.
- JS syntax scan: **PASS**.
- Secret pattern scan: **0 hit** cho các pattern API/private-key chính.
- `npm run build:web`: **CHƯA PASS trong môi trường này** vì `vite: not found`. Không báo build PASS giả.
- Windows Setup/Portable: chưa chạy trong Windows runner ở pass này.

## 8. Trạng thái sau pass

| Phần | Trạng thái | Numeric auto |
|---|---|---|
| Phụ lục D D.1–D.4/D.6 | VERIFIED BRANCH | Có, khi Qan0 có provenance |
| Phụ lục D D.7 | VERIFIED | Có |
| Phụ lục D D.5 | REVIEW | Không |
| Phụ lục L Bảng L.1 mục 1–3 | VERIFIED PARTIAL | Có |
| Phụ lục L mục còn lại | INDEXED/REVIEW | Không |
| Phụ lục M các nhánh nêu trên | VERIFIED PARTIAL | Có |
| Phụ lục M phần chưa máy hóa | INDEXED | Không |

Không đổi trạng thái toàn Phụ lục thành VERIFIED khi vẫn còn nhánh chưa đủ căn cứ.
