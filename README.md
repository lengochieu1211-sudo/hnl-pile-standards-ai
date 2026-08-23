# HNL Pile Standards AI v1.9.13

## v1.9.13 — Desktop Fit, Model Sync & Always-visible Settings

- Một nguồn model văn bản duy nhất: thanh AI phía trên và Cài đặt luôn hiển thị cùng model; đổi ở bất kỳ vị trí nào đều dùng chung hộp chọn và vẫn hỏi OK.
- Bỏ ô model độc lập trong Cài đặt; nhập model thủ công vẫn thực hiện trong hộp Chọn model chung.
- Tabs Trợ lý dùng container query 4/3/2 cột theo đúng chiều rộng panel, vì vậy `Cài đặt` không còn bị giấu ngoài vùng cuộn ngang.
- Desktop EXE tự lấy kích thước theo vùng làm việc màn hình thay vì cố mở 1500×940; phù hợp laptop 1366×768 và Windows scale 125–150%.
- Sửa lỗi Local Engine trên máy không có Ollama: health phản hồi nhanh, Electron xác minh đúng HNL Bridge, thử cổng 8787–8791 và không chờ Ollama trước khi mở UI.
- Ollama chạy nền tùy chọn sau khi giao diện mở; AI Online và tra cứu PDF không bị chặn khi máy chưa cài Ollama.


## v1.9.12 — Collision-proof Reader Toolbar & Gemini Model Sync

- Sửa dứt điểm vùng khoanh đỏ: tên PDF, `Liên tục / 1 trang`, zoom và điều hướng trang không còn đè lên nhau khi 2 panel đang mở.
- Toolbar PDF dùng **container query theo đúng chiều rộng vùng PDF**, không chỉ dựa vào chiều rộng toàn màn hình; tự chuyển 1 → 2 → 3 hàng khi thiếu chỗ.
- Chia toolbar thành 4 nhóm độc lập (chế độ đọc / zoom / trang / bố cục) để wrap có kiểm soát, không cắt chữ và không chui vào vùng tiêu đề.
- Giới hạn panel trái/phải ở desktop hẹp để luôn chừa vùng PDF tối thiểu; panel chỉ ẩn khi người dùng chủ động thu gọn hoặc bật Focus Reader.
- Đồng bộ Gemini Web + Bridge: mặc định `gemini-3.7-flash`, catalog dự phòng đầy đủ hơn, `Models.list` đọc toàn bộ phân trang và chỉ liệt kê model phù hợp cho chat văn bản.
- Trạng thái model hiển thị rõ số model API tìm thấy / số model chat phù hợp; catalog dự phòng luôn ghi rõ **chưa xác minh**.
- Đồng bộ lại default Claude giữa Web và Bridge; giữ nguyên quy tắc mọi đổi model/provider đều phải bấm OK.
- Thêm test chống tái phát overlap toolbar, lệch default AI và lệch danh sách Gemini giữa Web/Bridge.



## v1.9.11 — Responsive Model Picker, Gemini Catalog & Windows Build Fix

- Thay dropdown model native bằng hộp chọn model riêng có tìm kiếm, trạng thái xác minh và nhập model thủ công; không còn popup model che tab Trợ lý.
- Tab Trợ lý chuyển thành một hàng cuộn ngang an toàn, không tạo hàng thứ hai đè nội dung khi panel hẹp.
- Gemini catalog gợi ý cập nhật theo tài liệu Google tháng 08/2026, gồm Gemini 3.7/3.6/3.5/3.1/3 và dòng 2.5; khi có API key, HNL đọc toàn bộ trang `Models.list` bằng phân trang.
- Giữ nguyên quy tắc: mọi đổi provider/model đều hỏi OK trước khi áp dụng; refresh model không tự chuyển.
- Sửa bước `Validate Windows builder config` trên PowerShell: không còn lỗi `${target}` bị PowerShell nội suy thành chuỗi JavaScript hỏng.
- Tối ưu panel phải ở 1366px/Windows 125% và thêm test chống tái phát overlap/model/build.

## v1.9.10 — Full Sync, Logic & UI Hardening

