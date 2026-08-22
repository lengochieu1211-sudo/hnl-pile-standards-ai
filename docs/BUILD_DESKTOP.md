# Build HNL Desktop AI trên GitHub

1. Upload toàn bộ source hiện tại lên repository.
2. Vào **Actions** → **Build HNL Desktop AI for Windows**.
3. Chọn **Run workflow**.
4. Chờ job Windows hoàn tất.
5. Tải artifact có dạng `HNL-Pile-Standards-AI-Windows-v<version>-build-<số build>`.
6. Bên trong có bản Setup NSIS và Portable EXE.

Số version được đọc tự động từ `package.json`; workflow không ghi cứng version.
`dist/build-info.json` được tạo sau khi bước Vite build thành công và được đóng gói vào EXE.

Không cần code signing để test nội bộ; Windows SmartScreen có thể cảnh báo với ứng dụng chưa ký số.
