# HNL Pile Standards AI v1.9.11 — Responsive Model Picker, Gemini Catalog & Windows Build Fix

## UI
- Model picker riêng dạng dialog, có tìm kiếm, nhập model thủ công và trạng thái catalog/API.
- Tabs Trợ lý một hàng cuộn ngang; không chồng hàng khi panel hẹp.
- 1366×768/Windows 125% ưu tiên panel tự co nhưng không mất nút.

## Gemini
- Catalog gợi ý gồm Gemini 3.7 Flash, 3.6 Flash, 3.5 Flash/Lite, 3.1 Pro/Flash-Lite, 3 Flash Preview và Gemini 2.5 Pro/Flash/Flash-Lite.
- Models.list đọc đủ `nextPageToken`; danh sách xác minh theo API key không bị giới hạn ở trang đầu.
- Mọi thay đổi model vẫn bắt buộc người dùng bấm OK.

## Windows
- Sửa bước PowerShell validate artifactName bị nội suy `${target}` làm lệnh Node lỗi cú pháp.
- Giữ Version Gate, test, build, verify Setup + Portable trước upload artifact.
