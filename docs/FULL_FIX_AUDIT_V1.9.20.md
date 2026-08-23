# HNL Pile Standards AI v1.9.20 — RAG Reindex / False-negative Audit

## Lỗi người dùng tái hiện

TCVN 10304:2025 hiển thị rõ thuật ngữ “Cọc chống”, thư viện báo toàn bộ 124 trang đã có text nhưng câu hỏi “cọc chống là gì” vẫn trả “Không tìm thấy đủ căn cứ…”. Đây là false-negative của pipeline đọc/index/RAG, không phải tài liệu không có nội dung.

## Root cause tìm thấy

1. `src/pdf.js` cũ gom từng PDF.js `textContent.item` bằng `join(' ')`. Với PDF có font/text item tách theo glyph/syllable, một từ có thể trở thành `C ọ c   c h ố n g`; tokenizer không còn thấy `coc chong`.
2. Chỉ tiêu `124/124 trang đã lấy chữ` chỉ kiểm tra `text.trim()`, nên watermark/footer/glyph rời cũng làm một trang được tính là “có chữ”. Trạng thái này gây hiểu nhầm rằng nội dung kỹ thuật đã index tốt.
3. Tài liệu lưu trong IndexedDB giữ nguyên `pages[].text` từ version cũ. Nâng thuật toán search không tự tái extract dữ liệu PDF đã lưu, nên lỗi index cũ tiếp tục tồn tại.
4. Semantic/top-k có thể đưa mục lục lên cao hoặc bỏ trang định nghĩa dù cụm kỹ thuật xuất hiện chính xác.
5. AI có thể trả câu strict “không đủ căn cứ” do context rộng ngay cả khi RAG đã tìm thấy trang body chính xác.

## Sửa trong v1.9.20

- `TEXT_INDEX_VERSION = 3` trong `src/pdf.js`.
- `reindexPdfText()` tự tái lập chỉ mục một lần từ Blob PDF gốc cho tài liệu cũ; không cần xóa và nhập lại PDF.
- Geometry-aware text joining: dùng tọa độ X, width và chiều cao glyph để quyết định nối ký tự hay chèn khoảng trắng; không còn chèn khoảng trắng mù giữa mọi PDF.js item.
- Lưu `textQuality` theo trang và `scannedLikely` dựa cả chất lượng trang, không chỉ tổng số ký tự.
- `compactNormalize()` + compact exact safety-net khôi phục tìm kiếm đối với text dạng `C ọ c c h ố n g`.
- `findExactPhrasePages()` quét toàn corpus trước semantic/top-k; trang nội dung/định nghĩa được ưu tiên hơn trang mục lục.
- RAG ghi riêng `exactPhrasePages`, `exactBodyPages`, `textIndexVersion`, số tài liệu được reindex và lỗi reindex.
- Nếu AI vẫn trả câu “Không tìm thấy đủ căn cứ…” nhưng đã có exact body page, HNL retry đúng một lần với context hẹp, vẫn giữ nguyên provider/model.
- UI thư viện đổi từ “trang đã lấy chữ” sang “trang chữ hữu dụng”; nếu có text thô nhưng chất lượng kém sẽ hiển thị riêng, tránh báo 124/124 gây hiểu nhầm.
- Giữ nguyên Targeted OCR/Vision: không tự gửi toàn bộ 124 trang lên Vision.

## Regression tests mới

- Character-spaced PDF text `C ọ c c h ố n g` phải tìm được bằng câu `cọc chống là gì`.
- Exact phrase pass phải ưu tiên body definition hơn TOC occurrence.
- PDF index version cũ phải được tự rebuild + save IndexedDB + clear search cache.
- Nếu AI false-negative trong khi có exact body hits, phải narrow-retry cùng provider/model.

## Kết quả test

- `npm run check:version`: PASS — v1.9.20 đồng bộ package → README → changelog → release → build metadata → Windows artifact templates.
- `npm run test`: **96/96 PASS, 0 FAIL**.
- Syntax check toàn bộ JS/MJS/CJS: PASS.
- Secret-like API key scan: không phát hiện key thật.
- `npm run build:web`: chưa chạy được trong sandbox vì source không có `node_modules` và `vite` không có trong PATH (`vite: not found`). Không ghi build PASS giả.

## File sửa chính

- `src/pdf.js`
- `src/search.js`
- `src/main.js`
- `tests/core.test.mjs`
- `tests/wiring.test.mjs`
- `package.json`
- `README.md`
- `public/changelog.json`
- `docs/BUILD_METADATA.md`
- `docs/RELEASE_V1.9.20.md`
- `docs/FULL_FIX_AUDIT_V1.9.20.md`

## Cách kiểm tra sau khi deploy

Không cần xóa PDF cũ. Sau khi web/app chạy v1.9.20, lần hỏi đầu tiên trên PDF đã lưu từ v1.9.19 sẽ tự re-index từ Blob gốc. Hỏi lại `cọc chống là gì`. Nếu Blob gốc không còn trong IndexedDB hoặc PDF thực sự là ảnh hoàn toàn không có text usable, HNL sẽ chuyển sang TOC/Visual targeted fallback thay vì coi watermark là 124 trang nội dung đọc được.
