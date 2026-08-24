# HNL Pile Standards AI v1.25.3

## Interpolation & Table Audit

### Chính sách bảng TCVN 10304:2025
- Bảng 2: LINEAR-1D/BILINEAR-2D theo độ sâu + IL; z>40 dùng hàng 40 theo chú thích; không ngoại suy phía dưới hay ngoài IL.
- Bảng 3: LINEAR-1D/BILINEAR-2D; tự chia lớp thành phân đoạn ≤2 m; không ngoại suy độ sâu.
- Bảng 4, 6, 12: DISCRETE, không nội suy.
- Bảng 7: α1/α2 nội suy theo φ; α3 theo φ+h/d; α4 theo φ+d; chỉ plateau ở biên mà bảng ghi.
- Bảng 8: BILINEAR-2D độ sâu+IL; không nội suy qua ô gạch ngang.
- Bảng 15: EXACT/EDGE-BAND; không tự nội suy mốc trung gian vì bảng không có chú thích cho phép.
- Bảng 16: LINEAR-1D theo qc trong các đoạn có số.
- Bảng 17: kv/ζ0 theo CT (33)/(34); mv nội suy tuyến tính từng khoảng; ν ngoài [0;0,5] bị khóa.

### Đồng bộ
`src/interpolation-engine.js` là quy tắc strict dùng cho Calculation Engine. Excel exporter phản chiếu cùng quy tắc, bao gồm phân đoạn ≤2 m, boundary gates và provenance.

### Safety
Không ngoại suy chỉ vì Excel có thể tính được. Bảng rời rạc không được biến thành bảng liên tục. Override thủ công phải giữ provenance “Nhập tay”. Search Brain không thay đổi.
