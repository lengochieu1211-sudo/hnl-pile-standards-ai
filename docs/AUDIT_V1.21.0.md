# HNL Pile Standards AI v1.21.0 — TCVN 5574 Detailing & Annexes Audit

Ngày audit: 2026-08-24

## 1. Mục tiêu pass

Pass v1.21.0 tiếp tục đúng thứ tự đã khóa sau SLS sâu:

1. Neo / nối cốt thép;
2. Cột tiết diện vành khuyên / tròn;
3. Công xôn ngắn;
4. Các Phụ lục liên quan.

Nguyên tắc giữ nguyên: một workflow numeric chỉ được chuyển sang **VERIFIED** sau khi có đủ (a) đối chiếu PDF gốc, (b) điều kiện áp dụng/safety gate, (c) Calculation Engine deterministic, và (d) benchmark Calculation Engine ↔ Excel công thức độc lập đạt tolerance. Các mục chưa đủ điều kiện vẫn giữ REVIEW/INDEXED, không tự sinh số.

Nguồn tiêu chuẩn: `10.TCVN 5574-2018_THIET KE BE TONG VA BE TONG COT THEP.pdf` do người dùng cung cấp.

Search Brain `src/search.js` không thay đổi; normalized SHA-256 vẫn là:

`f9b65e5e6fb61dcca233a4fe43950e3174c73536f2fa83452da3041fbd0021d2`

---

## 2. Neo cốt thép — 10.3.5, CT (255)–(258)

### 2.1 Công thức đã máy hóa

- CT (255):
  `L0,an = Rs As / (Rbond us)`
- CT (256):
  `Rbond = η1 η2 Rbt`
- CT (257):
  `Lan = α L0,an As,cal / As,ef`
- Chiều dài tối thiểu cho cốt thép không ứng suất trước:
  `Lan >= max(15 ds, 200 mm, 0.3 L0,an)`
- CT (258), khi người dùng cung cấp chiều dài neo thực tế `Ls`:
  `Ns = min(Rs As, Rs As Ls / Lan)`

### 2.2 Hệ số bám dính đã số hóa

`η1` theo loại bề mặt/cốt thép:
- thanh trơn: 1.5;
- kéo/cán nguội có gân: 2.0;
- cán nóng hoặc cơ nhiệt có gân: 2.5;
- dây ứng suất trước kéo/cán nguội có gân: 1.8;
- cáp 7 sợi trơn và cáp 19 sợi: 2.2;
- cáp 7 sợi từ dây có gân: 2.4;
- thép ứng suất trước cán nóng/cơ nhiệt: 2.5.

`η2`:
- cốt không ứng suất trước: 1.0 với `ds <= 32 mm`; 0.9 với đường kính lớn hơn theo phạm vi Điều 10.3.5;
- cốt ứng suất trước: 1.0.

### 2.3 Safety gate

- Engine **không tự bịa hệ số α neo**. Nếu bài toán chưa cung cấp hoặc chưa xác định được α theo cấu tạo/trạng thái vùng neo thì workflow dừng và yêu cầu bổ sung.
- Phân biệt rõ `As,cal` và `As,ef`.
- Neo thẳng/L chỉ dùng trong phạm vi cho phép của Điều 10.3.5; thanh trơn chịu kéo cần cấu tạo neo phù hợp.

### 2.4 Benchmark

Mẫu B30 + CB400-V, `ds=20 mm`, `As=πd²/4`, thanh gân cán nóng, `α=1`:
- `Rbond = 2.875 MPa`;
- `L0,an = Lan = 608.695652173913 mm`;
- Calculation Engine = Excel;
- sai lệch = 0;
- **PASS**.

Trạng thái: **VERIFIED**.

---

## 3. Nối chồng cốt thép — 10.3.6, CT (259)

### 3.1 Công thức

`Llap = α L0,an As,cal / As,ef`

Trong route thông thường đã mã hóa:
- nối trong vùng kéo: `α = 1.2`;
- nối trong vùng nén: `α = 0.9`.

### 3.2 Safety gate

- Nối chồng chỉ được tự tính khi `ds <= 40 mm` theo phạm vi Điều 10.3.6.
- Trường hợp bố trí tỷ lệ thanh nối, khoảng cách thanh, cấu tạo đặc biệt hoặc mối nối cơ khí/hàn phải đi đúng nhánh cấu tạo tương ứng; không lấy một chiều dài nối chồng duy nhất để thay thế mọi yêu cầu cấu tạo.

### 3.3 Benchmark

Cùng mẫu neo ở trên, nối kéo:
- `Llap = 730.4347826086956 mm`;
- HNL = Excel;
- sai lệch = 0;
- **PASS**.

Trạng thái: **VERIFIED**.

---

## 4. Phụ lục F — cột tiết diện vành khuyên và tròn

### 4.1 Vành khuyên F.1–F.6

Phạm vi được gate:
- `r1/r2 > 0.5`;
- cốt dọc phân bố đều quanh chu vi;
- tối thiểu 7 thanh dọc;
- `M` đầu vào phải là mô men đã kể ảnh hưởng uốn dọc cấu kiện.

