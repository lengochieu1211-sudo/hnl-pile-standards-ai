# HNL Pile Standards AI v1.9.12 — Full UI / Model / Version Audit

## Kết quả
- Version Gate: PASS — package/README/changelog/release/build metadata/Windows artifact cùng 1.9.12.
- Core + wiring regression tests: 58/58 PASS.
- Syntax: `src/main.js`, `src/ai.js`, `bridge/server.mjs`, Electron và build scripts PASS.
- `npm install` trong môi trường kiểm tra bị timeout, nên không tuyên bố đã tạo EXE cục bộ; GitHub Actions vẫn là build gate thực tế.

## Sửa giao diện vùng PDF
- Toolbar không còn phụ thuộc duy nhất vào viewport; `.viewer` là CSS container.
- Viewer rộng: tiêu đề + tìm kiếm + controls trên một hàng.
- Viewer vừa: tiêu đề/tìm kiếm hàng 1, controls hàng 2.
- Viewer hẹp: tiêu đề, tìm kiếm, controls tách thành 3 hàng.
- Controls chia thành nhóm mode/zoom/page/layout; nhóm có thể wrap nhưng không chui vào vùng tên tài liệu.
- Desktop hẹp giảm ngân sách panel trái/phải trước khi làm vùng PDF quá hẹp; panel không tự ẩn.

## Sửa model AI
- Gemini Web và Bridge cùng mặc định `gemini-3.7-flash`.
- Catalog Gemini dự phòng Web/Bridge đồng bộ.
- `Models.list` đọc hết phân trang ở cả Direct và Bridge.
- Chỉ model `generateContent` phù hợp chat text/vision→text được đưa vào quick model picker; image/TTS/live/embedding được loại khỏi picker chat để tránh chọn sai endpoint.
- Trạng thái nêu rõ tổng model generateContent tìm thấy, số model chat phù hợp và số model chuyên biệt bị lọc.
- Catalog dự phòng luôn `verified=false`; không được dùng làm bằng chứng cho fallback tự động.
- Mọi đổi provider/model/fallback vẫn phải người dùng bấm OK.

## Windows build
- Setup và Portable tiếp tục có `artifactName` riêng.
- Workflow kiểm tra version → tests → builder config → build → verify đủ 2 EXE → upload.
