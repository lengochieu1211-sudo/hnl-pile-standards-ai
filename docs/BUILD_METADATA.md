# Build metadata — HNL v1.27.0

`dist/build-info.json` được sinh tự động sau build thành công.

## Một nguồn version duy nhất

- `package.json.version` → Web / Desktop / PWA / EXE / Service Worker / artifact release.
- `public/release-meta.json.appVersion` phải bằng `package.json.version`.
- `certificationStage` chỉ mô tả giai đoạn audit, **không phải version**.
- `goldenBaseline` là danh tính bộ bằng chứng Golden.
- `searchBrain` là danh tính lõi tìm kiếm khóa regression.

Ví dụ:

```json
{
  "version": "1.27.0",
  "certificationStage": "MASTER_SYSTEM_AUDIT",
  "goldenBaseline": "1.25.7",
  "searchBrain": "1.9.23",
  "target": "web",
  "builtAt": "2026-08-26T03:00:00.000Z",
  "source": "GitHub Actions",
  "runNumber": 34,
  "branch": "main",
  "commitShort": "abc1234"
}
```

Giao diện đọc build metadata với `cache: no-store`; Service Worker cache key tiếp tục dùng `v1.27.0` qua query runtime.
