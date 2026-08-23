# HNL Pile Standards AI v1.9.19

## Hybrid Visual RAG · TOC Target OCR · Compact Settings UI

### Sửa RAG cho PDF có nội dung nằm trong ảnh/scan

- Tokenizer tiếng Việt dùng stop-word bảo thủ sau bỏ dấu: không loại các token dễ trùng nghĩa kỹ thuật như `tai` (tải/tại), `bang` (bảng/bằng), `co` (co/có), `trong` (trọng/trong), `do` (độ/do). `cọc chống là gì` vẫn được rút về `coc chong`; số bảng một chữ số cũng được giữ.
- Tìm exact/lexical trên toàn bộ lớp chữ trước, bao gồm mục lục.
- Khi mục lục có đề mục phù hợp và số trang, HNL suy ra trang PDF đích; nếu số trang in lệch số trang PDF, HNL dùng các đề mục khác có lớp chữ để suy ra offset.
- Chỉ kiểm tra một số trang đích/lân cận: lớp chữ → TextDetector OCR cục bộ → Vision nếu local OCR thiếu và người dùng đang dùng AI hỗ trợ ảnh.
- Ảnh trang đích được gửi trong **cùng lượt hỏi**, giới hạn số trang, không tự Vision toàn bộ PDF.
- Chỉ dẫn mục lục không được coi là bằng chứng định nghĩa. Nếu ảnh/trang đích không đủ rõ, AI phải giữ quy tắc “Không tìm thấy đủ căn cứ trong các tài liệu đang chọn.”

### UI Cài đặt gọn hơn

- Phiên bản & Build: ngoài chỉ hiện version, build, kênh và thời điểm; changelog/build detail nằm trong `Xem chi tiết`.
- Dữ liệu đầu vào: ngoài chỉ hiện nhóm định dạng chính + Hybrid RAG/Offline AI; danh sách capability và engine archive chỉ bung khi cần.
- Chẩn đoán: ngoài hiện điểm tổng quan (ví dụ `8/8 kiểm tra đạt`); từng dòng IndexedDB/Web Crypto/Service Worker/... nằm trong phần chi tiết.
- UI State Guard bảo toàn các disclosure đang mở qua full-render.

### Regression

- Giữ toàn bộ sửa v1.9.18 về OCR/API scroll, PDF state, citation đổi tài liệu, Ollama readiness, model approval, responsive và Windows version/build gate.
