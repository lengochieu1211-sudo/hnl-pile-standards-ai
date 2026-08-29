# HNL Pile Standards AI v1.27.0

## Release identity

- Version sản phẩm duy nhất: **v1.27.0**
- Giai đoạn chứng nhận: **Master System Audit**
- Golden Baseline: **1.25.7**
- Search Brain: **v1.9.23 LOCKED**
- Pre-release Runtime Golden SHA: `f40fb68e8a087db87b033242198200798746cb37`

## Thay đổi chính

1. P3.2 Real PDF Golden đóng **9/9 BENCHMARKED**; không tự nâng thành numeric VERIFIED.
2. P4 PDF/Ảnh → Excel Intelligence hỗ trợ quét toàn PDF, vùng PDF và Image Engineering review.
3. Provenance giữ file → page → bbox → engine → state/confidence → source SHA/fingerprint khi có.
4. OCR/Vision-readable không đồng nghĩa VERIFIED; dữ liệu chưa xác nhận không được tự đi vào Calculation Engine.
5. Công thức Excel thực thi chỉ được tạo khi provenance VERIFIED, expression qua allowlist và biến đã ánh xạ input an toàn.
6. Chromium Runtime Golden trên Windows CI đạt **5/5**; full regression đạt **592/592**.
7. Sản phẩm phát hành chỉ nhắm **Web + Windows x64**; Windows gồm NSIS Setup và Portable.

## Quy tắc chứng nhận

- Golden Baseline v1.25.7 tiếp tục giữ nguyên tên để bảo toàn lịch sử benchmark.
- Search Brain v1.9.23 tiếp tục LOCKED; không sửa `src/search.js`.
- Calculation Engine không được thay đổi trong release bump này.
- P4 tiếp tục REVIEW-first; bump v1.27.0 không tự động promotion PR #4 hoặc `main`.
- Web/EXE chỉ được phát hành từ đúng release SHA sau khi CI, Runtime Golden và artifact verification đều PASS.
