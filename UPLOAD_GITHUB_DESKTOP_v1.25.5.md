# Cập nhật v1.25.5 bằng GitHub Desktop

1. Giải nén ZIP v1.25.5.
2. Copy toàn bộ nội dung thư mục source đè vào thư mục repo local đang mở bằng GitHub Desktop.
3. KHÔNG xóa `package-lock.json` đang có trong repo local. ZIP có thể không chứa file này; GitHub Actions v1.25.5 sẽ tự đồng bộ lock version nếu cần.
4. Commit: `HNL v1.25.5 - Chat to Calculation to Excel + Math Fix`.
5. Push origin lên `main`.
6. Actions sẽ chạy; nếu RC Final Gate tạo/cập nhật package-lock thì sẽ có thêm một commit bot và một lượt Final Gate đầy đủ tiếp theo.
7. Chỉ dùng artifact EXE/Web của commit sau khi `npm test` 281/281 + Golden 1.130/1.130 + ExcelJS smoke đều PASS.
