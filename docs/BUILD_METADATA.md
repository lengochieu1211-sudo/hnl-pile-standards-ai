# Build metadata

`dist/build-info.json` được sinh tự động sau build thành công.

Ví dụ:

```json
{
  "version": "1.25.6",
  "target": "web",
  "builtAt": "2026-08-22T23:15:00.000Z",
  "source": "GitHub Actions",
  "runNumber": 128,
  "repository": "owner/HNL-Pile-Standards-AI",
  "branch": "main",
  "commitShort": "abc1234"
}
```

Giao diện đọc file này ở runtime với `cache: no-store`. Nếu file không tồn tại (ví dụ chạy `vite dev`), app dùng metadata fallback và ghi rõ đây là local/source fallback.
