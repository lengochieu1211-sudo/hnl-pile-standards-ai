# Windows EXE Build Audit v1.9.7

## Lỗi từ GitHub Actions đã xác định

`cannot expand pattern "HNL-Pile-Standards-AI-${version}-${arch}-${target}.${ext}": macro target is not defined`

Build Web/Vite đã thành công. Electron đã đóng gói `win-unpacked` thành công. Lỗi chỉ xảy ra tại bước đặt tên artifact cuối cùng vì electron-builder không hỗ trợ macro `${target}` trong template đó.

## Sửa

- `win.artifactName`: bỏ.
- `nsis.artifactName`: `HNL-Pile-Standards-AI-Setup-${version}-${arch}.${ext}`.
- `portable.artifactName`: `HNL-Pile-Standards-AI-Portable-${version}-${arch}.${ext}`.
- Workflow có bước Verify Windows EXEs, bắt buộc có cả Setup và Portable.

## Kết quả mong đợi

- `HNL-Pile-Standards-AI-Setup-1.9.7-x64.exe`
- `HNL-Pile-Standards-AI-Portable-1.9.7-x64.exe`
