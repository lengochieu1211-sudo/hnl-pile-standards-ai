# GitHub Pages build fix – v1.0.1

## Lỗi đã sửa
GitHub Actions dừng ở `actions/setup-node@v4` với lỗi:

`Dependencies lock file is not found ... Supported file patterns: package-lock.json, npm-shrinkwrap.json, yarn.lock`

Nguyên nhân: workflow cũ bật `cache: npm` nhưng repository chưa có `package-lock.json`.

## Cách sửa trong v1.0.1
- Bỏ `cache: npm` khỏi bước `actions/setup-node@v4`.
- Giữ Node.js 22.
- Dùng `npm install --no-audit --no-fund` trước `npm run build`.
- Giữ luồng deploy chính thức qua `actions/configure-pages`, `upload-pages-artifact`, `deploy-pages`.

Khi repository có `package-lock.json` được tạo và commit ổn định, có thể bật lại cache npm và đổi bước cài đặt thành `npm ci`.

## Cách cập nhật
Chép đè file `.github/workflows/pages.yml` của bản này lên repository, hoặc upload toàn bộ nội dung ZIP vào nhánh `main`. Sau khi commit, vào **Actions → Deploy HNL Pile Standards AI to GitHub Pages** để xem lần chạy mới.
