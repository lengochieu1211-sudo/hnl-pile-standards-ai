# HNL Pile Standards AI v1.9.17 — Full Fix Audit

Nguồn audit: ZIP người dùng cung cấp `HNL-Pile-Standards-AI-v1.9.16-PC-AI-Key-RAR-PDF-Selection-FullFix(1).zip`.

Nguyên tắc: chỉ kết luận theo code trong ZIP này; không lấy source/version cũ làm nguồn sửa.

## Kết quả tổng quan

- Version cuối: **1.9.17**.
- `npm run check:version`: **PASS**.
- `npm test`: **79/79 PASS, 0 FAIL**.
- `node --check` toàn bộ JS/MJS/CJS trong `src`, `bridge`, `electron`, `scripts`, `tests`: **PASS**.
- YAML `.github/workflows/desktop-win.yml` và `pages.yml`: parse **PASS**.
- Audit nút: mọi button có `id` literal đều có delegated handler; dynamic `data-*` quan trọng có handler regression test.
- Secret scan: không thấy Gemini/OpenAI/Claude/Grok key thật hard-code; `.env.web/.env.desktop` chỉ chứa edition; không thấy log API key/request body.
- Icon `build/icon.ico`: có các size 16/20/24/32/40/48/64/128/256, 4 góc transparent; vùng logo gần đầy canvas, không dư viền trắng lớn.

## Lỗi tìm thấy và đã sửa

### 1. Gemini/API key Desktop: Test OK nhưng Chat báo chưa có key

**Root cause:** Bridge đã có cơ chế nhận key phiên, nhưng UI key chỉ hiện theo nhánh Direct; nguồn key giữa draft/settings/session/Bridge chưa được thống nhất đủ cho mọi hành động. Vì vậy có thể kiểm tra kết nối theo một nguồn nhưng Chat/Refresh Models đọc nguồn khác.

**Sửa:**
- Thêm bộ nhớ key theo provider trong renderer (`volatileApiKeys`) + `sessionStorage`.
- `currentApiKey(provider)` là nguồn đọc chung.
- `setCurrentApiKey(provider, value)` là nguồn ghi chung.
- Cả Direct và Bridge đều cho nhập key phiên; Bridge chỉ fallback key cấu hình nếu ô phiên trống.
- Test Connection, Models API và Chat dùng cùng key hiện hành.
- Không ghi key vào log hoặc source/GitHub.

### 2. Gemini model catalog / không tự chuyển model

**Lỗi:** catalog fallback có trường hợp chỉ hiện lỗi API thô nên không luôn nói rõ danh sách chưa được xác minh. Vision/Embedding chưa có đầy đủ cùng quy tắc retry → hỏi OK → mới chuyển.

**Sửa:**
- Khi không xác minh được luôn có câu **“Không xác minh được danh sách model”**.
- Gemini Models API vẫn đọc phân trang `pageToken`, lọc `supportedGenerationMethods` có `generateContent`, rồi loại image/TTS/live/embedding khỏi picker chat chính.
- Text/Vision/Embedding đều retry model hiện tại trước; chỉ đề nghị model khác đã phù hợp/đã cài và chỉ đổi sau **OK**.
- Không tự đổi provider.

### 3. PDF Select Text + Smart Region OCR chưa đúng local-first

**Root cause:** source đã có crop vùng chọn nhưng một số nhánh gửi thẳng crop sang Vision AI; chưa ưu tiên text layer/local OCR đầy đủ; thiếu action menu hoàn chỉnh cho text/region.

**Sửa pipeline:**
1. Kéo đúng vùng cần đọc.
2. Nếu giao với text layer → lấy text trực tiếp.
3. Nếu không đủ text → crop đúng vùng, tối đa khoảng 1.8 MP.
4. Thử OCR local bằng Chromium `TextDetector` nếu runtime có.
5. Nếu OCR local không đủ mới hỏi xác nhận có gửi **crop vùng chọn** sang Vision AI hay không.
6. Trả text cho Copy/Hỏi AI/Tra cứu/Tóm tắt/Dùng làm nguồn/Tìm toàn thư viện.

**Formula vùng:** giữ crop + số trang + rect nguồn; tạo trạng thái `verified:false`, `allowCompute:false`, không tự cho calculator chính thức dùng.

### 4. Archive Desktop / RAR / nested path

**Root cause:**
- ZIP mã hóa trên Desktop có thể đi nhánh Web thay vì Local Bridge.
- Rebuild đường dẫn theo basename có thể đụng tên khi nhiều thư mục chứa file cùng tên, làm mất source path.
- Nested archive chưa mở rộng đủ.
- Thứ tự extractor chưa khớp yêu cầu ưu tiên.

**Sửa:**
- Desktop/localhost route archive qua Bridge, gồm ZIP khi cần engine local.
- Giữ `internalPath`/`sourcePath` đầy đủ, không map theo basename.
- Recursive nested archive có giới hạn depth để tránh vòng lặp/tải nặng.
- Thứ tự: **7-Zip → WinRAR/UnRAR → Windows tar → HNL Built-in RAR**.
- Thêm `/api/local/archive-engines` và card chẩn đoán trong Cài đặt.
- Lỗi password/thiếu engine báo rõ, không fail im lặng; có nút mở hướng dẫn 7-Zip.

### 5. Desktop startup / HNL Bridge

