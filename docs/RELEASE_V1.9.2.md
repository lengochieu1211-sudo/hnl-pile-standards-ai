# HNL Pile Standards AI v1.9.2

## Build Metadata & Update Diagnostics

### Thay đổi chính
- Không còn ghi cứng ngày/giờ cập nhật trong `src/main.js`.
- `package.json` là nguồn duy nhất cho số phiên bản ứng dụng.
- Sau khi Vite build thành công, `scripts/generate-build-info.mjs` tạo `dist/build-info.json`.
- Trên GitHub Actions, build-info tự ghi: version, build number, run attempt, run id, commit SHA, branch, repository, Web/Desktop và thời điểm build.
- Giao diện hiển thị thời điểm build theo múi giờ `Asia/Ho_Chi_Minh` (GMT+7).
- Cài đặt có nút kiểm tra GitHub Release và nút sao chép thông tin phiên bản/build để gửi khi báo lỗi.
- `public/changelog.json` hiển thị lịch sử thay đổi gần nhất ngay trong app.
- Service Worker lấy version từ URL đăng ký (`sw.js?v=<package-version>`) và luôn network-first cho `build-info.json` / `changelog.json`.
- Tên artifact Desktop trên GitHub Actions tự lấy version + build number; không còn tên `v1.8.0` ghi cứng.

### Ý nghĩa của ngày giờ hiển thị
`Thời điểm build` là thời gian được đóng dấu **sau khi lệnh Vite build hoàn tất thành công**. Nếu GitHub Pages deploy thành công thì đây chính là metadata của bản đang được phát hành. Không phải giờ hiện tại của máy người dùng và không phải ngày viết source.
