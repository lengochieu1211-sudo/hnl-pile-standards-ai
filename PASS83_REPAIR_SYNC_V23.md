# P1 Pass 8.3 — Repair Sync v23

## Nguyên nhân từ 3 log Actions
Cả Windows / Pages / RC Final Gate dừng ở cùng `npm test`: 463 tests, 448 pass, 15 fail.
Đây là lỗi merge/sync không đồng bộ trên `main`, không phải 15 lỗi độc lập.

### 15 lỗi quy về 5 nhóm
1. `src/codepack-tables.js` cũ, thiếu `lookup5574Table16LongTermPhi` → kéo theo Pass 7/8/8.1/8.2 + material/multiborehole.
2. `src/tcvn10304-table-engine.js` cũ, thiếu `averageMeasuredSptN10304` → kéo theo P0 Pass2/Pass3/SPT/DCE tests.
3. `src/pile-workflows.js` cũ → chưa hỗ trợ đúng `shaftStartDepthM` và `maxSegmentM` trong driven workflow.
4. `src/excel-export.js` cũ → chưa có input `Độ sâu bắt đầu ma sát thân` / `Bước phân đoạn tối đa` của Formula-Only workbook.
5. `tests/v1.25.6.test.mjs` trên GitHub còn expectation paste cũ; snapshot v22 đã chuyển đúng sang giữ nguyên clipboard và chuẩn hóa ở lớp tính toán.

## Gate mới v23
- `npm run gate:pass83-source-sync`: khóa hash các file critical và xác nhận Search/PDF/AI không đổi.
- `npm run gate:pass83-tests`: bắt buộc đúng 574/574, fail 0; không chỉ dựa exit code.
- Workflow Pass 8.3 tự chạy cả khi push `main` để phục hồi tình trạng hiện tại.

## Cách áp dụng
Giải nén Repair Overlay vào thư mục repo GitHub Desktop và chọn Replace/Merge files. Không xóa `.git`.
Sau đó Commit + Push. Push lên `main` sẽ tự kích hoạt Pass 8.3 Runtime Certification v23.
Không rerun các workflow cũ trước khi commit repair.
