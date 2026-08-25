# P1 Pass 8.1 – Dynamic Excel Exporter + Scoped App Runtime Integration v20

## Kết luận

**CORE_LOCKED_DYNAMIC_EXCEL_EXPORTER_PATCH**

Pass 8.1 đã nối runtime thật trong patch:

`TÍNH → export contract → POST /api/hnl/pile/export-excel → server chạy lại Pass 8 → đối chiếu client/server → ghi động template v18 → trả XLSX tiếng Việt`.

## Golden

- Rsoil = 843.4285714285716 kN
- Rmaterial = 2952 kN
- Rpile = 843.4285714285716 kN
- γn = 1.15
- Nd,max = 733.4161490683232 kN/cọc
- Cọc bất lợi = 168
- Tổ hợp = EULS
- Utilization = 0.4980692764464232
- Kết luận = ĐẠT

Workbook dynamic được kiểm bằng spreadsheet parser: **0 lỗi công thức** trong scan `#REF!/#DIV0!/#VALUE!/#NAME?/#N/A`.

## Bằng chứng dynamic

Với cùng request nhưng đổi γn thành 1.20:

- Nd,max đổi thành 702.857142857143 kN/cọc
- Utilization đổi thành 0.5197244623788765
- SHA workbook thay đổi
- Template SHA vẫn cố định

Do đó exporter không phải cơ chế tải lại mẫu tĩnh.

## Runtime endpoint

HTTP test thật:

- valid request → **200 XLSX**
- `x-hnl-server-verified: true`
- trả `x-hnl-export-id`
- trả đúng template SHA
- tamper Rpile phía client → **422 PASS81_EXPORT_BLOCKED**

## Regression

- Current Pass4→Pass8.1 Node suite: **188/188 PASS**
- Prior regression: **388/388 PASS**
- Full Table Golden: **1242/1242 PASS**
- Search Brain prior locked SHA giữ nguyên.

## Kiến trúc an toàn

Exporter không gọi trực tiếp các child engineering engines. Nó chỉ ánh xạ kết quả server đã được Pass 8/Pass 7 tính lại vào OOXML template v18.

Không cần Excel/Office/ExcelJS/COM.

## Phạm vi integration

UI Pass 8 trong patch đã gọi health endpoint và endpoint export thật; local HTTP backend trong patch đã route và phục vụ file thật. Đây là **runtime integration hoàn chỉnh trong scoped patch**.

Không tuyên bố đã merge vào một cây **full source HNL upstream** khác vì source đầy đủ đó không phải base hiện tại của patch. Việc merge upstream phải là một gate riêng để tránh rollback/mất tính năng.
