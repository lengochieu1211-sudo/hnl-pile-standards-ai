# HNL Pile Standards AI v1.10.2 — Runtime Acceptance Audit

Ngày audit: 2026-08-24

## Kết luận

Vòng acceptance tiếp theo trên source v1.10.1 đã phát hiện thêm các lỗi logic thực tế dù 137/137 test cũ đều PASS. Source đã được sửa và nâng thành **v1.10.2**.

Kết quả cuối:

- `npm test`: **142/142 PASS, 0 FAIL**
- `npm run check:version`: **PASS**
- JS/MJS/CJS syntax: **19/19 PASS**
- JSON parse: **3/3 PASS**
- GitHub Actions YAML parse: **2/2 PASS**
- Secret-like API key scan: **0 hit**
- Search brain `src/search.js`: SHA-256 **f9b65e5e6fb61dcca233a4fe43950e3174c73536f2fa83452da3041fbd0021d2** — không đổi so với lõi v1.9.23
- Web build trong môi trường audit: **CHƯA PASS** vì source không có `node_modules`; `vite: not found` (exit 127)

## 1. Lỗi mới phát hiện và đã sửa

### 1.1 NPH mới chỉ bị chặn Bảng 1 nhưng chưa có Bảng 2 thực

v1.10.1 ngăn NPH dùng nhầm Bảng 1, nhưng người dùng vẫn phải nhập tay D/t/σce. Vòng này đã đối chiếu trực tiếp **Bảng 2, trang 12, TCVN 7888:2014** và bổ sung dữ liệu NPH:

- các đường kính thân D: 300, 400, 450, 500, 600, 700, 800, 900, 1000 mm;
- ký hiệu Dk-D;
- Dk,max;
- chiều dày thành cọc t;
- kích thước đốt;
- cấp A/B/C;
- mômen uốn nứt;
- ứng suất hữu hiệu;
- khả năng bền cắt;
- provenance: `Bảng 2`, trang 12.

NPH vẫn **không có cấp AB**. Calculator dùng `lookupPileType7888()` để chọn đúng Bảng 1 cho PC/PHC và Bảng 2 cho NPH.

### 1.2 Nhận diện “Verified” trước đây quá rộng

Logic cũ có thể coi tên file chỉ chứa `7888` là đủ để bật calculator/công thức Verified. Điều này có nguy cơ nhận nhầm:

- `TCVN 7888:2008.pdf`;
- `notes-7888.pdf`;
- tài liệu tham khảo chỉ nhắc tới 7888.

v1.10.2 dùng `isTcvn7888_2014Document()`:

- chấp nhận metadata/tên xác nhận rõ `TCVN 7888:2014`;
- hoặc text đầu PDF xác nhận rõ edition 2014;
- không chấp nhận bare `7888`;
- không chấp nhận bản 2008.

Cả calculator và `verifiedFormulaLibrary()` dùng cùng guard này.

### 1.3 Dữ liệu calculator có thể mất qua full-render

Đã thêm `state.calcDraft`, `ensureCalcDraft()` và `syncCalcDraftFromDom()` để giữ:

- loại cọc;
- cấp tải;
- D/t;
- σcu/σce;
- nguồn Bảng 1/Bảng 2;
- trang bảng;
- ký hiệu NPH Dk-D.

Khi người dùng sửa tay D/t/σce, provenance bảng bị xóa và lịch sử ghi **“Nhập tay”**, tránh citation sai.

### 1.4 Lịch sử tính thiếu đường quay về nguồn

Lịch sử calculator giờ lưu và hiển thị:

- `docId`;
- TCVN;
- Phụ lục B;
- trang công thức;
- B.2/B.3 hoặc B.4/B.5;
- `Pmax ≤ 80% RaShort`;
- Bảng 1/Bảng 2 hoặc Nhập tay;
- `tablePage`;
- ký hiệu NPH.

Có nút mở trực tiếp trang công thức nguồn bằng cơ chế citation hiện có.

### 1.5 Điều kiện cường độ bê tông của Phụ lục B chưa bị khóa

Đây là lỗi logic được phát hiện ở vòng rà thứ hai của chính acceptance này.

TCVN 7888:2014 quy định:

- PC: cường độ nén bê tông không thấp hơn **60 MPa**;
- PHC/NPH: không thấp hơn **80 MPa**.

v1.10.1 vẫn cho nhập σcu thấp hơn các ngưỡng này rồi tính.

v1.10.2 sửa ở cả hai đường tính:

