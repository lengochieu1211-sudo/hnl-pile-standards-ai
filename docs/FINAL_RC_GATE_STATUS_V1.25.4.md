# HNL v1.25.4 — Final RC Gate Status

## Đã hoàn thành trong source
- Final Gate workflow `.github/workflows/rc-final.yml`.
- Bootstrap `package-lock.json` đúng một lần trên nhánh RC, sau đó mọi build dùng `npm ci`.
- `npm test`: 275/275 PASS trong môi trường hiện tại.
- `npm run golden:tables`: 1.130/1.130 PASS.
- ExcelJS production runtime smoke script: `scripts/excel-runtime-smoke.mjs`.
- Microsoft Excel COM recalculation script: `scripts/verify-excel-com.ps1`.
- Image Golden fixtures được tái tạo deterministic bằng `scripts/generate-image-fixtures.mjs`.
- GitHub Pages và Windows workflow đã chuyển sang `npm ci` và thêm Golden + ExcelJS runtime smoke.
- Search Brain giữ nguyên SHA256 `f9b65e5e6fb61dcca233a4fe43950e3174c73536f2fa83452da3041fbd0021d2`.

## Gate còn phải chạy trên GitHub/Windows
1. Push source lên `release/v1.25.4-rc`.
2. Workflow bootstrap tạo/commit `package-lock.json` nếu chưa có.
3. Lần workflow kế tiếp: clean checkout → `npm ci` → 275 tests → 1.130 Golden → ExcelJS smoke → Web build.
4. Windows gate: clean checkout → `npm ci` → tests/Golden/ExcelJS → Setup + Portable EXE.
5. Microsoft Excel COM: mở XLSX thật, `CalculateFullRebuild`, thay input và so sánh recalculation.
6. Chỉ khóa RC khi Excel COM PASS trên máy có Microsoft Excel.

## Blocker hiện tại
GitHub repository đọc được nhưng mọi write action qua connector trả `403 Resource not accessible by integration`. ChatGPT-side GitHub permission đã là `Allow all actions`, nên blocker là GitHub App/OAuth installation scope đối với repository. Không báo push/build PASS giả.