**Root cause:** Electron ẩn/nạp UI sau khi chờ Bridge; health của Bridge có thể đợi Ollama, khiến máy chưa cài Ollama trông như app chết.

**Sửa:**
- UI load trước; Bridge/Ollama kiểm tra nền.
- Nếu Bridge lỗi, UI vẫn mở và AI Online/Local Search không crash theo `spawn ollama ENOENT`.
- Bridge health trả nhận dạng HNL nhanh, không await Ollama.
- Port fallback mở rộng 8787–8799.
- Xác minh đúng service HNL Bridge, không chỉ “có HTTP server”.
- Bridge bind `127.0.0.1`; CORS chỉ cho local/configured origin, đồng thời cho `Origin: null` của Electron `file://` fallback.

### 6. Offline AI disk/install safety

**Lỗi:** đã có progress/cancel/model folder nhưng trước khi tải gói chưa chặn rõ theo dung lượng dự phòng.

**Sửa:**
- Ước tính dung lượng model và cộng reserve.
- Đọc dung lượng trống từ Model Manager trước pull.
- Nếu không đủ dung lượng thì không tải.
- Hiện dung lượng dự kiến + dung lượng trống và câu xác nhận; chỉ bấm OK mới tải.
- Thiếu Ollama không làm app crash; vẫn giữ cài Ollama, model packages, progress và cancel.

### 7. RAG: câu thiếu căn cứ

Chuẩn hóa no-hit/local/prompt về câu bắt buộc:

**“Không tìm thấy đủ căn cứ trong các tài liệu đang chọn.”**

Deep/balanced retrieval, scope hiện tại/được chọn/toàn thư viện, citation và adjacent-page logic cũ được giữ; regression suite hiện vẫn PASS.

## UI / responsive audit

Code hiện có:
- desktop 3 vùng, panel resize/collapse/recovery;
- Focus Reader có recovery;
- mobile/tab chỉ dưới `880px`;
- PDF Viewer dùng `container-type:inline-size`, toolbar wrap theo vùng PDF thực (`@container viewer`);
- Assistant dùng `@container assistant`: tabs 4 cột → 3 cột ở panel <=390px → 2 cột <=315px;
- Settings nằm trong grid và không dựa vào horizontal scroll để tồn tại;
- panel desktop được budget/co trước khi làm PDF quá hẹp; không auto-hide chỉ vì resize.

**Giới hạn test:** chưa thể render thật Windows 1366x768 ở Scale 100/125/150 trong container Linux; đây là static CSS/logic audit + regression test, không phải screenshot test Windows thật.

## PDF.js

Source dùng:
- `pdfjs-dist/legacy/build/pdf.mjs`
- `pdfjs-dist/legacy/build/pdf.worker.mjs?url`
- có xử lý/de-duplicate lỗi render.

Giữ cấu hình này để tránh lỗi Electron/Chromium kiểu `getOrInsertComputed is not a function`.

**Giới hạn test:** chưa chạy render PDF thật bằng Electron vì dependencies không cài được trong môi trường audit.

## Windows build/workflow

`.github/workflows/desktop-win.yml` được parse thành công và có chuỗi:

1. Install
2. Version Gate
3. Test
4. Validate electron-builder config
5. Build NSIS + Portable
6. Verify cả Setup + Portable
7. Upload artifact

Artifact config:
- `HNL-Pile-Standards-AI-Setup-${version}-${arch}.${ext}`
- `HNL-Pile-Standards-AI-Portable-${version}-${arch}.${ext}`

Không dùng `${target}` trong `win.artifactName` active config.

## Những gì chưa thể test thực tế trong môi trường này

1. `npm run build:web`: **không chạy được** vì ZIP không kèm `node_modules`; `vite: not found`.
2. Đã thử cài dependencies từ registry nhiều lần nhưng kết nối registry timeout, nên không giả báo Vite build PASS.
3. Windows Setup/Portable EXE: container là Linux và chưa có dependencies, nên chưa build/run installer thật.
4. Gemini/OpenAI/Claude/Grok thật: không có API key người dùng trong source (đúng yêu cầu bảo mật), nên chưa gọi tài khoản thật.
5. Ollama thật + download model nhiều GB: không cài/tải trong môi trường audit.
6. RAR/7Z password/Unicode trên Windows thật: container không có 7-Zip/UnRAR và `node_modules`; chỉ audit routing/error/engine logic + tests.
7. Shortcut/Start Menu icon sau cài đặt và Windows Scale 100/125/150: cần runner/máy Windows thật để xác nhận bằng mắt.

## File thay đổi so với ZIP v1.9.16 người dùng gửi

- `README.md`
- `package.json`
- `public/changelog.json`
- `docs/BUILD_METADATA.md`
- `docs/RELEASE_V1.9.17.md` (mới)
- `docs/FULL_FIX_AUDIT_V1.9.17.md` (mới)
- `src/main.js`
- `src/ai.js`
- `src/pdf.js`
- `src/ingest.js`
- `src/search.js`
- `src/styles.css`
- `bridge/server.mjs`
- `electron/main.cjs`
- `tests/wiring.test.mjs`

## Kết luận

Bản source được nâng lên **v1.9.17**. Tất cả test có thể chạy không cần dependencies ngoài hiện tại đều PASS (**79/79**), Version Gate PASS, syntax PASS. Build Web/Windows và các tích hợp cần engine/API/hardware thật được ghi rõ **chưa xác nhận thực tế**, không báo PASS giả.
