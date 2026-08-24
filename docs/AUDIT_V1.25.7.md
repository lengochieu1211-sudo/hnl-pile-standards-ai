# HNL Pile Standards AI v1.25.7 — Audit

## Lỗi đã sửa
- Parser TCVN 7888 trước đây bỏ sót `sigma_cu = 80 MPa` sau bước chuẩn hóa vì regex chỉ nhận `sigma cu`; nay dùng Engineering Number Extractor với các alias `sigma_cu`, `sigmacu`, `σcu`, `σ_{cu}` và câu chữ “cường độ nén bê tông”.
- Math Renderer bổ sung phục hồi có kiểm soát khi provider làm mất backslash và để lại `frac/sigma/left/right/times/approx`.
- Panel Trợ lý/Tính không còn tạo horizontal overflow ở vùng hẹp.
- Địa chất nhiều lớp chuyển từ bảng 7 cột sang card responsive 2 cột, rồi 1 cột khi panel rất hẹp.
- Bảng chi tiết ma sát từng lớp chuyển thành card ở panel hẹp; nút hành động tự xuống dòng.

## Regression thực chạy
- `npm test`: 290/290 PASS.
- `npm run golden:tables`: 1.130/1.130 PASS.
- Version Gate: PASS v1.25.7.
- Search Brain: SHA256 normalized `f9b65e5e6fb61dcca233a4fe43950e3174c73536f2fa83452da3041fbd0021d2`, không thay đổi.

## Golden mới
- `Cọc PHC D600-B, L=20 m; sigma_cu = 80 MPa` → nhận `sigmaCu=80`, không hỏi lại σcu.
- `\sigma_{cu}=80\,\text{MPa}` → nhận `sigmaCu=80`.
- “cường độ nén bê tông = 80 MPa” → nhận `sigmaCu=80`.
- Panel assistant ≤520 px → soil card responsive, không overflow ngang.

## Chưa khẳng định
- Chưa chạy build Web/Windows trong sandbox ở pass này; GitHub Actions cần xác nhận `npm ci → test → Golden → build` sau khi upload.
