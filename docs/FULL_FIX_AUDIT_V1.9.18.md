# HNL Pile Standards AI v1.9.18 — Full Logic / UI / Offline Audit

Ngày audit: 2026-08-23

## 1. Nguồn audit

Audit và sửa trực tiếp từ source v1.9.17 Full Audit Fix. Không dùng source cũ để suy đoán implementation hiện hành.

## 2. Lỗi thực tế tìm thấy và đã sửa

### A. OCR/Chọn vùng làm PDF nhảy về đầu

**Root cause:** `togglePdfSmartSelection()` thay mode rồi gọi full `render()`. `render()` thay toàn bộ `#app.innerHTML`, vì vậy `#pdfScroll` bị tạo lại và mất `scrollTop`; observer sau đó có thể đồng bộ `state.page` về trang đầu.

**Sửa:**
- thêm `applyPdfSelectionModeUi()` cập nhật trực tiếp button/layer đang render;
- `togglePdfSmartSelection()` không gọi `render()`;
- off/text/region được chuyển tại chỗ;
- chỉ chuẩn bị selection layer của trang đang render/current page.

### B. Kiểm tra kết nối API làm tab Cài đặt nhảy lên trên

**Root cause:** `testConnection()` gọi full `render()` trước và sau request API. `.panel-body` bị tạo lại nên mất `scrollTop`, focus và vị trí input.

**Sửa:**
- thêm `connectionStatusBox` + `connectionStateLabel` cố định;
- thêm `updateConnectionStatusUi()`;
- `testConnection()` không full-render;
- giữ nguyên API key nháp, focus và scroll;
- kết quả `Đang kiểm tra / Kết nối OK / Kết nối lỗi` cập nhật tại chỗ.

### C. Full render ở các tác vụ khác có thể làm mất viewport

**Sửa kiến trúc:** thêm `captureRenderViewport()` / `restoreRenderViewport()` để bảo toàn khi cùng ngữ cảnh:
- PDF page;
- page anchor offset;
- PDF `scrollTop` / `scrollLeft`;
- panel AI scroll;
- thư viện scroll;
- focus + selection range của input;
- không phục hồi focus sai khi model picker vừa mở/đóng.

Snapshot lấy `docId` từ viewer đang render (`#pdfScroll[data-doc-id]`), không lấy mù từ state vừa thay đổi.

### D. Các nút bố cục vẫn ép PDF lên đầu trang hiện tại

Các nút `toggleLibrary`, `toggleAssistant`, `reopenLibrary`, `reopenAssistant`, `resetLayout`, `focusReader` trước đây đặt `pendingPageScroll=true`.

**Sửa:** loại bỏ forced page scroll đối với thao tác chỉ thay đổi layout. UI State Guard giữ viewport hiện tại.

### E. Citation đổi sang PDF khác có thể dùng shell trang của PDF cũ

**Root cause:** continuous viewer dùng id `pdf-page-N` giống nhau giữa các tài liệu. Sau khi đổi `state.activeDocId`, DOM cũ vẫn tồn tại cho đến render tiếp theo; `jumpPage()` có thể thấy `#pdf-page-N` và thao tác shell cũ.

**Sửa:**
- `#pdfScroll` có `data-doc-id`;
- `jumpPage()` chỉ nhảy trực tiếp khi `data-doc-id === activeDoc.id`;
- nếu khác tài liệu: đặt `pendingPageScroll`, render đúng tài liệu rồi mới nhảy;
- citation handler dùng chung `jumpPage()`.

### F. Offline AI: có ollama.exe nhưng server 11434 chưa sẵn sàng

**Root cause:** endpoint tải model có thể chạy `ollama pull` ngay sau khi tìm thấy executable. File tồn tại không đảm bảo Ollama API đã chạy.

**Sửa Bridge:**
- `ollamaApiReady()`;
- `ensureOllamaServerReady()`;
- trước mọi `pull-model`: kiểm tra `127.0.0.1:11434/api/tags`;
- nếu chưa ready: tự chạy `ollama serve` ẩn console;
- chờ API sẵn sàng rồi mới `ollama pull`;
- nếu executable có nhưng API vẫn không lên: trả `OLLAMA_NOT_READY` rõ ràng.

### G. Cancel model trên Windows chỉ kill child trực tiếp

**Sửa:** Windows dùng `taskkill.exe /PID <pid> /T /F` để dừng cả process tree của pull job.

### H. Nhãn version cũ còn hiện trong UI chức năng

Các nhãn mô tả `v1.7`, `v1.7.1` trong panel chức năng có thể gây hiểu nhầm version đang chạy.

**Sửa:** đổi thành tên chức năng (`Cơ chế truy hồi`, `Quét công thức thông minh`). Lịch sử changelog/release cũ vẫn giữ nguyên vì đó là lịch sử hợp lệ.

## 3. Audit button / interaction

