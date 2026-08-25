# P1 Pass 8.3 – V25 Windows Test Gate Repair

## Nguyên nhân gốc
GitHub Actions Windows của Run #3 dừng tại `Locked regression suite on Windows · exact 574` với:

`Error: spawnSync npm.cmd EINVAL`

Đây là lỗi cách gate gọi `npm.cmd` trên Windows runner, không phải lỗi Calculation Engine hay Golden.

## Sửa V25
`tools/pass83-test-count-gate.mjs` không spawn `npm` / `npm.cmd` nữa.
Gate gọi trực tiếp Node hiện tại (`process.execPath`) để tái lập chính xác lifecycle của `npm test`:

1. `scripts/generate-image-fixtures.mjs`
2. `scripts/check-version-sync.mjs`
3. `scripts/check-search-brain.mjs`
4. `node --test` với toàn bộ file trực tiếp `tests/*.test.mjs` được enumerate và sort ổn định.

Sau đó vẫn bắt buộc:
- tests = 574
- pass = 574
- fail = 0

## Kiểm tra cục bộ
Trên full source v24, V25 đã chạy thật:
- Image fixtures: PASS
- Version Gate: PASS
- Search Brain: PASS
- 574/574 tests: PASS
- fail: 0

## Phạm vi
Chỉ thay `tools/pass83-test-count-gate.mjs`.
Không thay Calculation Engine, Search Brain, PDF, AI, Vite graph, Excel exporter hay workflow.

## Cách dùng
Đang ở branch `p1/pass8.3-runtime-cert-v23`:
1. Chép đè thư mục `tools` từ overlay này vào repo.
2. Commit: `fix: make Pass 8.3 Windows test gate cross-platform v25`
3. Push origin.
4. Workflow Pass 8.3 sẽ tự chạy lại.
5. Chỉ khi Windows 574/574 PASS mới cho phép build Desktop → NSIS → Portable → Verify EXE.
