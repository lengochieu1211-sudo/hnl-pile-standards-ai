# HNL Pile Standards AI v1.25.7 — V26.1 FULL SOURCE

Mục tiêu: chép đè source một lần bằng GitHub Desktop, không dùng nhiều overlay.

## Nội dung đã gộp
- Pass 8.3 source đã merge trước V26.
- V24 browser-safe structural CSV / Vite repair.
- V25 Windows test gate cross-platform.
- V26 AI Input Interpreter + Formula Guard + SPT Golden Regression.
- V26.1 Source Sync Gate Refresh: cập nhật SHA chỉ cho 3 file V26 cố ý thay đổi.
- Search Brain / PDF / AI giữ nguyên SHA khóa.

## Cách dùng
1. GitHub Desktop: chuyển về branch `p1/v26-ai-input-interpreter`.
2. Giải nén ZIP này.
3. Copy TOÀN BỘ nội dung bên trong thư mục V26.1 FULL SOURCE vào thư mục repo `hnl-pile-standards-ai`, chọn Replace/Overwrite.
4. GitHub Desktop sẽ chỉ hiện các file thật sự khác branch hiện tại (dự kiến chủ yếu gate V26.1 + tài liệu audit).
5. Commit: `fix: V26.1 refresh Pass 8.3 source sync gate after certified V26`
6. Push origin.
7. Chờ cả `V26 SPT AI Input Certification` và `P1 Pass 8.3 Runtime Certification` xanh.
8. PR #2 xanh hoàn toàn rồi mới Merge vào `main`.
9. Chờ GitHub Pages deploy xanh, Ctrl+F5 và test lại Golden SPT.

## Golden SPT bắt buộc
- qb = 6000 kPa
- fs = 40 kPa
- Rb = 960 kN
- Rs = 640 kN
- Rc,k = 1600 kN
- Rd = 1066.667 kN (gammaK=1.50)
- Nd,max = 927.536 kN/cọc (gammaN=1.15)

## Không thay đổi bởi V26.1
- src/search.js SHA-256 = f9b65e5e6fb61dcca233a4fe43950e3174c73536f2fa83452da3041fbd0021d2
- src/pdf.js SHA-256 = 5f9dd85f1c932b49f82def27d0c8c4002825a917c490ff11b3922ff5555b11a3
- src/ai.js SHA-256 = 711f9dbe5e2c2e4255a980b8b59fa3fc4b801fad78e5e5dd1b7cd223538a7f11
