# HNL Pile Standards AI v1.25.7 — SPT PDF Decision Pass

Ngày: 2026-08-25

## 1. Mục tiêu

Khóa dứt điểm khác biệt giữa HNL và DCE trong cách dùng dữ liệu SPT dọc thân cọc. Nguồn quyết định là PDF **TCVN 10304:2025**, Phụ lục D (quy định), D.1–D.6 và Bảng D.1, trang chuẩn 110–111. XLSM/XLL DCE chỉ là nguồn reference để hiểu hành vi phần mềm cũ.

## 2. Điều tiêu chuẩn thực sự quy định

Phụ lục D dùng chuỗi:

- D.1: giá trị đặc trưng sức chịu tải cọc lấy theo sức chịu tải giới hạn xác định từ SPT.
- D.2: `Ru = Ru,b + Ru,f`.
- D.3: `Ru,b = qb · A`.
- D.4: `Ru,f = Ru,fs + Ru,fc`.
- D.5: `Ru,fs = fs · Ls · u` cho phần thân trong đất rời.
- D.6: `Ru,fc = fc · Lc · u` cho phần thân trong đất dính.

Bảng D.1 định nghĩa riêng:

- `N` tại mũi là **giá trị trung bình SPT trong vùng quy định quanh mũi**, có giới hạn trên 100.
- với cọc đóng/ép: vùng lấy N kéo từ 4d phía trên đến 1d phía dưới mũi;
- với các loại cọc còn lại: 1d phía trên đến 1d phía dưới mũi;
- `Ns` là chỉ số SPT của đất rời ở phần thân cọc;
- `Nc` là chỉ số SPT của đất dính ở phần thân cọc; khi không có `cu`, Bảng D.1 cho phép quan hệ `cu = 6.25 Nc` ở nhánh tương ứng.

**Không có câu nào trong D.1–D.6/Bảng D.1 yêu cầu tạo hàm N(z) liên tục bằng nội suy tuyến tính dọc chiều sâu. Không có quy định bắt buộc tích phân ma sát bằng right-end rectangle như DCE.**

## 3. Quyết định Production đã LOCKED

### 3.1 N tại mũi

`MEASURED-WINDOW-ARITHMETIC-MEAN`

- chỉ lấy các điểm SPT đo thực nằm trong cửa sổ Bảng D.1;
- trung bình số học các điểm đó;
- áp dụng giới hạn `N <= 100` cho **N trung bình tại mũi**;
- nếu không có điểm đo trong cửa sổ: BLOCK;
- không nội suy/extrapolate từ điểm nằm ngoài cửa sổ để tạo N giả.

### 3.2 Ns/Nc dọc thân

Theo từng lớp địa chất thực tế:

1. Nếu hồ sơ địa chất đã cung cấp `sptN` đại diện cho lớp: dùng trực tiếp và lưu provenance `REPORT-LAYER-REPRESENTATIVE`.
2. Nếu lớp không có N đại diện: lấy trung bình số học các điểm SPT đo thực nằm trong chính lớp đó, provenance `DERIVED-MEASURED-LAYER-MEAN`.
3. Không lấy điểm từ lớp kế bên để bù cho lớp thiếu dữ liệu.
4. Không nội suy `N(z)` liên tục.
5. Nếu lớp đất rời không có N đại diện/điểm đo, hoặc lớp đất dính không có `cu`, N đại diện hay điểm đo để suy `cu`: BLOCK.

### 3.3 Boundary địa tầng

Khoảng dữ liệu lớp được chuẩn hóa **half-open `[top,bottom)`**. Điểm SPT đúng ranh giới hai lớp thuộc **lớp sâu hơn**. Quy tắc này đồng bộ với `BoreholeEngine` và tránh một điểm SPT bị tính vào cả hai lớp.

### 3.4 Giới hạn N=100

Giới hạn 100 trong Bảng D.1 được áp dụng cho **N trung bình tại mũi** theo câu chữ nguồn. HNL không cưỡng ép `Ns/Nc` dọc thân về 100 ở lớp dữ liệu; sức kháng `fs/fc` vẫn bị giới hạn bởi cap riêng của Bảng D.1.

### 3.5 D.5/D.6 nhiều lớp

Đối với hồ sơ nhiều lớp, HNL áp dụng D.5/D.6 theo từng đoạn địa chất đồng nhất rồi cộng:

`Ru,fs = u · Σ(fs,j · Ls,j)`

`Ru,fc = u · Σ(fc,k · Lc,k)`

Đây là **phân hoạch deterministic của D.5/D.6** để xử lý nhiều lớp; HNL không trình bày nó như một công thức mới được TCVN đánh số. Với một lớp duy nhất, biểu thức thu về đúng D.5 hoặc D.6.

## 4. Quyết định đối với DCE

Behavioral Golden đã xác định:

