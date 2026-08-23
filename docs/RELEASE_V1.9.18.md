# HNL Pile Standards AI v1.9.18

## Mục tiêu bản sửa

Bản này tập trung sửa lỗi UX/state được phát hiện trong video PC và làm cứng luồng Offline AI.

## Sửa chính

- OCR/Chọn vùng PDF không còn gọi full `render()` nên không nhảy về trang đầu.
- `Kiểm tra kết nối` cập nhật status tại chỗ, giữ nguyên vị trí cuộn tab Cài đặt và API key đang nhập.
- Thêm cơ chế lưu/khôi phục vị trí PDF, panel AI, thư viện và focus cho các full render còn cần thiết.
- `pull-model` chỉ chạy sau khi xác minh Ollama API `127.0.0.1:11434` sẵn sàng; nếu cần Bridge tự chạy `ollama serve`.
- Trả mã `OLLAMA_NOT_READY` khi đã có executable nhưng server không sẵn sàng.
- Windows Cancel dùng `taskkill /PID <pid> /T /F`.
- Panel toggle/Focus/Reset layout giữ viewport PDF thay vì ép `pendingPageScroll`.
- Citation cross-document kiểm tra `data-doc-id` trước khi dùng shell của continuous viewer.
- Tiếp tục giữ model/provider không tự chuyển và không tự tải model lớn khi chưa xác nhận.

## Kiểm tra bắt buộc

- `npm run check:version`
- `npm test`
- Node syntax check cho JS/MJS/CJS.
- Workflow Windows vẫn phải verify đủ Setup + Portable EXE.
