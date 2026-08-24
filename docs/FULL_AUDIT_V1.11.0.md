# HNL Pile Standards AI v1.11.0 — Deep 3-TCVN Code Packs / Excel Audit

Ngày audit: 2026-08-24

## Kết luận

Source v1.10.2 đã được nâng thành **v1.11.0** với 3 Code Pack sâu cho TCVN 7888:2014, TCVN 10304:2025 và TCVN 5574:2018. Mục tiêu là tách rõ:

1. **Chỉ mục sâu để hỏi đáp/định vị** — công thức, Điều/Phụ lục, bảng và trang;
2. **Dữ liệu Verified để tính** — chỉ mục đã đối chiếu rõ mới được dùng calculator/Excel;
3. **Indexed/Review** — vẫn giúp AI tìm đúng trang và diễn giải, nhưng không được chạy số học tự động.

Lõi `src/search.js` giữ nguyên byte-for-byte v1.9.23.

## 1. Phạm vi Code Pack

### TCVN 7888:2014

- 9 nhóm Điều/Phụ lục;
- 18 công thức được lập chỉ mục: (1)–(7), A.1–A.6, B.1–B.5;
- B.1–B.5: Verified + computable;
- 6 bảng được lập chỉ mục;
- Bảng 1 PC/PHC và Bảng 2 NPH có dữ liệu tra cấu trúc;
- NPH chỉ A/B/C, không có AB;
- đơn vị sức chịu tải Phụ lục B đổi đúng `MPa × mm² = N` sang kN bằng hệ số 0.001.

### TCVN 10304:2025

- 50 nhóm Điều/Phụ lục;
- 48 công thức chính (1)–(48) được lập chỉ mục trang;
- 18 bảng được lập chỉ mục;
- 5 công thức đầu nhóm sức chịu tải đã đối chiếu rõ và được phép tính tự động: (5)–(9);
- các công thức còn lại ở trạng thái Indexed/Review: dùng hỏi đáp/định vị, không chạy số học;
- 7 bảng tra có dữ liệu Verified cấu trúc chọn lọc: Bảng 1, 5, 9, 10, 14, 17, 18;
- PDF scan vẫn dùng Code Pack để định vị trước rồi đọc trang gốc bằng OCR/Vision/RAG theo phạm vi.

### TCVN 5574:2018

- 30 nhóm tính toán/Phụ lục;
- 332 công thức đánh số được lập chỉ mục từ toàn tiêu chuẩn;
- 19 bảng chính được lập chỉ mục;
- các biểu thức công thức lấy từ text extraction chưa đủ an toàn nên **không tự Verified**;
- 4 bảng vật liệu có dữ liệu Verified cấu trúc:
  - Bảng 7: Rb/Rbt của bê tông;
  - Bảng 10: Eb;
  - Bảng 13: Rs/Rsc;
  - Bảng 14: Rsw.
- lookup benchmark:
  - B30: Rb=17 MPa, Rbt=1.15 MPa, Eb=32500 MPa;
  - CB400-V: Rs=350 MPa, Rsc=350 MPa, Rsw=280 MPa.

## 2. Q&A / RAG

`codePackSearch()` được chạy trước RAG thường để đưa các trang có Điều/Bảng/Công thức phù hợp vào candidate evidence. Code Pack không thay search brain.

Regression:

- `cọc chống là gì` → TCVN 10304:2025 trang PDF 28;
- `chọc thủng` → TCVN 5574:2018 mục 8.1.6, trang PDF 82;
- `CB400-V Bảng 13` → bảng vật liệu đúng trang PDF 45;
- `ứng suất hữu hiệu Phụ lục A` → TCVN 7888 trang 30–31.

## 3. Excel export

Thêm dependency exact pin `exceljs=4.4.0` và hai luồng:

### Xuất một công thức

Workbook gồm:

- HƯỚNG DẪN;
- TÍNH TOÁN;
- THUYẾT MINH;
- BẢNG TRA / các sheet bảng tra Verified liên quan.

Chỉ `verified && computable` mới sinh Excel formula thực thi. Mục Indexed/Review chỉ xuất biểu thức/tham chiếu và ghi `CHƯA VERIFIED`.

### Xuất toàn Code Pack

Nút `Xuất Excel Code Pack` tạo:

- HƯỚNG DẪN;
- CÔNG THỨC;
- MỤC LỤC BẢNG;
- ĐIỀU-PHỤ LỤC;
- các sheet bảng tra Verified cấu trúc.

## 4. Test / kiểm tra kỹ thuật

- `npm test`: **145/145 PASS, 0 FAIL**;
- `npm run check:version`: **PASS**;
- JS/MJS/CJS syntax: **17/17 PASS**;
- JSON parse: **2/2 PASS**;
- GitHub Actions YAML: **2/2 PASS**;
- secret-like API key scan: **0 hit**;
- Search brain SHA-256: `f9b65e5e6fb61dcca233a4fe43950e3174c73536f2fa83452da3041fbd0021d2` — giữ nguyên;
- Version runtime/build/artifact: **1.11.0**.

## 5. Build runtime chưa xác nhận

`npm run build:web` hiện trả `vite: not found` vì source ZIP không chứa `node_modules` và môi trường audit chưa cài dependency. Đây không phải lỗi syntax/source được chứng minh; build Web/EXE cần chạy `npm install` (hoặc `npm ci` khi có package-lock) trên GitHub Actions/máy build.

ExcelJS cũng sẽ được cài từ package dependency khi runner thực hiện npm install.

## 6. Giới hạn cố ý

- Không nhúng nguyên văn 3 PDF vào Code Pack/ZIP phát hành;
- Code Pack lưu cấu trúc, công thức/bảng đã xác minh và metadata nguồn;
- hỏi đáp chi tiết nguyên văn vẫn nên dùng PDF người dùng đã lưu trong thư viện cục bộ;
- không đánh dấu hàng trăm công thức TCVN 5574 là Verified chỉ vì parser tìm thấy số công thức;
- không tự suy đoán bảng đất TCVN 10304 chưa được số hóa/benchmark đầy đủ.

## 7. File mới/chính được sửa

- `src/codepacks.js`
- `src/codepack-tables.js` (mới)
- `src/excel-export.js` (mới/hoàn thiện)
- `src/main.js`
- `tests/core.test.mjs`
- `tests/wiring.test.mjs`
- `package.json`
- `README.md`
- `public/changelog.json`
- `docs/BUILD_METADATA.md`
- `docs/RELEASE_V1.11.0.md`
- `docs/FULL_AUDIT_V1.11.0.md`


## 8. Đối chiếu bổ sung TCVN 5574:2018 trước khi đóng gói

Đã kiểm tra lại trực tiếp các bảng vật liệu thay vì kế thừa dữ liệu từ template Excel cũ:

- Bảng 7: bê tông nặng B30 có `Rb = 17.0 MPa`, `Rbt = 1.15 MPa`.
- Bảng 10: bê tông nặng B30 có `Eb = 32.5 × 10^3 MPa = 32500 MPa`.
- Bảng 13: CB400-V có `Rs = 350 MPa`, `Rsc = 350 MPa`.
- Bảng 14: CB400-V có `Rsw = 280 MPa` (lấy trực tiếp giá trị bảng đã làm tròn).

Template HNL Rebar cũ từng có `Rbt = 1.05 MPa` cho B30; giá trị này **không được kế thừa** vào Code Pack v1.11.0. Code Pack dùng 1.15 MPa theo Bảng 7 của PDF người dùng tải lên.

File Excel mẫu đã được đưa vào `docs/examples/HNL-CodePack-3-TCVN-v1.11.0-Sample.xlsx`.
