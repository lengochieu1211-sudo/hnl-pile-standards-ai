# HNL Pile Standards AI v1.9.1

Cập nhật: 23/08/2026 05:49 GMT+7

## Offline Model Manager
- Liệt kê model Ollama đã cài và dung lượng.
- Hiển thị ổ đĩa/thư mục model.
- Đổi OLLAMA_MODELS từ HNL Desktop.
- Gợi ý ổ C/D/E theo dung lượng trống.
- Cài bộ Nhẹ/Cân bằng/Mạnh.
- Theo dõi tiến độ pull, hủy pull và xóa model.
- Mở thư mục model bằng Explorer.

## An toàn dữ liệu
Đổi thư mục không tự move kho model cũ. Việc di chuyển blob/manifests tự động có nguy cơ hỏng kho Ollama nên v1.9.1 chỉ áp dụng thư mục mới cho lần chạy Ollama tiếp theo.
