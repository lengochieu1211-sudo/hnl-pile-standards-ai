# HNL Pile Standards AI v1.10.1 — Calculation / Version / UI / Function Logic Audit

Ngày audit: 2026-08-24

## Kết luận ngắn

Bản v1.10.0 **không nên giữ nguyên** dù 132/132 test cũ đều PASS. Audit sâu bằng đối chiếu số học và TCVN 7888:2014 phát hiện các lỗi logic mà wiring test không bắt được. Các lỗi đã được sửa trong v1.10.1 và bổ sung regression test.

Kết quả cuối của source v1.10.1:

- `npm test`: **137/137 PASS, 0 FAIL**
- `npm run check:version`: **PASS**
- JS/MJS/CJS syntax: **14/14 PASS**
- JSON parse: **2/2 PASS**
- GitHub Actions YAML parse: **2/2 PASS**
- Secret-like API key scan: **0 hit**
- Search brain `src/search.js`: SHA-256 **f9b65e5e6fb61dcca233a4fe43950e3174c73536f2fa83452da3041fbd0021d2** — giữ nguyên đúng lõi v1.9.23
- Web build trong môi trường audit: **CHƯA PASS** vì ZIP không có `node_modules`; `vite: not found` (exit 127)

## 1. Logic tính toán — lỗi tìm thấy và đã sửa

### 1.1 Lỗi đơn vị Phụ lục B có thể lệch 1.000 lần

Thư viện công thức xác minh B.1–B.5 trước đây lưu biểu thức theo dạng `MPa × mm²` nhưng calculator động hiển thị trực tiếp số thô.

Về thứ nguyên:

- `1 MPa = 1 N/mm²`
- `MPa × mm² = N`
- TCVN yêu cầu kết quả `Ra` theo `kN`

Do đó phải chia 1000 trước khi hiển thị/lưu kết quả kN.

Đã sửa:

- B.1–B.5 có `variableUnits`, `outputUnit`, `resultScale`.
- `resultScale = 0.001` cho các công thức sức chịu tải từ MPa × mm².
- Calculator động lưu cả `rawValue`, `resultScale`, `outputUnit` để trace.
- UI hiện đơn vị từng biến và đơn vị kết quả.

Benchmark D600, t=90 mm, σcu=80 MPa, σce=8 MPa, PHC/NPH α=3,5:

- `A0 = 144199.1027997715 mm²`
- Calculator chuyên dụng: `3007.581286966663 kN`
- Công thức động B.4 sau sửa: `3007.581286966663 kN`
- Sai khác: `0`

### 1.2 NPH trước đây bị gộp với PHC

v1.10.0 dùng lựa chọn `PHC / NPH` và danh sách A/AB/B/C chung. Điều này có thể cho NPH cấp AB dù TCVN 7888:2014 quy định NPH chỉ A/B/C theo Bảng 2.

Đã sửa:

- Tách `PC`, `PHC`, `NPH` thành 3 lựa chọn độc lập.
- NPH chỉ có A/B/C.
- Không tự nạp Bảng 1 cho NPH.
- UI ghi rõ: PC/PHC dùng Bảng 1; NPH dùng Bảng 2.
- Nếu metadata/history cũ cố đưa NPH + AB vào calculator thì chặn bằng validation.

### 1.3 Liên kết nguồn của lịch sử tính còn yếu

Đã tăng metadata lịch sử cho Máy tính TCVN 7888:

- `docId`
- tiêu chuẩn
- Phụ lục B
- trang nguồn
- công thức B.2/B.3 hoặc B.4/B.5
- giới hạn `Pmax ≤ 80% RaShort`
- Bảng 1/Bảng 2 tương ứng

Mục tiêu: mở lại phép tính có thể truy ngược nguồn thay vì chỉ thấy một con số.

### 1.4 AI/Vision formula gate có đường bypass metadata cũ

Logic cũ cho phép `allowCompute=true` làm công thức AI trở thành computable dù `verified=false`. Các bản hiện tại tự tạo `allowCompute=false`, nhưng dữ liệu cũ/import có thể mang metadata khác.

Đã sửa cứng:

- Công thức AI/Vision **chỉ computable khi `verified=true`**.
- `allowCompute` cũ không còn đủ để bypass.
- `verified=true` chỉ được đặt sau hộp xác nhận người dùng đã đối chiếu trang PDF gốc.

### 1.5 Những phần tính đã kiểm và giữ

- `annulusAreaMm2()` kiểm D/t hợp lệ và tính diện tích vành khuyên.
- `axialResistance()` đổi N → kN đúng bằng `/1000`.
- PC dùng `α=4`; PHC/NPH dùng `α=3,5`.
- Ngắn hạn = 2 × dài hạn.
- Giới hạn làm việc tối đa hiển thị = 80% ngắn hạn.
- σce mặc định theo cấp A/AB/B/C = 4/6/8/10 MPa; NPH không có AB.
- σcu mặc định: PC 60 MPa; PHC/NPH 80 MPa.
- Đổi đường kính không tự ghi đè σcu/σce người dùng đã nhập; đổi loại/cấp mới cập nhật default hợp lý.

### 1.6 Hạn chế cố ý với Bảng 2 NPH

Source hiện không hard-code toàn bộ số liệu Bảng 2 NPH. HNL **không suy đoán** và không lấy Bảng 1 thay thế. Người dùng nhập D/t/σce từ Bảng 2 hoặc mở nguồn để đối chiếu. Đây là lựa chọn an toàn hơn việc tự điền dữ liệu chưa được benchmark đầy đủ.

