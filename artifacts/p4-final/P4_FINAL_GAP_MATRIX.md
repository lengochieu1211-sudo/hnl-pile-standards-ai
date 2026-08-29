# P4 FINAL GAP MATRIX

Primary source: `HNL_v1.27.0_P4_PDF_EXCEL_INTELLIGENCE_DROP_IN_UPDATE.zip` (`ae0cff...edf1c`).

| Hạng mục | ZIP gốc | Final Repair |
|---|---|---|
| Quét toàn PDF tìm a,b | Có | Giữ nguyên, thêm cảnh báo nhiều giá trị/ngữ cảnh |
| PDF vùng chọn → Excel | Chưa nối popup | Bổ sung `Xuất Excel thông minh` |
| Ảnh/Vision/OCR → Excel | Có evidence REVIEW nhưng chưa nối card | Bổ sung `⇩ Xuất Excel REVIEW` |
| Provenance | file/page/bbox/engine | Giữ + `sourceSha` khi runtime có |
| OCR-readable = VERIFIED? | Không | Tiếp tục cấm; central trust barrier |
| P3.2 BENCHMARKED → Calculation | Không nêu đầy đủ | Cấm tự promote |
| Bảng → cells | Có workbook | Thêm structured detector trong hardened layer |
| Formula thật | Simple mapping có thể ghi formula | Chỉ VERIFIED + allowlist + resolved mapping; full-scan chỉ preview |
| a,b nhiều ngữ cảnh | Chưa chặn rõ | Ghi REVIEW/clarification |
| Excel runtime | Chưa certification | Test `exportP4ExcelWorkbook(validateOnly)` trong CI với ExcelJS thật |
| Regression count | 574 khóa cũ | 574 baseline + 18 P4 = exact 592 |
| Search Brain | Không sửa | Không sửa |
| Calculation Engine | Không sửa | Không sửa |

Trạng thái trước CI: **IMPLEMENTED / SHADOW_ONLY / LOCAL GATES PASS; CI PENDING**.
