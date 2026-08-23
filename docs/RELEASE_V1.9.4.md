# HNL Pile Standards AI v1.9.4 — UI Responsive & Panel Recovery

## Lỗi đã sửa
- Hai panel trái/phải có thể bị lưu trạng thái collapsed và mất nút mở lại.
- Toolbar PDF bị quá tải ở màn hình 1366px/scale Windows lớn, gây đè vùng AI.
- Nút toggle trùng `id` ở nhiều vị trí khiến DOM không chuẩn và khó chẩn đoán.

## Thay đổi
- Recovery rail độc lập cho cả Thư viện và Trợ lý.
- `sourceBadge`/`openSettings` tự mở đúng panel desktop.
- Nút `↺` khôi phục layout mặc định 290 / 440 px.
- Toolbar hai hàng ở viewport <=1500px; breakpoint riêng 1366px.
- Viewer luôn có nút mở/ẩn cả hai panel; focus reader vẫn có đường thoát.
- Storage layout nâng sang v1.9.4 để reset trạng thái lỗi cũ.

## Phím tắt
- `F`: Focus Reader
- `[`: Ẩn/hiện thư viện
- `]`: Ẩn/hiện trợ lý
- `Ctrl+F`: tìm trong PDF
- `Ctrl+0`: vừa chiều rộng
