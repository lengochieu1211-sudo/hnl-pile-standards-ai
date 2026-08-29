# HNL P4 · PDF/Ảnh → Excel Intelligence · FINAL REPAIR

Nguồn chính của Pass này là ZIP `HNL_v1.27.0_P4_PDF_EXCEL_INTELLIGENCE_DROP_IN_UPDATE.zip` (SHA-256 `ae0cff...edf1c`) trên frozen P3.2 `a494ee4...577f`.

## Luồng được bảo toàn
PDF.js Native → P3.1/P3.2 region evidence → tìm tham số/bảng/công thức → provenance → ExcelJS.

## Hai chế độ
1. **Quét tài liệu:** nút `PDF → Excel`, `Ctrl+Shift+E` hoặc `?pdfexcel=1`; tìm `a,b` trong toàn bộ PDF đã index, hiển thị ứng viên và cảnh báo khi cùng ký hiệu có nhiều giá trị/ngữ cảnh.
2. **Xuất theo vùng/ảnh:** vùng PDF đang chọn có `Xuất Excel thông minh`; Image Engineering review có `⇩ Xuất Excel REVIEW`.

## Quy tắc Excel
- Giao diện tiếng Việt; Input/Formula/Result/Review được tách rõ.
- Bảng cấu trúc → cells; text nguồn/provenance được giữ.
- Formula thật chỉ khi nguồn `VERIFIED`, provenance đầy đủ, biến đã map input và biểu thức qua allowlist an toàn.
- Quét toàn tài liệu và OCR/Vision chưa VERIFIED chỉ ghi **preview**, không ghi formula thực thi.
- Finite choices giữ để tạo dropdown.
- `sourceSha`, file, page, bbox, engine, trạng thái/confidence được bảo toàn khi có.

## Safety boundary
- `BENCHMARKED` P3.2 không được tự nâng thành `VERIFIED`.
- OCR/Vision cần xác nhận người dùng trước khi đủ điều kiện tính toán.
- P4 không import/call Search Brain hoặc Calculation Engine.
- `productionMutationAllowed=false` và `calculationEngineMutationAllowed=false` trong packet/export plan.

## Certification
- P4 selftest nguồn gốc + 18 safety/runtime tests.
- ExcelJS runtime workbook test chạy trong CI sau `npm ci`.
- Vite build chạy cả Ubuntu + Windows trong `v1.27 PDF Intelligence Shadow Certification`.
- Gate regression cập nhật từ 574 baseline + 18 P4 = **592**, không hạ baseline và không bỏ test.
