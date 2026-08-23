# HNL Pile Standards AI v1.9.5

**Dual Edition:** HNL Web + HNL Desktop AI.

## v1.9.5 — Icon Pro & Windows Identity

- Giữ nguyên nhận diện HNL: **HN xanh navy + L bạc**, nền sáng bo góc.
- Tối ưu riêng cho Windows: icon nhỏ rõ hơn, giảm khoảng trống và tăng nét nhẹ.
- `build/icon.ico` chứa nhiều raster size để Windows không phải tự scale từ một ảnh duy nhất.
- Bổ sung `hnl-mark-32.png`, `hnl-mark-48.png`, `hnl-mark-64.png`, `hnl-mark-192.png`, `hnl-mark-512.png` và `favicon.ico`.
- Electron đặt `AppUserModelID = com.hnl.pilestandardsai` để taskbar/shortcut nhận icon nhất quán.
- Metadata build vẫn lấy động từ GitHub Actions như v1.9.2.


## v1.9.2 — Build Metadata & Update Diagnostics

- `package.json` là nguồn duy nhất cho số phiên bản.
- Không ghi cứng ngày/giờ cập nhật trong giao diện.
- Sau khi Vite build thành công, `scripts/generate-build-info.mjs` tạo `dist/build-info.json`.
- Khi build trên GitHub Actions, metadata tự có **Build #, commit SHA, branch, repository, run id, Web/Desktop và thời điểm build**.
- Giao diện hiển thị **thời điểm build của chính artifact đang chạy**, định dạng GMT+7.
- Nếu một GitHub run build/deploy lỗi, bản lỗi không được phát hành nên giao diện vẫn giữ metadata của bản thành công trước đó.
- Có **Kiểm tra cập nhật** qua GitHub Releases và **Sao chép thông tin** để gửi khi báo lỗi.
- Có changelog gần nhất ngay trong Cài đặt.
- Service Worker dùng version từ `package.json` khi đăng ký và luôn network-first cho `build-info.json` / `changelog.json`.
- Artifact Desktop tự mang `v<version>-build-<run_number>`.

## HNL Web

- Deploy bằng `.github/workflows/pages.yml`.
- Build: `npm run build:web`.
- Dùng Gemini / ChatGPT(OpenAI) / Claude / Grok.
- Không hiển thị Ollama trên GitHub Pages để tránh lỗi HTTPS → HTTP.
- Vẫn có Tra cứu nhanh cục bộ không AI.

## HNL Desktop AI

- Build: `npm run dist:win`.
- Tạo NSIS Setup + Portable EXE trong `release/`.
- Có Ollama Offline + AI Online trong cùng ứng dụng.
- Local Bridge, OCR/Vision, embedding/rerank, quét công thức AI, PDF/ZIP/RAR/7Z/thư mục.
- Quản lý model Ollama, dung lượng ổ đĩa, đổi `OLLAMA_MODELS`, tải/xóa/hủy tải model.

## Reader Pro

- PDF liên tục hoặc 1 trang.
- Lazy rendering cho tài liệu dài.
- Kéo/pan bằng chuột, Ctrl + lăn để zoom.
- Ctrl+F tìm trong PDF, thanh trượt trang, PageUp/PageDown/Home/End.
- Focus Reader, panel ẩn/hiện và co giãn.

## Kiểm thử

```bash
npm test
```

v1.9.5 hiện có **38/38 bài test PASS**, gồm kiểm tra asset/icon Windows đa kích thước.

## Build Web

```bash
npm install
npm run build:web
```

Sau build thành công, kiểm tra:

```text
dist/build-info.json
```

## Build Windows EXE

Có thể chạy trên Windows:

```bash
npm install
npm run dist:win
```

Hoặc dùng GitHub Actions → **Build HNL Desktop AI for Windows**.

## Tài liệu

- `docs/RELEASE_V1.9.3.md`
- `docs/RELEASE_V1.9.2.md`
- `docs/BUILD_METADATA.md`
- `docs/BUILD_DESKTOP.md`
- `docs/DUAL_EDITION.md`


## v1.9.5
- Cài đặt trong panel Trợ lý luôn hiển thị bằng tab grid; có thêm nút ⚙ truy cập nhanh.
- Workflow Windows tự build trên mỗi push vào `main`; artifact chứa Setup + Portable EXE nằm ở Actions > lần chạy `Build HNL Desktop AI for Windows` > Artifacts.
