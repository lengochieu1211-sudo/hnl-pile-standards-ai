# HNL Pile Standards AI v1.9.19 — Hybrid Visual RAG + Compact UI Audit

## Phạm vi sửa

Bản này kế thừa v1.9.18 và tập trung vào hai lỗi/nhu cầu thực tế:

1. AI không tìm ra nội dung như **“cọc chống”** khi từ khóa có ở mục lục/lớp chữ nhưng nội dung thật nằm trong ảnh/scan của PDF hỗn hợp.
2. Tab Cài đặt đang hiển thị quá nhiều chi tiết version/changelog/capability/diagnostics cùng lúc, làm panel dài và rối.

## Root cause RAG

- Tokenizer bỏ dấu nhưng stop-word trước đây không cùng dạng; khi chuẩn hóa vội có thể lại gây va chạm tiếng Việt kỹ thuật (`tại/tải`, `bằng/bảng`, `có/co`, `trong/trọng`).
- Retrieval chủ yếu dựa trên text layer. Một PDF hỗn hợp có thể có text ở mục lục nhưng trang nội dung là ảnh, nên toàn tài liệu bị coi là “có chữ” dù câu trả lời nằm trong pixel.
- Top-K context không đồng nghĩa với số trang đã quét; cần một bước định vị trang ảnh mục tiêu trước khi kết luận không đủ căn cứ.

## Sửa RAG

- Stop-word bảo thủ, giữ các token kỹ thuật dễ va chạm sau bỏ dấu.
- `coreSearchPhrase()` rút câu hỏi tự nhiên về cụm kỹ thuật; ví dụ `cọc chống là gì` -> `coc chong`.
- Giữ số một chữ số để `Bảng 1` vẫn tìm đúng.
- `findTocPageTargets()` đọc dòng mục lục có số trang và tìm exact technical phrase.
- Tự suy ra offset `trang in -> trang PDF` từ các đề mục khác có thể đối chiếu bằng lớp chữ.
- `collectTargetedPdfEvidence()` chỉ kiểm tra tối đa một số trang đích/lân cận:
  - lớp chữ phù hợp -> dùng trực tiếp;
  - thiếu chữ -> render đúng trang;
  - thử `TextDetector` OCR cục bộ;
  - nếu local OCR yếu và đang dùng AI -> gửi tối đa 3 ảnh trang đích trong cùng lượt trả lời.
- Mỗi ảnh trang đích có visual locator kèm đúng file/trang để model có citation.
- Chỉ dẫn mục lục được ghi rõ là **locator**, không phải nội dung định nghĩa.
- Không tự OCR/Vision toàn bộ PDF cho một câu hỏi thông thường.

## Sửa UI Cài đặt

- Phiên bản & Build: ngoài chỉ hiện version/build/kênh/thời điểm; changelog và metadata chi tiết nằm trong `Xem chi tiết`.
- Dữ liệu đầu vào: ngoài chỉ hiện nhóm PDF/Folder/Archive/Image/Text + Hybrid RAG/Offline AI; capability và archive engine nằm trong `Xem chi tiết`.
- Chẩn đoán: ngoài chỉ hiện tổng điểm (ví dụ `8/8 kiểm tra đạt`) + nút Chạy; từng dòng kiểm tra nằm trong `Xem chi tiết chẩn đoán`.
- UI State Guard ghi nhớ các `<details>` đang mở qua full render.

## Test

- `npm test`: 92 PASS / 0 FAIL.
- `npm run check:version`: PASS, v1.9.19 đồng bộ package -> README -> changelog -> release -> build metadata -> Windows artifact templates.
- Syntax JS/MJS/CJS: PASS.
- GitHub workflow YAML: PASS parse.
- Secret scan: không phát hiện API key thật theo pattern phổ biến.

## Chưa thể xác nhận runtime trong môi trường hiện tại

- `npm run build:web`: chưa chạy được vì source ZIP không kèm `node_modules` và môi trường hiện tại không có `vite` (`vite: not found`).
- Chưa chạy được Windows Setup/Portable thực tế, Windows Scale 100/125/150, Ollama download nhiều GB hoặc Vision trên chính PDF TCVN trong ảnh người dùng.
- Logic TOC/scan đã có regression test mô phỏng đúng tình huống: mục lục có `7.2.1 Cọc chống ... 28`, trang đích không có text và offset trang PDF cần suy ra.
