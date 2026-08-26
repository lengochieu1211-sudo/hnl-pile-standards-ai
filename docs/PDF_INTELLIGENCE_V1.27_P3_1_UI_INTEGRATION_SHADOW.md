# HNL v1.27.0 — P3.1 UI Integration Shadow

## Trạng thái

`SHADOW_ONLY` — không thay thế luồng PDF/OCR hiện tại của v1.26, không ghi kết quả Shadow vào Search Brain, Calculation Engine hoặc trạng thái VERIFIED.

## Mục tiêu

Nối P3 Region Selective OCR vào **đúng PDF viewer thật** mà người dùng đang kéo vùng. P3.1 quan sát vùng chọn và popup kết quả hiện tại, chạy pipeline Shadow song song rồi hiển thị ngay trong popup:

`PDF.js Native → DeepDoc/VietOCR (Desktop nếu có) → Chromium Local OCR → Vision đã được người dùng cho phép ở luồng hiện tại`

## Quyết định kiến trúc

P3.1 **không sửa `src/main.js` và không sửa `bridge/server.mjs`**. Đây là chủ ý để bảo vệ Production baseline:

- `index.html` nạp thêm một module Shadow độc lập.
- Module Shadow nghe thao tác `pointerup` trên `.pdf-region-layer` thật và đọc `_hnlSource` của popup vùng hiện tại.
- Nếu luồng hiện tại đã dùng Vision sau khi người dùng xác nhận, Shadow chỉ **tái sử dụng text Vision đã có**; không gửi ảnh lần thứ hai.
- DeepDoc/VietOCR chạy qua localhost Shadow service riêng, mặc định `base bridge port + 1000` (8787→9787 ... 8799→9799).
- Electron dùng `server-v127-shadow.mjs` làm wrapper: khởi động `bridge/server.mjs` nguyên trạng và khởi động thêm Shadow service. Nếu Shadow service lỗi/port bận/missing model, Production Bridge vẫn chạy bình thường.
- `electron/main.cjs` có fallback về `bridge/server.mjs` nếu wrapper không tồn tại.
- `package.json` chỉ bổ sung đúng 3 module Node P3 cần cho EXE: `contracts.js`, `deepdoc-vietocr-adapter.js`, `deepdoc-region-bridge.js`; không đóng gói toàn bộ `src/`.

## UI

Sau khi kéo vùng và luồng hiện tại tạo popup, P3.1 thêm một khối:

- `SHADOW P3.1`
- engine Shadow được chọn: `PDF.js Native`, `DeepDoc/VietOCR`, `Local OCR`, `Vision` hoặc `BLOCK`
- `KHÔNG GHI PRODUCTION`
- engine của luồng UI hiện tại
- provenance `P.<trang> · bbox [x1,y1,x2,y2]` chuẩn hóa 0..1
- chuỗi engine đã thử
- đối chiếu text `TRÙNG` hoặc `KHÁC · REVIEW`
- text Shadow có thể mở/copy để kiểm tra thủ công

Không hiển thị score 1.0 synthetic của VietOCR như confidence thật.

## DeepDoc runtime

Shadow service chỉ bind `127.0.0.1` và chỉ nhận origin localhost/file. Nó gọi `runDeepDocRegionOcr` từ P3, do đó vẫn tuân thủ:

- `HNL_DEEPDOC_HOME` là external clone;
- không bundle third-party code/model;
- missing Python/dependency/model/Git LFS → `available:false` có kiểm soát;
- kết quả DeepDoc có `recognizerConfidenceUsable=false`.

## Golden / CI

Workflow `v1.27 PDF Intelligence Shadow Certification` chạy Linux + Windows và thêm:

- syntax P3.1;
- static integration selftest 22 case;
- runtime smoke chứng minh Production Bridge + Shadow service cùng khởi động và missing DeepDoc fallback có kiểm soát;
- `npm run build:web` để chứng minh module Shadow không phá browser boundary;
- toàn bộ P0/P2/P3 Golden cũ vẫn phải PASS.

Ngoài workflow Shadow, các release-critical workflow v1.26 vẫn phải xanh để chứng minh không regression.

## Promotion rule

P3.1 vẫn chưa được PROMOTED. Bước kế tiếp sau CI xanh là chạy **P3.2 Real PDF UI Golden** trên bộ PDF TCVN thật: native, scan tiếng Việt, mixed page, table, equation, zoom, multi-page và missing DeepDoc runtime. Chỉ sau benchmark thực mới cân nhắc `BENCHMARKED → REVIEW`.