Các nhánh đã máy hóa:
- F.1 xác định `ξcir`;
- `0.15 < ξcir < 0.6` → F.2;
- `ξcir <= 0.15` → F.3 với `ξcir1` theo F.4;
- `ξcir >= 0.6` → F.5 với `ξcir2` theo F.6.

Benchmark mẫu B30 / CB400-V, `r1=200`, `r2=350`, `rs=300 mm`, `As,tot=3000 mm²`, `N=2000 kN`, `M=300 kN.m`, 8 thanh:
- `ξcir = 0.42120767108478063`;
- tự chọn nhánh F.2;
- `Mu = 538.0081855371169 kN.m`;
- HNL = Excel;
- sai lệch = 0;
- **PASS**.

### 4.2 Tiết diện tròn F.7–F.10

Phạm vi được gate:
- cốt dọc phân bố đều;
- tối thiểu 7 thanh;
- cốt thép từ CB400-V trở xuống;
- `M` phải kể ảnh hưởng uốn dọc.

Đã máy hóa:
- F.7 sức kháng mô men;
- F.8 phân nhánh lực dọc;
- F.9 / F.10 là phương trình ẩn theo `ξcir`, được giải bằng fixed-point deterministic;
- `φ = min[1; 1.6(1 - 1.55ξcir)ξcir]` khi F.8 thỏa, ngược lại `φ=0`.

Lưu ý audit công thức F.10: bản PDF TCVN có lỗi hiển thị/toán tử bị rơi trong dòng công thức. Pass này đã kiểm bằng ảnh PDF độ phân giải cao và đối chiếu công thức gốc tương ứng của SP 63.13330.2012; tử số nhánh F.10 dùng dấu **cộng**:
`N + Rs As,tot + Rb A sin(2πξcir)/(2π)`.
Không suy đoán theo text extraction lỗi.

Benchmark nhánh F.8 thỏa, mẫu B30 / CB400-V, `r=300`, `rs=250 mm`, `As,tot=3000 mm²`, `N=2000 kN`, `M=300 kN.m`, 8 thanh:
- HNL `ξcir = 0.4108754644924474`;
- Excel `ξcir = 0.4108754644919473`;
- sai lệch `≈ 5.00e-13` ≤ `1e-9` → PASS;
- HNL `Mu = 414.5939702926483 kN.m`;
- Excel `Mu = 414.59397029230144 kN.m`;
- sai lệch `≈ 3.47e-10 kN.m` ≤ `1e-8` → PASS.

Đã có regression thêm cho nhánh F.8 không thỏa và safety gate CB500-V.

Trạng thái Phụ lục F: **VERIFIED**.

---

## 5. Phụ lục G — chốt bê tông, G.1–G.3

Đã máy hóa:
- G.1: `tk >= Q/(Rb Lk nk)`;
- G.2: `hk >= Q/(2 Rbt Lk nk)`;
- G.3 khi đồng thời có lực nén `N`:
  `hk >= (Q - 0.7N)/(2 Rbt Lk nk)`;
- `nk` chỉ nhận từ 1 đến 3;
- mức giảm `hk` theo G.3 không được làm nhỏ hơn một nửa giá trị G.2.

### Lỗi tìm thấy và đã sửa

Một draft ban đầu dùng sai tử số G.3 dạng `(0.7Q - N)`. Đối chiếu trực tiếp PDF cho thấy đúng phải là **`(Q - 0.7N)`**. Source và Excel production v1.21.0 đã sửa đồng bộ.

Benchmark B30, `Q=200 kN`, `Lk=300 mm`, `nk=2`:
- G.1 `tk = 19.607843137254903 mm` — HNL = Excel — PASS.
- Với `N=50 kN`, G.3 `hk = 119.56521739130434 mm` — HNL = Excel — PASS.

Trạng thái: **VERIFIED**.

---

## 6. Phụ lục H — công xôn ngắn, H.1

Phạm vi route numeric hiện hành:
- `L1/h0 <= 0.9`;
- H.1 tính lực cắt giới hạn;
- `sinθ = h0/sqrt(h0² + L1²)`;
- `α = Es/Eb`;
- `μw = Asw/(b sw)`;
- vế phải H.1 được khống chế trong khoảng `2.5 Rbt b h0` đến `3.5 Rbt b h0` theo chỉ dẫn Phụ lục H.

Benchmark B30, `b=300`, `h0=500`, `L1=300`, `Lsup=200 mm`, `Q=200 kN`, `Asw=157 mm²`, `sw=150 mm`:
- `Qu = 603.75 kN`;
- Excel = `603.7499999999999 kN`;
- sai lệch `≈ 1.14e-13 kN` ≤ `1e-8`;
- **PASS**.

Safety gate quan trọng:
- H.1 không thay thế kiểm tra ứng suất nén cục bộ tại vùng truyền lực `<= Rb,loc`;
- yêu cầu cốt ngang/cấu tạo công xôn vẫn phải thỏa phần cấu tạo của tiêu chuẩn;
- vì vậy workflow được công bố là **VERIFIED BRANCH**, không tuyên bố một công thức H.1 đã bao phủ toàn bộ thiết kế công xôn.

