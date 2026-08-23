# HNL v1.9.11 — UI / Model / Windows Build Audit

## Lỗi tái hiện
- Native `<select>` model mở danh sách đè trực tiếp lên hàng tab Trợ lý. Đây là hành vi popup của trình duyệt, CSS của tab không thể ngăn popup native phủ nội dung.
- Catalog Gemini khi chưa có API key chỉ có 4 mục nên trông như ứng dụng thiếu model.
- GitHub Windows build v1.9.10 dừng ở `Validate Windows builder config`: PowerShell nội suy `${target}` trong chuỗi `node -e`, tạo JavaScript `includes('\')` và lỗi cú pháp.

## Sửa
- Dùng dialog model riêng, tìm kiếm, model thủ công, refresh API và badge xác minh.
- Tabs một hàng cuộn ngang; không wrap thành 2 hàng.
- Gemini Models.list phân trang và catalog hiện hành mở rộng.
- Validate Windows builder dùng PowerShell `ConvertFrom-Json` và tạo literal `$` + `{target}` an toàn.
- Version Gate tiếp tục lấy `package.json` làm nguồn version duy nhất.