- 62 button occurrences trong template, 59 ID duy nhất; ID lặp chỉ nằm ở các nhánh UI điều kiện, không phải handler bị thiếu.
- Tất cả literal button ID hiện hành có delegated handler.
- Dynamic actions được audit: tab, mobile, connection, delete, model choice, model directory, install pack, local model delete/cancel, source open, citation jump/find, PDF selection actions, suggestion.
- `app.onclick`, `app.onchange`, `app.oninput`, `app.onkeydown` dùng delegation nên full render không làm mất listener.
- Enter gửi Chat; Enter tìm PDF; Enter lookup; Ctrl/Cmd+Enter compare vẫn được wiring.

## 4. Audit responsive / layout

### Desktop 1366×768 @ 100%
- left panel cap theo viewport;
- right panel khoảng 30vw;
- PDF còn vùng usable;
- viewer toolbar chuyển sang 2 hàng theo **container width**, không theo window width.

### Windows scale 125%
CSS viewport xấp xỉ 1093 px:
- vẫn trên breakpoint mobile 880;
- 3 panel vẫn tồn tại;
- panel co trước PDF;
- assistant tabs chuyển theo container nếu hẹp.

### Windows scale 150%
CSS viewport xấp xỉ 911 px:
- vẫn là desktop 3 panel theo yêu cầu “dưới 880 mới mobile”;
- left ~215 px, right ~290 px, PDF min ~300 px;
- assistant container <=315 px → tabs 2 cột;
- PDF container rất hẹp → toolbar tách nhiều hàng, không overlap title.

### Full HD
- 290 / flexible PDF / 440 px mặc định;
- PDF đủ rộng sẽ dùng toolbar một hàng;
- assistant tabs 4 cột.

### Panel recovery
- Left/right panel chỉ ẩn do thao tác user/focus;
- luôn có recovery control ngoài panel ở desktop;
- mobile dùng nav Thư viện / PDF / Trợ lý.

## 5. Version sync

Nguồn version chính: `package.json = 1.9.18`.

Đã đồng bộ active metadata:
- package.json;
- README heading + current release section;
- public/changelog.json current + first release;
- docs/RELEASE_V1.9.18.md;
- docs/BUILD_METADATA.md;
- Vite inject từ package.json;
- generate-build-info đọc package.json;
- Windows artifact names dùng `${version}`;
- Service Worker cache version nhận từ runtime registration.

`npm run check:version`: PASS.

## 6. Test

Final Node test suite: **86/86 PASS, 0 FAIL**.

Regression mới bao gồm:
- Smart Select không full render;
- API Connection không full render;
- UI viewport preservation;
- Ollama ready-before-pull;
- Windows process-tree cancel;
- responsive 4→3→2 + viewer container queries;
- cross-document citation docId guard;
- layout buttons không ép `pendingPageScroll`;
- render snapshot lấy docId từ DOM đang hiển thị.

Node syntax check: PASS cho source chính đã sửa.

Workflow YAML: PASS parse cho `pages.yml` và `desktop-win.yml`.

Secret scan: không thấy API key thật trong source; `.env.web/.env.desktop` chỉ chứa edition flag.

## 7. Windows workflow

Giữ đúng pipeline:

Install → Version Gate → Test → Validate Builder Config → Build NSIS + Portable → Verify Setup → Verify Portable → Upload Artifact.

Artifact names:
- `HNL-Pile-Standards-AI-Setup-${version}-${arch}.${ext}`
- `HNL-Pile-Standards-AI-Portable-${version}-${arch}.${ext}`

Không có `${target}` trong `win.artifactName`.

## 8. Phần chưa thể xác nhận thực tế trong môi trường audit

Không báo PASS giả cho các mục sau:
- Vite Web build: ZIP không có `node_modules`; `npm run build:web` dừng ở `vite: not found`;
- Electron/Windows Setup + Portable build thực trên Windows;
- chạy thật ở Windows Scale 100/125/150 bằng màn hình vật lý;
- tải Ollama/model nhiều GB thực tế;
- RAR/7Z password trên Windows thật với 7-Zip/WinRAR;
- API Gemini/OpenAI/Claude/Grok bằng key thật;
- OCR TextDetector phụ thuộc Chromium/máy thực.

Source/workflow đã được kiểm logic cho các luồng trên, nhưng cần GitHub Actions/PC Windows để xác nhận runtime cuối.

## 9. File chính thay đổi so với v1.9.17

- `src/main.js`
- `bridge/server.mjs`
- `tests/wiring.test.mjs`
- `package.json`
- `README.md`
- `public/changelog.json`
- `docs/BUILD_METADATA.md`
- `docs/RELEASE_V1.9.18.md`
- `docs/FULL_FIX_AUDIT_V1.9.18.md`

## 10. Kết luận

Bản v1.9.18 xử lý trực tiếp các lỗi trong video và mở rộng sửa theo root cause để tránh cùng nhóm lỗi xuất hiện ở các nút khác. Logic button/state, responsive layout, model confirmation, Offline AI readiness và version gate đều đã được tăng coverage bằng regression tests. Runtime Windows/EXE vẫn cần GitHub Actions hoặc PC Windows thật để xác nhận build và tích hợp hệ thống.
