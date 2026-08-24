# HNL Pile Standards AI v1.10.0

## Mục tiêu

Bản Professional Workspace tập trung vào **dễ dùng, rõ nguồn, ít thao tác thừa và không làm thay đổi lõi tìm kiếm v1.9.23 đã ổn định**.

## Điểm chính

- Search brain v1.9.23 được khóa hash; phạm vi Tra cứu/Công thức nằm ngoài search core.
- Thư viện: tìm/lọc, ghim, phân loại, phát hiện tài liệu cùng họ/phiên bản.
- PDF: bookmark, ghi chú/highlight vùng, tìm Điều/Bảng/Phụ lục, tự khôi phục trang/zoom/workspace.
- AI: phương thức đọc + mức tin cậy + kiểm tra nguồn; PDF >50 MB dùng Page Batch đúng trang mục tiêu.
- Lịch sử: tìm, ghim, đổi tên, xuất JSON/Markdown/PDF qua Print; lịch sử tính toán Local-first.
- Công cụ kỹ thuật: so sánh tiêu chuẩn, kiểm tra mâu thuẫn hồ sơ, Formula Workspace theo phạm vi.
- Vận hành: chế độ hiện trường, hiệu năng Nhẹ/Cân bằng/Mạnh, Undo/Redo, Backup/Restore, gói lỗi ZIP lọc key.
- Windows CI: Verify Setup/Portable và smoke test Portable trước khi upload artifact.

## Nguyên tắc an toàn

- Không lưu API key vào backup, history hoặc diagnostic ZIP.
- Không tự đổi provider/model.
- Không tự mở rộng phạm vi OCR/Vision ngoài phạm vi người dùng chọn.
- AI Detected formula không tự chuyển Verified.
- Không sửa `src/search.js` nếu chưa có regression chứng minh tốt hơn v1.9.23.
