# Pass 8.1 — Dynamic Excel endpoint

## Chạy độc lập để kiểm thử

```bash
npm run pass8:server
```

Mở:

`http://127.0.0.1:8791/pass8/`

Luồng thật:

`TÍNH (browser)` → `POST /api/hnl/pile/export-excel` → `Pass 8 router chạy lại server-side` → `so client/server summary` → `dynamic OOXML exporter` → `template v18` → file `.xlsx` mới.

Endpoint health:

`GET /api/hnl/pile/export-health`

## Gắn vào local backend của full app

Import `handlePass81ExcelExport` từ `server/pass81-excel-route.mjs` và route POST `/api/hnl/pile/export-excel` sang handler này. Không cần Excel/Office, ExcelJS hay COM.

## Fail-safe

- Sai template SHA-256 → BLOCK.
- Sai schema/templateVersion → BLOCK.
- Client summary khác kết quả Pass 8 chạy lại trên server → 422 BLOCK.
- Kết quả có `KHÓA TÍNH` → BLOCK.
- Vượt vùng template động (70 dòng kiểm cọc, 50 nhánh địa chất, 70 phân đoạn) → BLOCK thay vì cắt dữ liệu.
