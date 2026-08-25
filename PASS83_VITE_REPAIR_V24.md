# P1 Pass 8.3 — Vite Repair v24

Run #2 trên branch `p1/pass8.3-runtime-cert-v23` đã PASS toàn bộ engine/Golden và chỉ FAIL ở Vite do browser graph kéo nhầm `src/csi-live-bridge.js` (Node-only).

## Sửa v24
- Tách `parseCsvText` + `importStructuralCsvBundle` sang `src/structural-csv-importer.js` browser-safe.
- Pass 6 import trực tiếp adapter browser-safe.
- `csi-live-bridge.js` re-export API CSV để không phá test/consumer cũ.
- Thêm `gate:pass83-web-boundary`.
- Sửa workflow trigger đúng `p1/pass8.3-runtime-cert-v23` và thêm v24.
- Nâng `actions/checkout`/`setup-node` từ v4 lên v5 để bỏ cảnh báo runtime action cũ.

## Test đã chạy
- Pass 5.2: 19/19 PASS.
- Pass 6: 10/10 PASS.
- Pass 7/8/8.2 selected regression: 34/34 PASS.
- Source Sync: PASS; Search/PDF/AI giữ nguyên.
- Static browser import graph: 38 module reachable; CSi Live Bridge không reachable; Node built-ins reachable = 0.

## Còn phải chứng nhận trên GitHub
Vite build thật và Windows NSIS/Portable vẫn phải chạy xanh trên GitHub Actions trước khi gọi Pass 8.3 Runtime Certified / LOCKED.
