# HNL Pile Standards AI v1.9.21

## Native PDF AI · Persistent History · Hybrid RAG Citation

### Điểm mới
- Gemini và OpenAI có thể nhận trực tiếp PDF native từ HNL để đọc text + hình + bảng + sơ đồ + công thức.
- Ba chế độ: **Tiết kiệm / Cân bằng / Toàn tài liệu**. Cân bằng là mặc định và chỉ dùng PDF native khi RAG/ảnh cho thấy thật sự cần, giúp giảm quota/token.
- OpenAI dùng Responses API `input_file`; tùy chọn chi tiết PDF `low/auto/high`.
- Gemini nhận PDF native inline; HNL giới hạn bundle tổng tối đa 1000 trang và giới hạn kích thước an toàn.
- HNL RAG vẫn chạy song song để exact search, targeted OCR/Vision, citation và fallback khi PDF native không phù hợp.
- Lưu lịch sử Hỏi đáp theo phiên và lịch sử Tính toán trong IndexedDB; không lưu API key.
- Mở lại phiên chat khôi phục các tài liệu nguồn còn tồn tại cục bộ.
- Lượt hỏi nối tiếp nhận ngữ cảnh các lượt trước nhưng mọi kết luận kỹ thuật phải kiểm lại với PDF hiện hành.
- Native PDF request có timeout dài hơn; không tự đổi provider/model.

### Giới hạn có chủ đích
- HNL v1.9.21 dùng **native inline file input** theo từng request thay vì lưu file vĩnh viễn trên server nhà cung cấp. Cách này giữ mô hình Local-first và tránh để file remote tồn tại ngoài ý muốn; đổi lại PDF native có thể phải truyền lại ở lượt hỏi tiếp theo.
- Với file lớn/nhiều file hoặc khi ưu tiên chi phí thấp, dùng chế độ **Tiết kiệm** để RAG chọn trang liên quan trước.
- Build Windows/Web runtime vẫn phải được xác nhận bởi GitHub Actions hoặc máy có dependency đầy đủ.
