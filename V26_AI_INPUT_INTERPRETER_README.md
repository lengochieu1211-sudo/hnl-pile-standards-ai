# HNL V26 — AI Input Interpreter + Formula Guard + SPT Golden Regression

## Mục tiêu

V26 sửa regression thực tế ở nhánh Hỏi đáp → Tính: chuỗi nguồn `qb = 300ηN̄` từng bị parser đọc sai thành `qb=300`, và `fs = 2Ns` bị đọc sai thành `fs=2`. Với đề cọc 400×400, L=10 m, N̄=20, Ns=20, lỗi này dẫn tới Rk=80 kN.

V26 áp dụng kiến trúc bắt buộc:

`Đề bài tự nhiên → AI Input Interpreter (nếu AI đang kết nối) → Formula Guard + deterministic validation → Calculation Engine → Excel Formula-Only`

AI chỉ trích input/ngữ nghĩa. AI không được trả kết quả kỹ thuật làm nguồn tính.

## Kết quả Golden bắt buộc

Đề regression nguyên văn phải cho:

- qb = 6000 kPa
- fs = 40 kPa
- Ru,b = 960 kN
- Ru,f = 640 kN
- Rc,k / Rk = 1600 kN
- Rd = 1066.6666666667 kN với γk=1.50
- Nd,max = 927.5362318841 kN/cọc với γn=1.15

Không được quay lại Rk=80 kN.

## Các thay đổi

- `src/engineering-input-interpreter.js`: AI extraction contract, source-backed scalar merge, Formula Guard.
- `src/engineering-router.js`: SPT natural-language summary route; AI hints chỉ được dùng để điền input thiếu có sourceText; manual qb/fs dùng scalar guard.
- `src/pile-workflows.js`: `calculateSptSummary10304` gọi các lookup Bảng D.1 đã khóa; không copy hệ số vào AI/router.
- `src/production-status-registry.js`: đăng ký nhánh `10304-spt-summary-explicit` ở mức VERIFIED.
- `src/main.js`: SPT numeric question dùng một structured AI extraction call khi provider AI đang hoạt động; fallback deterministic khi AI không dùng được; UI hiển thị qb/fs/Rmũi/Rthân/Rk/Rd/Nd,max.
- `src/excel-export.js`: workbook SPT summary tiếng Việt có input sửa được + công thức Excel thật + sheet `04_BANG_D1`.
- `tools/v26-spt-golden.mjs`: Golden 13 kiểm tra, dùng nguyên văn đề regression.
- `tools/v26-spt-excel-golden.mjs`: runtime Golden workbook; chạy trên GitHub sau `npm ci`.
- `.github/workflows/v26-spt-input-cert.yml`: Linux + Windows certification.

## Gate đã chạy trong môi trường tạo patch

- V26 SPT Golden: 13/13 PASS
- Existing Node regression: 574/574 PASS, 0 FAIL
- Full Table Golden: 1242/1242 PASS
- SPT PDF Decision: 26/26 PASS
- Search Brain normalized SHA-256: `f9b65e5e6fb61dcca233a4fe43950e3174c73536f2fa83452da3041fbd0021d2` PASS

Chưa tự nhận PASS trong môi trường tạo patch:

- ExcelJS runtime workbook (môi trường hiện tại không có package đã cài)
- Vite production build
- Windows runtime

Ba phần này được khóa bằng GitHub Actions V26; chỉ merge sau khi workflow xanh.

## Cách đưa V26 lên GitHub

1. GitHub Desktop → chuyển `main` → Fetch/Pull để lấy commit merge Pass 8.3 mới nhất.
2. Tạo branch mới: `p1/v26-ai-input-interpreter`.
3. Giải nén ZIP V26 và chép đè toàn bộ cấu trúc vào repo.
4. Xác nhận `src/search.js` KHÔNG có thay đổi.
5. Commit: `fix: V26 AI input interpreter formula guard SPT golden`.
6. Push origin.
7. Vào Actions → `V26 SPT AI Input Certification`.
8. Chỉ tạo PR vào `main` khi Linux và Windows đều xanh.
9. Sau merge, chờ GitHub Pages deploy xanh rồi Ctrl+F5.

## GitHub V26 phải xanh

Linux:
- V26 SPT Formula Guard + AI Input Golden
- V26 Vietnamese Formula-Only Excel Golden
- exact 574 regression
- Full Table Golden 1242
- SPT PDF Decision Golden
- Vite production web build

Windows:
- V26 SPT Golden
- exact 574 regression

## Phạm vi AI

AI có thể nhận diện `L`, `η`, `N̄`, `Ns`, `γk`, `γn`, loại cọc, đất cát/đất dính, mũi kín/hở, phạm vi Ns. Mọi scalar AI phải có `sourceText` tồn tại trong đề. Giá trị đọc trực tiếp bằng deterministic parser luôn ưu tiên hơn AI.

Các output `qb`, `fs`, `Rb`, `Rs`, `Rk`, `Rd`, `Nd,max` không được AI sở hữu. Chúng phải do Calculation Engine/Excel formula tính lại.
