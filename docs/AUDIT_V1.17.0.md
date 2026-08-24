# HNL Pile Standards AI v1.17.0 — TCVN 10304 Full End-to-End Audit

Ngày audit: 2026-08-24

## 1. Phạm vi và nguồn

- Source nền duy nhất cho pass này: HNL Pile Standards AI v1.16.0.
- Nguồn tiêu chuẩn để đối chiếu: PDF TCVN 10304:2025 do người dùng tải lên.
- Không thay logic `src/search.js`; Search Brain v1.9.23 vẫn được khóa bằng normalized SHA-256.
- Audit tập trung toàn bộ registry tính toán TCVN 10304 hiện có trong ứng dụng: cọc chống, cọc đóng/ép, cọc nhồi/khoan, cọc vít, tải tĩnh, thử động, CPT, SPT, lún cọc đơn, lún nhóm, móng khối quy ước, bè-cọc và ảnh hưởng thi công.

## 2. Lỗi thực tế tìm thấy và root cause

### 2.1 Parser địa chất nhiều lớp có thể làm mất IL

**Lỗi:** câu nhập nhiều lớp phân cách bằng dấu `;` có thể nhận được khoảng sâu nhưng bỏ mất `IL` ở một số lớp.

**Root cause:** regex cũ dùng optional group trong cùng biểu thức lớn; regex engine có thể backtrack và bỏ nhóm `IL` dù chuỗi có chứa giá trị.

**Sửa:** `parsePileLayers()` lấy toàn bộ phần mô tả của từng lớp trước, sau đó parse riêng loại đất và `IL`. Thêm regression test với nhiều lớp phân cách bằng dấu chấm phẩy.

### 2.2 Biến kỹ thuật ngắn bị bắt nhầm trong tên biến khác

**Lỗi:** `A` có thể bị bắt từ `sa`; `M` có thể bị bắt từ `m2`; biến ngắn khác cũng có nguy cơ collision. Điều này đã làm benchmark thử động và một số input hình học bị sai số dù công thức đúng.

**Root cause:** helper `pick()`/`explicit()` không khóa ranh giới token đủ chặt.

**Sửa:** thêm boundary trước/sau tên biến; chỉ nhận biến khi đứng độc lập trước `=`, `:` hoặc khoảng trắng hợp lệ.

### 2.3 Lún nhóm khai báo CT (36)–(40) nhưng engine chưa trả CT (39), (40)

**Lỗi:** metadata nói workflow bao phủ CT (36)–(40), nhưng engine trước chỉ tính phần lún/tương tác CT (36)–(38).

**Sửa:** bổ sung:
- CT (39): chiều dài tương đương `L_eq = sqrt((Li² + Lj²)/2)` khi cung cấp `Li`, `Lj`.
- CT (40): cập nhật độ cứng nhóm `k_w` khi có `k_w0`, `N_u`, `m`.
- Sửa title CT (39) trong Code Pack cho đúng ý nghĩa.

### 2.4 Excel lún cọc đơn dùng sai loại nội suy Bảng 17

**Lỗi:** workbook cũ dùng `FORECAST.LINEAR` để suy ra `ζ0` và `m_v`. Hàm này thực hiện hồi quy tuyến tính trên toàn bộ bảng, không phải nội suy tuyến tính từng khoảng.

**Sửa:** workbook v1.17.0 dùng `MATCH + INDEX` và nội suy giữa hai hàng kề nhau của Bảng 17. Giá trị ngoài biên bị khóa về đầu/cuối bảng như engine hiện tại.

### 2.5 Excel lún cọc đơn chưa hoàn chỉnh hai nhánh

**Lỗi:** exporter thiên về nhánh `k >= 7,5`, trong khi workflow phải tự chọn CT (30) hoặc CT (34).

**Sửa:** exporter có cả nhánh dài và ngắn; Bảng 17 đi kèm; công thức cuối tự chọn theo `k`.

## 3. Audit đơn vị và điều kiện áp dụng

