# UI & Logic Audit v1.9.4

## Lỗi thực tế từ ảnh người dùng
1. Cả panel trái và phải có thể bị thu gọn đồng thời và trạng thái được lưu trong localStorage.
2. Nút mở panel trái trên desktop lại nằm trong panel trái hoặc bị CSS `.viewer-side-toggle { display:none }`, nên khi panel đã ẩn thì không còn đường mở lại.
3. Panel phải có nút ở toolbar nhưng khi toolbar bị chật/overflow ở màn hình 1366px thì khả năng thao tác kém.
4. Toolbar PDF v1.9.x cố nhét tiêu đề + search + mode + zoom + page + AI + focus trong một hàng; ở 1366x768/Windows scale lớn gây chồng lấn.
5. `toggleLibrary` và `toggleAssistant` từng xuất hiện với ID trùng ở nhiều vị trí DOM.

## Sửa trong v1.9.4
- Recovery rail độc lập ngoài panel: `reopenLibrary`, `reopenAssistant`.
- Viewer luôn có `viewerToggleLibrary` và `viewerToggleAssistant` với ID riêng.
- `sourceBadge` trên topbar mở lại thư viện desktop.
- `openSettings` mở lại trợ lý desktop và vào Cài đặt.
- Nút `↺` reset layout về 290 / 440 px và mở lại cả 2 panel.
- Focus Reader không thể làm người dùng mắc kẹt; recovery rail vẫn hiện.
- Storage layout đổi sang v1.9.4 để bỏ trạng thái collapsed lỗi cũ.
- Toolbar chuyển sang bố cục 2 hàng ở <=1500px; profile riêng 1366px và 1120px.
- Header/tabs được min-width/ellipsis để không chồng nút.

## Audit nút và tương tác
- 48 button ID tĩnh được quét; không có nút nào thiếu đường xử lý trong event delegation.
- Nút động dùng `data-*` tiếp tục dùng delegated events, không mất handler sau `render()`.
- Enter/Shift+Enter chat, citation -> trang PDF, upload nhiều file/folder, calculator, formula scanner, model manager, diagnostics vẫn giữ wiring.

## Test
- `node --check`: main.js, pdf.js, ai.js, bridge/server.mjs PASS.
- `npm test`: 40/40 PASS.
- Vite build chưa chạy được trong container vì `npm install` timeout; GitHub Actions sẽ cài dependency/build trên runner.