## 2. Đồng bộ version / build

Nguồn version chính: `package.json = 1.10.1`.

Version Gate hiện kiểm:

- package.json
- README current heading
- `public/changelog.json`
- `docs/RELEASE_V1.10.1.md`
- `docs/BUILD_METADATA.md`
- runtime UI version token
- Service Worker registration có version
- Service Worker cache derive từ version
- Windows Setup/Portable artifact template dùng `${version}`
- không hard-code current SemVer trong release summary runtime
- direct dependencies/devDependencies không dùng `^`, `~`, `*`, `latest`

Các release note v1.10.0/v1.9.x còn trong docs/changelog là **lịch sử**, không phải version runtime hiện hành.

Direct dependencies đã pin exact để giảm trôi build. Tuy nhiên chưa có `package-lock.json` vì npm registry timeout trong môi trường audit; workflow hiện vẫn phải dùng `npm install`. Khi có máy/runner truy cập npm ổn định, nên commit lockfile rồi đổi workflow sang `npm ci` để reproducible hơn.

## 3. Logic giao diện / responsive

### 3.1 Bố cục 3 panel

Desktop >880px không tự ẩn panel. Panel chỉ mất khi người dùng collapse hoặc Focus Reader; có nút recovery để mở lại.

Các profile CSS chính:

- 1366px: thu panel trái/phải, giữ PDF đủ rộng.
- 1180–981px: panel co tiếp, PDF min 320px.
- 980–881px: trái 215px, phải 290px, PDF min 300px.
- <=880px: chuyển sang mobile/tablet navigation.

Vì vậy tại Windows scale cao, layout được thiết kế theo CSS viewport/DIP thay vì ép kích thước pixel cố định.

### 3.2 PDF toolbar

Toolbar dùng container query theo **chiều rộng thật của viewer**:

- <=1050px: title/search + control row riêng.
- <=620px: title/search/control thành 3 hàng.
- <=470px: nhóm mode/page/zoom/layout wrap theo nhóm, không đè nhau.

### 3.3 AI tabs / Settings

Assistant dùng container query:

- mặc định 4 cột
- panel <=390px: 3 cột
- <=315px: 2 cột

Tab Cài đặt không phụ thuộc overflow ngang.

### 3.4 State/UI consistency

Các control trạng thái quan trọng có một nguồn điều khiển chính:

- `providerSelect`: 1
- `modelInput`: 1
- `nativePdfModeInput`: 1
- `assistantSettingsSummary`: 1
- `strictSide`: 1
- `cType`: 1
- `cClass`: 1

Một số ID xuất hiện nhiều lần trong source (`pdfScroll`, `pageRange`, `aiChecklist`, `refreshLocalModelManager`) nhưng nằm ở các nhánh render loại trừ nhau, không đồng thời tồn tại trong DOM.

UI State Guard tiếp tục bảo toàn PDF page/scroll, panel scroll, library scroll và focus qua render cần thiết.

## 4. Logic chức năng / nút / liên kết

Đã chạy lại test delegated handlers cho các nhóm:

- Thư viện/import/folder/archive/source/remove/filter/pin
- PDF search/result navigation/continuous/single-page/zoom/page/AI/focus/select/OCR
- Provider/model/refresh/settings/test connection
- Hỏi đáp/Tra cứu/Tính/So sánh/Nghiệm thu
- Formula scan theo scope/AI verify/calculate
- Offline AI/model manager/download/cancel
- History/backup/diagnostic/workspace/bookmark/note
- Citation → đúng tài liệu/trang

Enter-to-send, empty-input feedback, dynamic controls và delegated event handler đều có regression test.

## 5. Search/RAG không bị thay

`src/search.js` vẫn đúng hash v1.9.23 đã chứng minh tìm được “cọc chống”. Bản audit này **không sửa search brain**.

Golden tests vẫn gồm:

- `cọc chống là gì`
- TOC `cọc chống ... 28`
- `cọc ma sát`
- Phụ lục ở cuối tài liệu
- immutable search brain hash

## 6. Những gì chưa thể xác nhận runtime thật

Không đánh dấu PASS cho các mục sau:

- `npm run build:web`: hiện FAIL `vite: not found` vì ZIP không có `node_modules`.
- Setup/Portable EXE thực tế trên Windows.
- Windows Scale 100/125/150 bằng trình duyệt/Electron thật; hiện mới kiểm code/CSS + regression tĩnh.
- Gemini/OpenAI live với API key thật.
- Ollama download model nhiều GB.
- RAR/7Z/password trên Windows thật.

## 7. Các file sửa chính

- `src/calculators.js` — giữ calculator chuyên dụng chuẩn kN.
- `src/formulas.js` — unit metadata, result scaling, strict AI verification gate.
- `src/tcvn7888.js` — class theo loại cọc; NPH loại AB.
- `src/main.js` — UI PC/PHC/NPH, source linkage, unit-safe dynamic calculator.
- `tests/core.test.mjs`
- `tests/wiring.test.mjs`
- `scripts/check-version-sync.mjs`
- `package.json`
- `README.md`
- `public/changelog.json`
- `docs/BUILD_METADATA.md`
- `docs/RELEASE_V1.10.1.md`

## 8. Kết luận

v1.10.1 an toàn hơn đáng kể về logic tính so với v1.10.0. Điểm quan trọng nhất là test cũ PASS không còn được dùng làm bằng chứng duy nhất: bản này đã thêm benchmark số học/đơn vị và guard tiêu chuẩn để bắt các lỗi kiểu 1.000× hoặc chọn cấp tải sai.
