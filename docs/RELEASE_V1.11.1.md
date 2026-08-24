# HNL Pile Standards AI v1.11.2

## Windows Build Hash Guard

Bản hotfix này xử lý GitHub Actions Windows thất bại ở 3 regression test khóa SHA-256 của `src/search.js`. Nội dung search brain không thay đổi; Windows checkout đã đổi line ending LF thành CRLF.

### Sửa
- Thêm `.gitattributes` để chuẩn hóa line ending theo loại file.
- Hash regression đọc UTF-8 và chuẩn hóa `\r\n` thành `\n` trước SHA-256.
- Giữ nguyên canonical hash của search brain v1.9.23: `f9b65e5e6fb61dcca233a4fe43950e3174c73536f2fa83452da3041fbd0021d2`.
- Hash của cùng source khi CRLF là `c0c900606948c66317a7c61119e8492ee340c4a2f425464cfad5a070df4e931e`, trùng chính xác log GitHub.

### Xác nhận
- LF source: 145/145 PASS.
- Mô phỏng CRLF `src/search.js`: 145/145 PASS.
- Version Gate: PASS.