---

## 7. Trạng thái các Phụ lục sau v1.21.0

| Phụ lục | Nội dung | Trạng thái | Tự tính số |
|---|---|---|---|
| A | Quan hệ cường độ chịu nén bê tông | INDEXED | Không |
| B | Biểu đồ biến dạng bê tông | INDEXED | Không |
| C | Hướng dẫn một số loại cốt thép | INDEXED | Không |
| D | Chi tiết đặt sẵn | REVIEW | Không |
| E | Tính toán hệ kết cấu | VERIFIED_METHOD | Không |
| F | Cột vành khuyên / tròn | VERIFIED | Có |
| G | Chốt bê tông | VERIFIED | Có |
| H | Công xôn ngắn | VERIFIED BRANCH | Có |
| I | Kết cấu bán lắp ghép | INDEXED | Không |
| K | Cốt thép hạn chế biến dạng ngang | INDEXED | Không |
| L | Hệ số mô men kháng uốn đàn dẻo | INDEXED | Không |
| M | Độ võng và chuyển vị | INDEXED | Không |
| N | Nhóm chế độ làm việc cần trục | INDEXED | Không |

`VERIFIED_METHOD` ở Phụ lục E là chủ ý: tiêu chuẩn yêu cầu sử dụng phần mềm/phương pháp phân tích hệ phù hợp; HNL không giả lập một calculator numeric đơn giản để thay thế mô hình phần tử hữu hạn.

---

## 8. Calculation Engine ↔ Excel production benchmark

Workbook: `HNL-TCVN5574-Production-v1.21.0.xlsx`.

Kết quả cuối: **13/13 benchmark PASS**:

1. Nứt `acrc` — PASS;
2. Độ võng uốn có nứt — PASS;
3. Biến dạng trượt — PASS;
4. Hao tổn ma sát CT214 — PASS;
5. Hao tổn từ biến CT216 — PASS;
6. Neo `Lan` — PASS;
7. Nối `Llap` — PASS;
8. Vành khuyên `Mu` — PASS;
9. Tròn `ξcir` F.9 — PASS;
10. Tròn `Mu` F.7 — PASS;
11. Chốt `tk` G.1 — PASS;
12. Chốt `hk` G.3 — PASS;
13. Công xôn `Qu` H.1 — PASS.

Formula error scan trên workbook production:
- `#REF!`: 0;
- `#DIV/0!`: 0;
- `#VALUE!`: 0;
- `#NAME?`: 0;
- `#N/A`: 0 trong trạng thái input benchmark mặc định.

Workbook mới có các sheet:
- `17_NEO_NOI`;
- `18_TIET_DIEN_TRON`;
- `19_CONG_XON_NGAN`;
- `20_PHU_LUC_G`;
- `21_PHU_LUC_INDEX`;
- `15_BENCHMARK` được nâng lên v1.21.0;
- `00_TONG_QUAN` và `07_NGUON` được cập nhật provenance.

---

## 9. Source regression / hardening

Đã chạy thực tế:

- `node --check src/tcvn5574-core.js`: PASS;
- `node --check src/engineering-router.js`: PASS;
- `node --check src/excel-export.js`: PASS;
- `npm test`: **223/223 PASS; 0 FAIL**;
- Version Gate: PASS v1.21.0;
- Search Brain Gate: PASS;
- Search Brain normalized SHA-256 không đổi;
- quét mẫu API/private key phổ biến: 0 hit.

Router đã nối các workflow mới vào deterministic Calculation Engine trước AI. Gemini/OpenAI/Ollama chỉ được diễn giải kết quả engine; không được tự thay số trong workflow VERIFIED.

---

## 10. Build Web / Windows

Đã chạy:

`npm run build:web`

Kết quả hiện tại: **FAIL môi trường build** với lỗi:

`sh: 1: vite: not found`

Không báo build PASS giả. Source calculation/tests và Excel benchmark đã PASS; bundle Web/Windows vẫn cần chạy `npm ci`/môi trường dependency đầy đủ hoặc GitHub Actions Windows runner để xác nhận artifact cài đặt cuối.

---

## 11. Kết luận v1.21.0

Các nhóm được phép nâng trạng thái sau pass này:

- Neo cốt thép CT255–258 → **VERIFIED**;
- Nối chồng CT259 → **VERIFIED**;
- Phụ lục F vành khuyên/tròn → **VERIFIED**;
- Phụ lục G chốt bê tông → **VERIFIED**;
- Phụ lục H công xôn ngắn → **VERIFIED BRANCH**.

Không nâng giả các Phụ lục còn lại. D vẫn REVIEW; A/B/C/I/K/L/M/N giữ INDEXED; E giữ VERIFIED_METHOD.

Mốc kiểm soát: **13/13 Calculation Engine ↔ Excel PASS + 223/223 source regression PASS**, Search Brain không đổi.
