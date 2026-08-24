# HNL Pile Standards AI v1.9.26

## Mục tiêu

Bản hợp nhất an toàn theo yêu cầu: **giữ bộ não tìm kiếm/RAG của v1.9.23**, chỉ lấy **giao diện và phạm vi quét của v1.9.25**.

## Nguyên tắc merge

- `src/search.js`: giữ nguyên byte-for-byte từ v1.9.23.
- `src/scope.js`: chứa parser phạm vi trang của UI v1.9.25 để không chạm search brain.
- `src/main.js`: giữ UI/scope v1.9.25; `runLookup()` dùng lại searchEveryPage + TCVN 7888 assist theo hành vi v1.9.23 trên corpus đã được scope.
- Hỏi đáp/RAG, Exact Phrase Guard, TOC/Visual rescue, Native PDF và citation giữ code path đã có ở v1.9.23 trừ phần UI scope không liên quan ranking.

## Regression bắt buộc

- Hash `src/search.js` phải trùng bản v1.9.23.
- Tra cứu scope không được tự mở rộng ngoài phạm vi người dùng chọn.
- Công thức mặc định Trang hiện tại và OCR/Vision chỉ chạy trong phạm vi đã chọn.
- Provider/model không hiển thị trùng nhiều nơi.
