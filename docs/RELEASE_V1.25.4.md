# HNL Pile Standards AI v1.25.4

## Full Table Golden Benchmark

### Phạm vi
Bảng 2, 3, 4, 6, 7, 8, 12, 15, 16, 17 của TCVN 10304:2025.

### Golden matrix
- EXACT: toàn bộ các ô số được tự động hóa.
- MID: các khoảng nội suy 1D.
- MID-2D: tâm các ô nội suy song tuyến hợp lệ.
- NEAR/BOUNDARY: sát biên, plateau/edge-band chỉ khi tiêu chuẩn cho phép.
- OUTSIDE/NULL: bắt buộc BLOCK, không ngoại suy và không đi xuyên ô trống.

### Kết quả
- 1.130/1.130 PASS.
- Bảng 8: benchmark phát hiện lỗi sparse-grid và đã sửa `bilinear2DStrict()` để chỉ đánh giá hai cột IL đang được tra.
- Search Brain không thay đổi.

### Release gate
RC chỉ được khóa khi `npm test`, Full Table Golden JSON, Excel cell-by-cell audit, build web và Windows smoke test đều PASS.
