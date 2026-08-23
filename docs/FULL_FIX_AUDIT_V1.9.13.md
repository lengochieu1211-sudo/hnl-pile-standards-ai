# HNL Pile Standards AI v1.9.13 — Full Fix Audit

## 1. Model đồng bộ một nguồn
- `state.settings.model` là model văn bản đã commit duy nhất.
- Quickbar và Cài đặt cùng mở một `modelPickerHtml()`.
- Ô `modelInput` trong Cài đặt chỉ đọc, luôn phản chiếu model đã commit.
- Sau khi người dùng bấm OK đổi model, `syncCommittedModelEverywhere()` đồng bộ quickbar + Cài đặt.
- Đổi provider từ bất kỳ selector nào cũng áp dụng model mặc định qua cùng cơ chế.
- Không còn `oninput` riêng có thể tạo `settingsDraft.model` lệch với quickbar.
- Nhập model thủ công vẫn nằm trong hộp chọn chung và vẫn phải xác nhận OK.

## 2. Tabs / nút Cài đặt không bị khuất
- `.assistant-panel` là CSS container `assistant`.
- 7 tab hiển thị grid 4 cột; panel hẹp chuyển 3 cột, rất hẹp chuyển 2 cột.
- Không dùng một hàng `overflow-x` làm Cài đặt trôi ra ngoài khung.
- Tab text ellipsis trong chính ô, không đẩy nút khác ra ngoài.

## 3. Desktop Windows
Phát hiện hai nguyên nhân logic có thể làm EXE trông như lỗi trên PC:

1. `bridge/server.mjs /api/health` trước đây chờ Ollama tối đa 2500 ms nhưng Electron readiness ping timeout 1800 ms. Máy chưa cài/chưa chạy Ollama có thể khiến Electron không bao giờ xác nhận Bridge kịp thời.
2. `spawn('ollama')` trước đây không gắn listener `error`; nếu Windows không có `ollama.exe`, lỗi spawn bất đồng bộ có nguy cơ phát thành unhandled error.

Đã sửa:
- health probe Ollama tối đa 450 ms;
- UI mở trước, Ollama kiểm tra/khởi động nền sau;
- child process Ollama có `error` listener;
- Electron xác minh JSON `service === HNL AI Bridge`, không chỉ thấy một HTTP server bất kỳ;
- nếu 8787 bị chiếm, thử 8788–8791;
- cửa sổ lấy kích thước từ `screen.getPrimaryDisplay().workAreaSize`, không cố mở 1500×940 trên laptop nhỏ/Windows scale cao.

## 4. Responsive PDF
Giữ cơ chế v1.9.12:
- toolbar PDF dùng container query theo chiều rộng thật của viewer;
- title/search/controls tự chuyển 1 → 2 → 3 hàng;
- nhóm đọc/zoom/trang/layout wrap nguyên nhóm, không đè chữ;
- side panels chỉ ẩn do thao tác người dùng/Focus Reader, không tự mất vì resize.

## 5. Build/version
- Canonical version: `1.9.13`.
- Version Gate: PASS.
- `package.json`, README, changelog.current, release hiện hành, BUILD_METADATA và artifact Windows đồng bộ.
- Test: 61/61 PASS.
- Syntax: `src/main.js`, `bridge/server.mjs`, `electron/main.cjs` PASS.

## 6. Runtime còn cần GitHub xác nhận
Môi trường này không build/chạy Windows Electron thực tế. GitHub Actions Windows phải xác nhận:
- NSIS Setup EXE;
- Portable EXE;
- mở EXE trên Windows 10/11;
- Bridge khởi động khi không cài Ollama;
- chạy khi 8787 đang bị ứng dụng khác chiếm.