- `_xll.NoiSuySPT`: DCE nội suy tuyến tính 1D giữa các điểm SPT;
- `_xll.qb_SPT2025`: hệ số đơn vị tại các điểm diagnostic phù hợp primitive Bảng D.1 của HNL;
- `_xll.flu_SPT2025`: hệ số `f` đơn vị phù hợp primitive Bảng D.1;
- cumulative shaft của DCE sử dụng N nội suy tại đầu phải phân đoạn và cộng theo right-end rectangle.

Sau PDF Decision, các hành vi trên được giữ với trạng thái:

`REFERENCE-ONLY`

DCE không được dùng làm nguồn normative và không được phép thay policy Production của HNL.

## 5. Sai lệch DCE ↔ HNL sau khi khóa boundary đúng

Cùng scenario thật của workbook DCE:

| Intermediate | DCE | HNL sau PDF Decision | Δ HNL-DCE |
|---|---:|---:|---:|
| Qb | 4712.388980 kN | 4712.388980 kN | 0 |
| Qs / Ru,f | 6975.297018 kN | 6574.222451 kN | -401.074568 kN |
| Rk / Ru | 11687.685999 kN | 11286.611431 kN | -401.074568 kN |

Classification:

`DIFFERENT_BY_NORMATIVE_POLICY_DECISION`

Sai lệch lớn hơn vòng Behavioral Golden trước vì vòng trước `measuredNForLayer()` dùng cả `top <= z <= bottom`, khiến điểm SPT đúng ranh giới có thể xuất hiện ở **hai lớp liền kề**. Pass này sửa thành `[top,bottom)`, nên loại bỏ double-counting. Đây là bug dữ liệu/boundary của HNL cũ, không phải lý do để đổi sang thuật toán DCE.

## 6. Source changes

- `src/pile-workflows.js`
  - thêm policy Ns/Nc theo lớp;
  - provenance `REPORT-LAYER-REPRESENTATIVE` / `DERIVED-MEASURED-LAYER-MEAN`;
  - `[top,bottom)`;
  - bỏ cap 100 ở N dọc thân;
  - thêm `sptDataPolicy` trong result.
- `src/p0-pass3-excel-model.js`
  - đồng bộ formula-model độc lập với cùng policy.
- `src/excel-export.js`
  - SPT Formula-Only workbook dùng `>= top` và `< bottom`;
  - bỏ `MIN(AVERAGEIFS(...),100)` ở shaft;
  - trace/provenance hiển thị PDF Decision rõ ràng.
- `src/production-status-registry.js`
  - `10304-spt-raw` tiếp tục LOCKED nhưng source metadata nêu rõ PDF Decision;
  - `xll-NoiSuySPT` tiếp tục REFERENCE/non-production.
- `scripts/spt-pdf-decision-golden.mjs`
  - Golden riêng cho policy.
- `tests/v1.25.7-spt-pdf-decision.test.mjs`
  - boundary, missing data, no interpolation, tip cap, shaft cap, provenance, Engine↔Excel-model.
- `.github/workflows/rc-final.yml`
  - chạy `golden:spt-decision` trên Linux và Windows.

## 7. Golden / Regression

Kết quả trên worktree sau PDF Decision:

- Focused SPT PDF Decision + DCE tests: **18/18 PASS**.
- Full regression: **361/361 PASS**.
- Full Table Golden: **1242/1242 PASS**.
- P0 Workflow Golden: **3/3 workflow, 35/35 metrics, 5/5 XLSM benchmark, 5/5 boundary PASS**.
- P1 Material Golden: **7/7 capacity cases, 42/42 Engine↔Excel metrics, 5/5 boundary PASS**.
- DCE UDF Behavioral Golden: **213/213 acceptable, 0 FAIL**.
- SPT PDF Decision Golden: **26/26 PASS**.
- Version Gate: PASS v1.25.7.
- Search Brain: PASS `f9b65e5e6fb61dcca233a4fe43950e3174c73536f2fa83452da3041fbd0021d2`.

## 8. Gate còn phụ thuộc môi trường

Không thay đổi trạng thái hạ tầng local:

- `npm ci`: BLOCKED vì source ZIP không có `package-lock.json`.
- `excel:smoke`: BLOCKED local vì chưa cài `exceljs`.
- `build:web`: BLOCKED local vì chưa cài `vite`.
- Windows `dist:win` và Microsoft Excel COM: chưa chạy trong Linux sandbox.

Các gate này đã được giữ trong GitHub RC workflow; khi source được chép đè vào repo, phải giữ `package-lock.json` hiện có của repo.

## 9. Kết luận

**SPT PDF Decision Pass = LOCKED.**

Production HNL không nội suy SPT liên tục dọc thân chỉ để khớp DCE. HNL dùng dữ liệu đo/đại diện theo lớp có provenance, boundary sâu hơn, safety gate khi thiếu dữ liệu, và Formula-Only Excel dùng cùng policy. DCE vẫn được giữ làm behavioral regression reference để cảnh báo nếu tương lai vô tình thay đổi policy.