- Đồng bộ version theo một nguồn duy nhất: `package.json` → Vite/UI → README → changelog → release hiện hành → build-info → tên artifact Windows.
- Bổ sung `scripts/check-version-sync.mjs`; build dừng ngay nếu version lệch hoặc thiếu file release hiện hành.
- Sửa test cũ còn khóa `1.9.8`, tránh tình trạng nâng version làm test sai giả.
- Workflow Web + Windows có bước **Version Gate** riêng trước test/build; Pages dùng `checkout/setup-node@v5`.
- Giữ nguyên quy tắc an toàn AI: mọi đổi Text/Vision/Embedding/provider đều cần xác nhận; Refresh/Test không tự lưu cài đặt hoặc API key.
- Giữ responsive 3 vùng: desktop tự co, không tự mất panel; mobile chuyển tab; nút phục hồi vẫn luôn truy cập được.
- Windows build chỉ upload khi xác minh đủ **Setup EXE + Portable EXE**.

## v1.9.9 — Full Logic, UI & Version Hardening

- **Version Gate** kiểm tra đồng bộ `package.json` → README → `public/changelog.json` → release hiện hành trước khi test/build.
- Refresh model và Kiểm tra kết nối chỉ đọc giá trị nháp, **không tự lưu** cài đặt hoặc API key.
- Đổi **Text / Vision / Embedding model** luôn hiện xác nhận; chỉ bấm **OK** mới áp dụng.
- API key chỉ lưu trong `sessionStorage` sau khi bấm **Lưu cài đặt**.
- Model list phân biệt **đã xác minh từ API/Ollama** với **catalog gợi ý**; fallback chỉ đề nghị model đã xác minh.
- Cài bộ AI Offline và cấu hình tự đề xuất theo máy đều hỏi xác nhận trước khi đổi model hiện tại.
- Chuẩn hóa responsive: desktop tự co 3 vùng, không tự mất panel; mobile dùng 3 tab; luôn có nút khôi phục bố cục.
- Workflow Web + Windows chạy Version Gate; Windows chỉ upload khi có đủ **Setup + Portable EXE**.


## v1.9.8 — Dynamic Model + User-approved Fallback + Windows Build Fix

- Sửa dứt điểm lỗi GitHub Windows build do `artifactName` dùng macro `${target}` không được electron-builder hỗ trợ.
- Setup và Portable có tên artifact riêng; workflow kiểm tra đủ cả 2 `.exe` trước khi upload.
- Bộ chọn **AI + Model** hiển thị trực tiếp ngay trên panel Trợ lý, không cần vào sâu Cài đặt mới thấy.
- `↻ Model` lấy danh sách model khả dụng từ tài khoản/API hoặc Ollama đang cài.
- Làm mới danh sách model **không còn tự ý đổi model hiện tại**.
- Khi model lỗi quota/rate limit/503, HNL thử lại chính model hiện tại trước.
- Nếu vẫn lỗi và có model khác, HNL **bắt buộc hỏi OK/Cancel**; chỉ bấm OK mới chuyển.
- Không tự chuyển sang hãng AI khác. Không tự fallback Vision model.
- Đổi nhà cung cấp, đổi model thủ công và “Tự chọn model theo máy” đều có bước xác nhận.
- Bridge giữ HTTP/upstream status (429/503/404...) để phân biệt hết quota, lỗi tạm thời và model không còn khả dụng.
- Giữ toàn bộ Fluid Responsive Layout, Reader Pro, Formula AI Scanner, Model Manager và Full-library RAG của các bản trước.

## v1.9.7 — Windows EXE Build Fix

- Sửa lỗi electron-builder: macro `${target}` không tồn tại trong `artifactName`.
- Tách tên file theo target: `Setup` và `Portable`.
- Workflow Windows tự kiểm tra phải tạo đủ 2 file `.exe` trước khi upload artifact.
- Giữ toàn bộ Fluid Responsive Layout của v1.9.6.

**Dual Edition:** HNL Web + HNL Desktop AI.

## v1.9.3 — Icon Pro & Windows Identity

- Giữ nguyên nhận diện HNL: **HN xanh navy + L bạc**, nền sáng bo góc.
- Tối ưu riêng cho Windows: icon nhỏ rõ hơn, giảm khoảng trống và tăng nét nhẹ.
- `build/icon.ico` chứa nhiều raster size để Windows không phải tự scale từ một ảnh duy nhất.
- Bổ sung `hnl-mark-32.png`, `hnl-mark-48.png`, `hnl-mark-64.png`, `hnl-mark-192.png`, `hnl-mark-512.png` và `favicon.ico`.
- Electron đặt `AppUserModelID = com.hnl.pilestandardsai` để taskbar/shortcut nhận icon nhất quán.
- Metadata build vẫn lấy động từ GitHub Actions như v1.9.2.