| Workflow | Đơn vị chính | Kiểm tra điều kiện / safety gate | Trạng thái |
|---|---|---|---|
| Cọc chống | `q_b[kPa] × A[m²] = kN` | CT (5)–(8); nhánh đá/đá phong hóa theo input phù hợp | VERIFIED |
| Cọc đóng/ép | `q_b A`, `u f_i h_i` → kN | Tách từng lớp; lớp mũi; Bảng 2/3/4; thiếu IL thì dừng | VERIFIED |
| Cọc nhồi/khoan | kPa·m² và kPa·m² → kN | CT (13)–(16), Bảng 6–8; hệ số phương pháp phải có căn cứ | VERIFIED |
| Cọc vít | kPa·m², kPa·m² → kN | CT (17)–(19), Bảng 9–10 | VERIFIED |
| Tải tĩnh | kN | CT (20)–(21); cần `Ru,k` từ đường cong/thí nghiệm | VERIFIED |
| Thử động | kN, kJ=kN·m, m | Tự tách `s_a >= 0,002 m` / `<0,002 m`; cọc ngoài phạm vi bị gate | VERIFIED |
| CPT | `R_s A + f h u` → kN | β1/β2 theo Bảng 15; dữ liệu xuyên phải được nhập đúng | VERIFIED |
| SPT | kPa·m² + kPa·m² → kN | Phụ lục D; thiếu qb/A/u/chiều dài đất thì dừng | VERIFIED |
| Lún cọc đơn | MN, MPa, m → m | Bắt buộc `L/d>5` và `G1L/(G2d)>1`; tự chọn nhánh k | VERIFIED |
| Lún nhóm | MN, MPa, m → m | CT36–40; cần tương tác δij hoặc dữ liệu tương đương | VERIFIED |
| Khối quy ước | kPa/MPa/kN/m → m | `s_ef` đến từ bài toán nền TCVN 9362; HNL không bịa ngoài chuẩn | VERIFIED |
| Bè-cọc | mô hình tương tác | Tiêu chuẩn yêu cầu mô hình tương tác/số; không có công thức đóng duy nhất | VERIFIED_METHOD |
| Ảnh hưởng thi công | cm, Hz → cm/s; kN | CT47 kiểm `V≤Va`; CT48 chỉ tự γc=1,2 khi tốc độ ≤3 m/min | VERIFIED |

## 4. Benchmark HNL ↔ Excel

Benchmark dùng cùng một bộ input deterministic cho engine HNL và workbook Excel formula thật.

| Workflow | HNL | Excel | Sai lệch | Kết quả |
|---|---:|---:|---:|---|
| Cọc chống | 800 kN | 800 kN | 0 | PASS |
| Cọc đóng/ép | 1264 kN | 1264 kN | 0 | PASS |
| Cọc nhồi/khoan | 3187.1 kN | 3187.1 kN | 0 | PASS |
| Cọc vít | 1566.72 kN | 1566.72 kN | 0 | PASS |
| Tải tĩnh | 1090.9090909 kN | 1090.9090909 kN | 0 | PASS |
| Thử động | 1449.2036197 kN | 1449.2036197 kN | 0 | PASS |
| CPT | 880 kN | 880 kN | 0 | PASS |
| SPT | 496 kN | 496 kN | 0 | PASS |
| Lún cọc đơn | 0.00259030598 m | 0.00259030598 m | 0 | PASS |
| Lún nhóm | 0.01099757689 m | 0.01099757689 m | 0 | PASS |
| Khối quy ước | 0.02224648206 m | 0.02224648206 m | 0 | PASS |
| Ảnh hưởng thi công CT47 | 1.256637061 cm/s | 1.256637061 cm/s | 0 | PASS |
| Bè-cọc | VERIFIED_METHOD | N/A | N/A | PASS-METHOD |

**Kết quả benchmark:** 12/12 workflow numeric PASS; 1/1 workflow phương pháp PASS-METHOD.

Workbook benchmark độc lập: `HNL-TCVN10304-Full-Benchmark-v1.17.0.xlsx`.

## 5. Excel production v1.17.0

- Đồng bộ title workbook lên v1.17.0.
- Sửa nội suy Bảng 17 thành piecewise linear đúng logic engine.
- Bổ sung CT (39), CT (40) vào sheet lún nhóm.
- Giữ sheet ảnh hưởng thi công CT (47)–(48) + Bảng 18.
- Thêm sheet `09_AUDIT_BENCH` tóm tắt benchmark HNL ↔ Excel.
- Formula error scan bằng artifact_tool: **0** lỗi `#REF!`, `#DIV/0!`, `#VALUE!`, `#NAME?`, `#N/A`.

## 6. Regression / source test

Lệnh: `npm test`

- Version Gate: PASS — v1.17.0 đồng bộ.
- Search Brain Gate: PASS.
- Normalized SHA-256: `f9b65e5e6fb61dcca233a4fe43950e3174c73536f2fa83452da3041fbd0021d2`.
- Node test: **186/186 PASS, 0 FAIL**.

## 7. Build Web

Lệnh: `npm run build:web`

**FAIL môi trường build hiện tại:** `vite: not found`.

Không báo build PASS giả. Source test và calculation benchmark PASS nhưng bundle Web/Windows vẫn cần môi trường dependency đầy đủ/GitHub Actions để xác nhận artifact cuối.

## 8. Kết luận TCVN 10304

Trong **registry tính toán TCVN 10304 hiện có của HNL**, toàn bộ workflow numeric đã được audit lại end-to-end và có benchmark HNL ↔ Excel PASS. `Bè-cọc` được giữ là `VERIFIED_METHOD` đúng bản chất vì cần mô hình tương tác/số, không bị nâng giả thành numeric VERIFIED.

Điều này chưa có nghĩa mọi Điều 4–13 của TCVN 10304 đều trở thành calculator độc lập; nó có nghĩa toàn bộ **workflow calculation registry** hiện được HNL công bố cho người dùng đã được kiểm đơn vị, điều kiện áp dụng, safety gate và Excel cross-check. Đây là mốc phù hợp để chuyển sang audit sâu TCVN 5574:2018.
