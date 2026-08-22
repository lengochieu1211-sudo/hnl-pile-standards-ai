# UI Audit v1.9 — HNL Pile Standards AI

## Kết luận bố cục
Bố cục 3 vùng (Thư viện / PDF / Trợ lý) phù hợp cho ứng dụng kỹ thuật vì người dùng cần vừa đọc nguồn vừa hỏi AI. Điểm yếu của v1.8 là PDF chỉ hiển thị từng trang, vùng giữa bị hai panel chiếm diện tích và điều khiển zoom/trang khó dùng với tài liệu 100+ trang.

## Đã chỉnh ở v1.9
- Chế độ đọc **Liên tục** mặc định và **1 trang** tùy chọn.
- Lazy render trang bằng IntersectionObserver; không render toàn bộ PDF cùng lúc.
- Mỗi canvas có render task riêng; tránh nhiều trang hủy render lẫn nhau.
- Kéo/pan PDF bằng chuột Desktop; mobile giữ cuộn/swipe tự nhiên.
- Ctrl+wheel zoom; phím + / -; Ctrl+0 vừa chiều rộng.
- PageUp/PageDown, Home/End; thanh range nhảy nhanh đến trang xa.
- Tìm trong PDF trên toolbar; Enter/Shift+Enter hoặc nút lên/xuống để đi giữa các trang có kết quả.
- Page indicator tự đồng bộ theo vị trí cuộn.
- Focus Reader ẩn hai panel.
- Thư viện và Trợ lý có thể thu gọn riêng.
- Kéo mép hai panel để đổi độ rộng trên desktop.
- Scrollbar PDF làm lớn hơn và dễ kéo.
- Toolbar/statusbar responsive cho mobile.

## Đề xuất sau v1.9
- Thumbnail rail tùy chọn (lazy thumbnail) nếu cần duyệt hình nhanh.
- Text layer/highlight trực tiếp đoạn citation trong PDF.
- Outline/mục lục PDF tự nhận diện ở cạnh trái viewer.
- Đồng bộ vị trí đọc theo từng tài liệu giữa các phiên.
- Dark mode riêng cho UI, nhưng giữ trang PDF nền trắng.
