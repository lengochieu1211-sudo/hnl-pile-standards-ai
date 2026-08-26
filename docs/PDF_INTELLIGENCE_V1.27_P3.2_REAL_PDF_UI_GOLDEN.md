# HNL v1.27.0 — P3.2 Real PDF UI Golden · SHADOW ONLY

## Phạm vi

P3.2 dùng chính PDF TCVN người dùng đã nhập vào HNL để benchmark thao tác kéo vùng thật. Repo **không chứa PDF tiêu chuẩn**. Corpus chỉ giữ alias tài liệu, trang gợi ý, loại case và anchor ngắn để kiểm tra.

Ba tài liệu corpus:
- TCVN 10304:2025 — khoảng 124 trang.
- TCVN 5574:2018 — khoảng 193 trang.
- TCVN 7888:2014 — khoảng 36 trang.

## 9 case

1. 10304 scan/weak-text tiếng Việt — discovery trên vùng thật.
2. 10304 Bảng 1 RQD/Ks — trang gợi ý 29.
3. 10304 CT (9) — trang gợi ý 31.
4. 10304 Phụ lục C C.2/C.3 — trang gợi ý 108.
5. 10304 SPT Phụ lục D — hai run ở 110 và 111.
6. 5574 Bảng 10 — hai run cùng vùng ở hai zoom khác nhau; normalized bbox IoU ≥ 0,70.
7. 5574 CT (155) / Bảng 17 — trang gợi ý 96/98 do khác biệt trang in/PDF.
8. 7888 Bảng 1 — trang gợi ý 10/11.
9. 7888 Phụ lục B B.4/B.5 — trang gợi ý 32/33.

## Cách chạy

- Mở HNL trên Web hoặc Desktop và nhập 3 PDF thật.
- Nhấn `Ctrl+Shift+G` để bật panel **P3.2 REAL PDF GOLDEN**. Có thể mở bằng query `?pdfgolden=1`.
- Chọn case trong panel.
- Dùng công cụ OCR vùng đang có của HNL và kéo đúng vùng yêu cầu.
- P3.2 ghi song song: PDF.js Native, DeepDoc/VietOCR nếu Desktop runtime có, Chromium TextDetector nếu có, và Vision **chỉ tái sử dụng** khi luồng Production trước đó đã được người dùng đồng ý gửi Vision.
- Case zoom phải kéo cùng vùng ở hai mức zoom khác nhau.
- Case SPT multi-page phải ghi một run ở mỗi trang 110/111.
- Bấm **Xuất evidence JSON**.

## Trạng thái

- `PENDING`: chưa có evidence.
- `REVIEW`: đã có run nhưng chưa đạt contract/provenance/anchor/zoom.
- `BENCHMARKED`: đủ evidence thật theo case.
- P3.2 **không có quyền tạo VERIFIED/PROMOTED**.

## Safety gates

- `promotionState = SHADOW_ONLY`.
- `productionMutationAllowed = false`.
- Vision P3.2 không tự gọi mạng và không gửi ảnh lần hai.
- DeepDoc/VietOCR confidence hiện không được coi là calibrated confidence.
- BBox bắt buộc chuẩn hóa về 0..1 và gắn PDF fingerprint + page.
- CI chỉ chạy contract selftest vì runner GitHub không chứa PDF riêng của người dùng.
- Search Brain và Calculation Engine không thuộc phạm vi sửa.