1. Calculator chuyên dụng chặn PC nếu `σcu < 60 MPa`, PHC/NPH nếu `σcu < 80 MPa`.
2. Công thức Verified B.2–B.5 có `inputMinimums.sigmaCu`; dynamic calculator kiểm guard trước khi evaluate.

## 2. Benchmark số học

Acceptance case NPH 800-600, thân D600, cấp B:

- Bảng 2: `D = 600 mm`, `Dk = 800 mm`, `t = 90 mm`, `σce = 8 MPa`;
- `σcu = 80 MPa`;
- `A0 = 144199.1027997715 mm²`;
- calculator chuyên dụng B.4: `3007.581286966663 kN`;
- dynamic Verified B.4: `3007.581286966663 kN`;
- sai khác: **0**.

Guard edition:

- `TCVN 7888:2014.pdf` → true;
- `TCVN 7888:2008.pdf` → false;
- `notes-7888.pdf` → false.

## 3. RAG / “cọc chống”

Không sửa `src/search.js`.

Golden tests vẫn PASS:

- `cọc chống`;
- `cọc chống là gì`;
- TOC `cọc chống ... 28`;
- `cọc ma sát`;
- Phụ lục ở cuối tài liệu;
- immutable search hash.

Hash search brain:

`f9b65e5e6fb61dcca233a4fe43950e3174c73536f2fa83452da3041fbd0021d2`

## 4. UI / state / chức năng

Regression tiếp tục kiểm:

- tất cả critical visible buttons có delegated handler;
- citation nhảy PDF;
- OCR vùng không full-render làm nhảy trang;
- Test API không kéo Settings lên đầu;
- Native PDF mode không tự quay về Cân bằng;
- Provider/model chỉ một nguồn điều khiển;
- responsive 3 panel tới ngưỡng 880 px;
- assistant tabs và PDF toolbar dùng container responsive;
- history/workspace/backup/diagnostic;
- Offline Ollama readiness/cancel;
- archive password/Bridge wiring;
- calculation source links và calcDraft.

Literal control quan trọng hiện chỉ có một ID trong source template:

- `providerSelect`: 1
- `modelInput`: 1
- `nativePdfModeInput`: 1
- `assistantSettingsSummary`: 1
- `strictSide`: 1
- `cType`: 1
- `cClass`: 1
- `cDiameter`: 1
- `calcFill7888`: 1
- `calcBtn`: 1

Các literal ID còn lặp (`pdfScroll`, `pageRange`, `aiChecklist`, `refreshLocalModelManager`) nằm ở nhánh render loại trừ nhau/biến thể trạng thái, không phải hai nguồn state độc lập.

## 5. Version / build / bảo mật

Nguồn version chính: `package.json = 1.10.2`.

Version Gate PASS cho:

- package.json;
- README;
- changelog;
- release note;
- build metadata;
- Service Worker;
- Windows artifact templates.

Không phát hiện key thật theo các pattern phổ biến Google/OpenAI/Anthropic/GitHub. `.env.web` và `.env.desktop` chỉ chứa edition; `bridge/.env.example` chỉ có placeholder rỗng.

## 6. Những gì chưa thể xác nhận runtime thật

Không đánh dấu PASS cho:

- `npm run build:web`: **FAIL `vite: not found`** vì source không kèm `node_modules`;
- chưa có `package-lock.json` do môi trường audit không tải được npm dependency ổn định;
- Setup/Portable EXE chạy thật trên Windows;
- Windows Scale 100/125/150 bằng Electron thực;
- Gemini/OpenAI live bằng API key thật;
- Ollama tải model nhiều GB;
- RAR/7Z/password trên Windows thật;
- thao tác chuột thật trên PDF dài/scan trong browser/Electron.

Workflow Windows vẫn giữ Version Gate → Test → Build Desktop → Verify Setup → Verify Portable → Smoke Test Portable → Upload; xác nhận thực tế phải chạy trên GitHub Windows runner.

## 7. File thay đổi so với v1.10.1

- `src/tcvn7888.js`
- `src/formulas.js`
- `src/main.js`
- `tests/core.test.mjs`
- `tests/wiring.test.mjs`
- `package.json`
- `README.md`
- `public/changelog.json`
- `docs/BUILD_METADATA.md`
- `docs/RELEASE_V1.10.2.md`
- `docs/FULL_AUDIT_V1.10.2.md`

## 8. Kết luận phát hành

v1.10.2 an toàn hơn v1.10.1 ở 4 điểm quan trọng: **NPH có Bảng 2 thật, Verified đúng edition, calculator giữ state/provenance, và điều kiện cường độ bê tông Phụ lục B bị khóa trước khi tính**. Search brain v1.9.23 không bị đụng tới.
