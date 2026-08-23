# HNL Pile Standards AI v1.9.16

## Sửa lỗi PC AI
- API key đã kiểm tra thành công được dùng ngay trong phiên hiện tại.
- HNL Bridge nhận API key tạm thời từ UI cho chat/model list mà không lưu ra file cấu hình.
- Direct/Bridge dùng cùng provider/model/key đang hoạt động.

## AI Offline
- Có luồng cài Ollama tự động trên Windows nếu máy chưa cài.
- Sau khi cài xong có thể tiếp tục pull model đã chọn.
- Trạng thái cài đặt/tải model hiển thị riêng, không dùng lỗi ENOENT mơ hồ.

## RAR
- Tích hợp node-unrar-js làm bộ giải nén RAR chính trong HNL Desktop/Local.
- 7-Zip/WinRAR/tar là fallback; hỗ trợ RAR có mật khẩu.

## PDF Select/OCR
- PDF có text layer: bôi chọn/copy trực tiếp.
- Trang scan/ảnh: kéo vùng OCR; HNL chỉ crop và gửi vùng chọn, không render/gửi cả trang.

## An toàn & build
- Giữ model-switch approval, PDF.js Legacy, responsive 3 vùng, Version Gate và kiểm tra đủ Setup + Portable EXE.
