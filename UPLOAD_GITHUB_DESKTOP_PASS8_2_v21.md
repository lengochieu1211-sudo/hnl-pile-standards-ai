# Đưa Pass 8.2 v21 vào repo bằng GitHub Desktop

1. Giải nén full-source ZIP v21.
2. Mở repo local `hnl-pile-standards-ai` bằng GitHub Desktop.
3. Copy toàn bộ nội dung v21 vào repo local và cho phép ghi đè.
4. **Giữ `package-lock.json` đang có trong repo** nếu ZIP v21 không chứa file này.
5. Kiểm tra `src/search.js` vẫn có normalized SHA-256:
   `f9b65e5e6fb61dcca233a4fe43950e3174c73536f2fa83452da3041fbd0021d2`.
6. Commit gợi ý: `HNL P1 Pass 8.2 - Full Source One-Click + Dynamic Excel`.
7. Push và chờ GitHub Actions chạy `npm ci → test → Golden → build`.

Không coi runtime Windows/Web là LOCKED cho đến khi Actions/build thực qua xanh.