## v1.9.2 — Build Metadata & Update Diagnostics

- `package.json` là nguồn duy nhất cho số phiên bản.
- Không ghi cứng ngày/giờ cập nhật trong giao diện.
- Sau khi Vite build thành công, `scripts/generate-build-info.mjs` tạo `dist/build-info.json`.
- Khi build trên GitHub Actions, metadata tự có **Build #, commit SHA, branch, repository, run id, Web/Desktop và thời điểm build**.
- Giao diện hiển thị **thời điểm build của chính artifact đang chạy**, định dạng GMT+7.
- Nếu một GitHub run build/deploy lỗi, bản lỗi không được phát hành nên giao diện vẫn giữ metadata của bản thành công trước đó.
- Có **Kiểm tra cập nhật** qua GitHub Releases và **Sao chép thông tin** để gửi khi báo lỗi.
- Có changelog gần nhất ngay trong Cài đặt.
- Service Worker dùng version từ `package.json` khi đăng ký và luôn network-first cho `build-info.json` / `changelog.json`.
- Artifact Desktop tự mang `v<version>-build-<run_number>`.

## HNL Web

- Deploy bằng `.github/workflows/pages.yml`.
- Build: `npm run build:web`.
- Dùng Gemini / ChatGPT(OpenAI) / Claude / Grok.
- Không hiển thị Ollama trên GitHub Pages để tránh lỗi HTTPS → HTTP.
- Vẫn có Tra cứu nhanh cục bộ không AI.

## HNL Desktop AI

- Build: `npm run dist:win`.
- Tạo NSIS Setup + Portable EXE trong `release/`.
- Có Ollama Offline + AI Online trong cùng ứng dụng.
- Local Bridge, OCR/Vision, embedding/rerank, quét công thức AI, PDF/ZIP/RAR/7Z/thư mục.
- Quản lý model Ollama, dung lượng ổ đĩa, đổi `OLLAMA_MODELS`, tải/xóa/hủy tải model.

## Reader Pro

- PDF liên tục hoặc 1 trang.
- Lazy rendering cho tài liệu dài.
- Kéo/pan bằng chuột, Ctrl + lăn để zoom.
- Ctrl+F tìm trong PDF, thanh trượt trang, PageUp/PageDown/Home/End.
- Focus Reader, panel ẩn/hiện và co giãn.

## Kiểm thử

```bash
npm test
```

v1.9.10 được kiểm tra bằng Version Gate + bộ test tự động; số PASS thực tế xem kết quả `npm test` của source này.

## Build Web

```bash
npm install
npm run build:web
```

Sau build thành công, kiểm tra:

```text
dist/build-info.json
```

## Build Windows EXE

Có thể chạy trên Windows:

```bash
npm install
npm run dist:win
```

Hoặc dùng GitHub Actions → **Build HNL Desktop AI for Windows**.

## Tài liệu

- `docs/RELEASE_V1.9.3.md`
- `docs/RELEASE_V1.9.2.md`
- `docs/BUILD_METADATA.md`
- `docs/BUILD_DESKTOP.md`
- `docs/DUAL_EDITION.md`


## v1.9.5 — Settings Visibility & EXE AutoBuild
- Cài đặt trong panel Trợ lý luôn hiển thị bằng tab grid; có thêm nút ⚙ truy cập nhanh.
- Workflow Windows tự build trên mỗi push vào `main`; artifact chứa Setup + Portable EXE nằm ở Actions > lần chạy `Build HNL Desktop AI for Windows` > Artifacts.


## v1.9.6 — Fluid Responsive Layout
- Desktop panels tự co theo viewport, không tự biến mất.
- 881–980 px vẫn giữ 3 cột ở kích thước tối thiểu hợp lý.
- <=880 px chuyển sang 3 tab Thư viện/PDF/Trợ lý.
- Splitter và kích thước panel đã lưu vẫn hoạt động sau khi resize.

## Kiểm tra v1.9.12
- `npm test`: **58/58 PASS**.
- Version Gate: **PASS**.
- Syntax critical JS/MJS/CJS: **PASS**.
- Xem `docs/FULL_UI_MODEL_AUDIT_V1.9.12.md`.
