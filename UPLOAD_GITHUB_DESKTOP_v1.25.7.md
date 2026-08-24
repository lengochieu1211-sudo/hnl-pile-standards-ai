# Cập nhật v1.25.7 bằng GitHub Desktop

1. Giải nén ZIP.
2. Copy toàn bộ nội dung thư mục v1.25.7 đè vào repo local.
3. Giữ `package-lock.json` đang có trong repo nếu ZIP không chứa file này.
4. Commit: `HNL v1.25.7 - Formula Paste + Responsive Panel Fix`.
5. Push origin.

Sau push, kiểm Actions: npm ci → test → Golden → Web/Windows.
