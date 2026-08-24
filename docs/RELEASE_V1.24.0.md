# HNL Pile Standards AI v1.24.0

## Image-to-Engineering Input

- Source baseline duy nhất: v1.23.0 Full E2E Golden Audit.
- Thêm `src/image-engineering.js`: schema extraction, prompt guard, parse JSON, confidence/provenance, confirmation edits và canonical engineering input.
- Chat hỗ trợ chọn nhiều ảnh, Ctrl+V, kéo-thả, preview và bỏ ảnh.
- Trước khi Calculation Engine chạy, HNL hiển thị bảng “Kiểm tra dữ liệu đọc từ ảnh”; người dùng có thể sửa rồi bấm **Xác nhận & tính**.
- OCR cục bộ (TextDetector nếu có) chỉ làm hint; AI Vision phải đối chiếu pixel; dữ liệu mờ không được đoán.
- Dữ liệu đã xác nhận được chuyển thành text kỹ thuật canonical cho Universal Engineering Router và lưu provenance theo từng trường.
- Excel kỹ thuật của 7888/10304/5574 tự thêm sheet `08_NGUON_ANH`, ghi trường kỹ thuật, giá trị đã xác nhận, đơn vị, ảnh nguồn và confidence; không ghi giả là giá trị tra tiêu chuẩn.
- Golden Image: TCVN 7888 PHC D600-B; TCVN 10304 cọc đóng nhiều lớp; TCVN 5574 uốn B30/CB400-V.
- Fix router `tiet dien tron\b` để “tiết diện trong ảnh” không match nhầm Phụ lục F.
- Search Brain `src/search.js` không thay đổi.
- Regression source: 250/250 PASS. Live Vision provider smoke test vẫn phải chạy trên môi trường có Gemini/OpenAI/Ollama Vision thật trước Release Candidate.
