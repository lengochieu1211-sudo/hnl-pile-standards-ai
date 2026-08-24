# HNL Pile Standards AI v1.11.2 — Source Audit

## Phạm vi nguồn
Audit này chỉ dùng ZIP `HNL-Pile-Standards-AI-v1.11.1-Windows-Hash-Build-Fix.zip` làm nguồn code. ZIP không chứa 3 PDF TCVN gốc; vì vậy không tuyên bố đã đối chiếu độc lập nội dung công thức/bảng với PDF tiêu chuẩn.

## Lỗi/root cause xác nhận
1. Hash guard của search brain trước đây nhạy với byte line-ending. Windows checkout LF→CRLF làm SHA-256 byte thay đổi dù logic không đổi.
2. `.gitattributes` v1.11.1 đã có wildcard LF và golden test đã normalize CRLF. v1.11.2 gia cố thêm rule riêng `src/search.js text eol=lf`, script `check:search` độc lập, và normalize cả CRLF lẫn CR đơn trước SHA-256.
3. `src/search.js` không bị sửa. Canonical normalized SHA-256 vẫn là `f9b65e5e6fb61dcca233a4fe43950e3174c73536f2fa83452da3041fbd0021d2`.
4. Source không có `package-lock.json`; workflow hiện dùng `npm install`, không phải `npm ci`, nên không phải lỗi workflow hiện tại nhưng dependency resolution chưa reproducible tuyệt đối.
5. Code Pack hiện có nhiều mục `Indexed` và một số bảng/công thức source tự gắn `Verified`. Do thiếu 3 PDF trong ZIP, audit này chỉ gọi chúng là **SOURCE-DECLARED VERIFIED**, chưa nâng mức thành independently verified.
6. Export Excel hiện có công thức thật cho formula VERIFIED đơn lẻ và bảng tra kèm theo, nhưng chưa phải workbook workflow cọc nhiều lớp hoàn chỉnh như đặc tả 8 sheet; file mẫu audit được tạo riêng để kiểm hướng kiến trúc/recalculation và cố ý đánh REVIEW cho dữ liệu đất mẫu.

## Test đã chạy thật
- `npm test`: 145/145 PASS, 0 FAIL.
- Version Gate v1.11.2: PASS sau khi đồng bộ release note.
- Search brain normalized hash: PASS trong test suite và `check:search`.
- `npm run build:web`: CHƯA PASS trong sandbox này vì dev dependency Vite chưa được cài; thử `npm install` bị timeout môi trường. Không báo PASS giả.
- Windows Setup/Portable EXE: CHƯA CHẠY vì môi trường audit hiện tại không phải Windows/GitHub Actions.

## Golden coverage có trong suite
- cọc chống definition
- TOC cọc chống → trang in 28
- cọc ma sát
- Phụ lục trang muộn
- PDF scan/TOC targeting logic
- PHC/NPH class/table guards
- MPa·mm² → kN guard
- B30 lookup
- CB400-V lookup
- button/event wiring, PDF viewport/state, API test state, native PDF mode, RAR/7Z wiring, Ollama guidance

## SOURCE-DECLARED VERIFIED trong ZIP
- TCVN 7888: bảng nhanh PC/PHC và NPH Table 2; một số công thức Appendix B và guard cường độ.
- TCVN 10304: công thức (5)–(9) được source đánh Verified/computable; structured tables hiện mới có dữ liệu cụ thể cho Bảng 1, 5, 9, 10, 14, 17, 18.
- TCVN 5574: lookup B30 (Rb/Rbt/Eb) và CB400-V (Rs/Rsc/Rsw) cùng các hàng vật liệu trong structured table.

## REVIEW / chưa đủ theo yêu cầu cuối
- Chưa có 3 PDF gốc để kiểm trang in ↔ pdfPage và provenance từng giá trị.
- Chưa có dữ liệu cấu trúc đầy đủ Bảng 1→18 của TCVN 10304; nhiều bảng mới chỉ index metadata.
- Chưa có workflow tính đầy đủ cho đóng/ép, nhồi/khoan, vít, tải tĩnh, động, CPT, SPT, lún đơn/nhóm/khối quy ước/bè-cọc.
- TCVN 5574 chưa Verified đầy đủ các module uốn, nén lệch tâm, cắt, xoắn, chọc thủng, nứt, biến dạng, ứng suất trước, neo/nối, tiết diện tròn/vành khuyên, công xôn ngắn.
- Excel production 8-sheet workflow chưa tích hợp vào app; file mẫu đi kèm chỉ là benchmark kiến trúc và không giả mạo bảng đất là VERIFIED.

## Thay đổi code v1.11.2
- Giữ nguyên `src/search.js`.
- Gia cố `.gitattributes` với rule riêng cho search brain.
- Thêm `scripts/check-search-brain.mjs`.
- `npm test` chạy thêm `npm run check:search`.
- Golden hash normalize `CRLF` và `CR` về `LF` trước SHA-256.
- Đồng bộ version 1.11.2 toàn project/release metadata.
