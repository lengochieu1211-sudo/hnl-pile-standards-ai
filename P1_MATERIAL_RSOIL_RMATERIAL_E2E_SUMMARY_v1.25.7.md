# P1 Material → Rsoil/Rmaterial E2E — v1.25.7

Đã khóa `Rpile=min(Rd,10304, Nu,5574)` cho cọc vuông khi cả hai child branch độc lập đều LOCKED/VERIFIED. `γn` tách khỏi phép min và chỉ dùng sau đó để tính `Nd,max(final)`.

Kết quả tại sandbox: focused 9/9; regression 370/370; Full Table Golden 1242/1242; P0 workflow 35/35 intermediate; Material 42/42; P1 E2E 4/4 workflow + 20/20 intermediate + 6/6 boundary + 3/3 benchmark; DCE 213/213 acceptable; SPT Decision 26/26. Search Brain không đổi.

Excel integrated là formula-only và tái sử dụng child soil workbook đã LOCKED. Local ExcelJS/Web/Windows gates vẫn BLOCKED do thiếu package-lock/dependency/runtime, đã nối vào RC CI.

XLSM `SCT VatLieu` giữ REFERENCE/BUGGED; EQ giữ REVIEW.
