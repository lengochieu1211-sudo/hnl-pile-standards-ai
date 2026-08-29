# HNL v1.27.0 — P3 Region Selective OCR · SHADOW ONLY

## Mục tiêu

P3 không OCR toàn bộ PDF. HNL chỉ xử lý đúng vùng người dùng chọn hoặc vùng được engine đánh dấu cần OCR.

Luồng khóa:

`Vùng chọn → PDF.js native text → DeepDoc/VietOCR (Desktop, nếu có) → Chromium local OCR (fallback cục bộ) → Vision fallback (chỉ khi caller chủ động cung cấp) → provenance page+bbox`

## Quy tắc an toàn

- `promotionState = SHADOW_ONLY`.
- `productionMutationAllowed = false`.
- Không ghi kết quả P3 vào Calculation Engine, Search Brain hoặc dữ liệu VERIFIED.
- Native text đủ chất lượng thì **không gọi OCR**.
- DeepDoc/VietOCR chỉ nhận **ảnh crop của vùng**, không nhận cả trang trong P3.
- Score `1.0` hiện tại của VietOCR trong repo tham khảo là synthetic; HNL luôn đặt confidence hiệu lực = `null`.
- Vision không tự gọi mạng. Chỉ chạy khi caller truyền `visionRegionOcr` rõ ràng.
- Thiếu DeepDoc/Python/model/Git LFS phải fallback có kiểm soát, không crash.

## Provenance

Mỗi kết quả vùng giữ:

- PDF fingerprint.
- Số trang.
- `pageRectCss`.
- `normalizedBbox` 0..1.
- engine/route thực tế.
- quality gate.
- crop dimensions.
- confidence chỉ khi nguồn thật sự có confidence dùng được.

BBox của từng OCR line từ ảnh crop được map ngược về tọa độ trang để sau này nối Điều/Bảng/Công thức.

## Thành phần P3

- `src/pdf-intelligence/region-selective-core.js`: quality/routing/provenance thuần JS.
- `src/pdf-intelligence/region-selective-ocr.js`: browser shadow orchestrator, tái sử dụng crop/text-layer/local OCR hiện có trong `src/pdf.js`.
- `src/pdf-intelligence/deepdoc-region-bridge.js`: Node/Desktop bridge cho ảnh vùng.
- `src/pdf-intelligence/deepdoc-vietocr-adapter.js`: thêm `processRegionImage()`; không bundle source/model DeepDoc.
- `scripts/pdf-intelligence-region-golden.mjs`: Golden deterministic 11 case.
- `.github/workflows/v127-pdf-intelligence-shadow.yml`: certification Linux + Windows riêng cho shadow engine.

## Promotion gate

P3 chỉ được chuyển từ SHADOW sang REVIEW/VERIFIED khi có benchmark PDF TCVN thật chứng minh:

1. native region không regression;
2. scan Vietnamese tốt hơn pipeline cũ;
3. bảng/công thức không làm sai số liệu;
4. bbox map đúng khi zoom/crop;
5. không OCR thừa khi native text đã usable;
6. Web/Desktop fallback an toàn;
7. Search Brain v1.9.23 và Calculation Engine không thay đổi.
