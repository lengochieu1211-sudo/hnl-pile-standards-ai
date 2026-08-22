# Audit v1.4 — Full Library RAG

## Lỗi gốc v1.3

1. `sourceDocs()` dùng tài liệu được tick, nếu không tick thì chỉ dùng `activeDoc` → nhiều PDF tải vào nhưng hỏi đáp không tự lấy toàn bộ thư viện.
2. Hỏi đáp chỉ lấy `smartSearchChunks(..., 14)`.
3. Tra cứu chỉ lấy khoảng 16 hit.
4. Không có quota theo từng tài liệu nên một PDF có thể chiếm gần hết context.
5. UI không cho biết thực tế đã đọc bao nhiêu trang/chữ.
6. Model AI chỉ là ô text với một model mặc định; không lấy danh sách model khả dụng.

## Sửa v1.4

- `scope=all` mặc định.
- `searchEveryPage()` chấm điểm mọi chunk ở mọi trang rồi gộp theo trang.
- `smartSearchChunks()` chấm toàn corpus, round-robin theo PDF, fill global top, thêm trang lân cận.
- `corpusStats()` cung cấp số tài liệu/trang/trang có text/ký tự/chunk.
- Chat local và AI đều thông báo phạm vi quét.
- 40/56 context hit chỉ là context cuối; không phải giới hạn số trang được tìm.
- Thêm chunk cache.
- Thêm model picker động và Bridge model endpoint.

## Test

- 17/17 test Node pass.
- Test đặc biệt: nội dung chỉ có ở trang 114/120 vẫn phải tìm ra.
- Test cân bằng 3 PDF: RAG phải giữ hit từ cả 3 tài liệu.
- `node --check`: main/search/ai/bridge pass.

## Build

Môi trường đóng gói hiện tại không có `node_modules` và npm registry bị timeout nên không chạy được Vite build cục bộ. Workflow GitHub đã cấu hình `npm install` trước `npm run build`, nên GitHub Actions sẽ là build xác nhận cuối cùng.
