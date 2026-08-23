# HNL Pile Standards AI v1.9.20

## PDF Text Reindex · Exact Phrase Guard · False-negative RAG Fix

### Root cause đã sửa

1. PDF.js có thể trả text item theo từng glyph/syllable. Bản cũ dùng `join(" ")`, tạo lớp tìm kiếm kiểu `C ọ c c h ố n g`, nên UI báo trang “có chữ” nhưng lexical RAG không thấy thuật ngữ.
2. Tài liệu đã lưu trong IndexedDB giữ nguyên text index cũ qua các lần nâng version; sửa thuật toán search không tự sửa dữ liệu đã index.
3. Top-k/semantic có thể ưu tiên mục lục hoặc bỏ trang định nghĩa dù cụm kỹ thuật xuất hiện chính xác.
4. AI có thể trả câu thiếu căn cứ do ngữ cảnh rộng mặc dù HNL đã tìm được trang body chính xác.

### Thay đổi

- `TEXT_INDEX_VERSION = 3` và tự `reindexPdfText()` một lần từ Blob PDF gốc.
- Geometry-aware PDF text joining theo khoảng cách item.
- Compact exact phrase safety-net cho glyph-spaced text.
- `findExactPhrasePages()` quét mọi trang, đánh dấu TOC riêng và ưu tiên body.
- False-negative narrow retry giữ nguyên provider/model.
- Không Vision toàn bộ PDF; Visual RAG vẫn chỉ chạy trên trang mục tiêu.
