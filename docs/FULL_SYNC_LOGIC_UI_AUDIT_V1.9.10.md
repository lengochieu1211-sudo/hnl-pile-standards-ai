# HNL Pile Standards AI v1.9.10 — Full Sync / Logic / UI Audit

## Version
- Canonical: `package.json` = `1.9.10`.
- README current, `public/changelog.json.current`, release hiện hành và BUILD_METADATA phải trùng.
- Vite inject version trực tiếp từ package; `generate-build-info.mjs` cũng đọc package.
- Service Worker cache key nhận version qua URL đăng ký.
- Artifact Windows nhận `${version}` từ electron-builder/package.

## Logic nút
- Event delegation giữ handler sau mỗi lần `render()`.
- Provider/model đổi có confirm.
- Refresh model/Test connection không gọi lưu cài đặt.
- API key chỉ commit khi bấm Lưu.
- Fallback không dùng catalog chưa xác minh.

## Responsive
- Resize desktop không tự set `leftCollapsed/rightCollapsed=true`.
- Panel chỉ ẩn do thao tác người dùng hoặc Focus Reader.
- Mobile chỉ đổi view bằng tab.

## Build gate
1. Version Gate.
2. Core/wiring tests.
3. Build Web hoặc Desktop.
4. Windows verify Setup + Portable.
5. Upload artifact/deploy.
