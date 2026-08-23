# HNL Pile Standards AI v1.9.12

## Reader UI
- Sửa lỗi toolbar PDF đè chữ/nút ở vùng giữa khi 2 panel trái/phải cùng mở.
- Dùng CSS container query theo chiều rộng thật của `.viewer`; toolbar tự chuyển 1, 2 hoặc 3 hàng.
- Chia điều khiển thành nhóm `mode / zoom / page / layout`, wrap có kiểm soát.
- Giới hạn chiều rộng panel ở desktop hẹp để luôn chừa không gian tối thiểu cho PDF; không tự ẩn panel.

## AI model
- Gemini mặc định Web + Bridge: `gemini-3.7-flash`.
- Catalog Gemini dự phòng đồng bộ Web/Bridge và mở rộng theo dòng model chat hiện hành.
- `Models.list` đọc hết phân trang; lọc riêng model phù hợp `generateContent` cho chat văn bản và báo số model bị lọc chuyên biệt.
- Catalog dự phòng không được coi là model đã xác minh.
- Mọi chuyển provider/model vẫn bắt buộc xác nhận OK.

## Build & regression
- Version Gate đồng bộ 1.9.12 trên package/README/changelog/release/build metadata/artifact.
- Thêm regression tests cho container-query toolbar, Gemini Web/Bridge parity và default provider parity.
