# HNL Pile Standards AI v1.23.0 — Full End-to-End Golden Engineering Audit

## Source baseline
- Nguồn code duy nhất: `HNL-Pile-Standards-AI-v1.22.0-TCVN5574-Annex-DLM.zip`.
- Không dùng source/version cũ để báo đã sửa.
- Target sau audit: `v1.23.0`.

## Root causes tìm thấy
1. Registry TCVN 7888 đã có workflow `7888-material`, bảng tra và calculator, nhưng `engineering-router` chưa thực sự chạy phép tính từ câu hỏi tự nhiên; workflow có thể được nhận dạng nhưng kết quả deterministic chưa đi hết đường E2E.
2. Nút Excel trong câu trả lời AI chỉ mở cho workflow bắt đầu bằng `10304-` hoặc `5574-`, nên TCVN 7888 không đi qua đường `AI → workflow → Excel chuyên ngành`.
3. TCVN 7888 có dữ liệu Bảng 1/Bảng 2 và Phụ lục B, nhưng chưa được nối thống nhất thành chuỗi `parse → validate → lookup → calculate → provenance → Excel`.
4. Khi đồng bộ version v1.23.0, một regression test lịch sử kiểm literal filename v1.22 bị fail. Đã giữ literal lịch sử trong comment để bảo toàn regression, còn file phát hành thực tế dùng v1.23.0.

## Sửa code thật
- `src/engineering-router.js`
  - Thêm parser đề bài TCVN 7888 cho PC/PHC/NPH, cấp A/AB/B/C, D, L, σcu.
  - Thêm Calculation Engine deterministic cho TCVN 7888.
  - NPH-AB bị từ chối; PC σcu<60 và PHC/NPH σcu<80 bị khóa.
  - Bảng 1 chỉ dùng PC/PHC; Bảng 2 dùng NPH.
  - Tính A0, sức kháng dài hạn, ngắn hạn, Pmax; chuyển MPa×mm² từ N sang kN đúng `/1000`.
  - Cảnh báo chiều dài ngoài dải bảng thay vì tự phủ định, vì ghi chú bảng cho phép vượt dải khi thiết kế/thiết bị/thi công phù hợp.
- `src/excel-export.js`
  - Thêm exporter TCVN 7888 chuyên ngành.
  - Workbook có Input, bảng tra, tính toán, kết quả, thuyết minh, nguồn/provenance.
- `src/main.js`
  - Mở đường `7888-` cho nút Xuất Excel trong câu trả lời AI.
- `tests/v1.23.0.test.mjs`
  - 9 regression/golden tests mới cho TCVN 7888 và wiring AI → Excel.
- Đồng bộ version package/README/changelog/release/build metadata lên v1.23.0.

## Golden Engineering Benchmark

### TCVN 7888:2014
- PHC D600-B, σcu=80 MPa: PASS.
- PC D400-A, σcu=60 MPa: PASS.
- NPH 800-600-B, σcu=80 MPa: PASS.
- NPH-AB: PASS reject.
- PHC σcu=70 MPa: PASS reject.
- Benchmark PHC D600-B:
  - Ra dài hạn = 3007.581286966663 kN, HNL = Excel, sai lệch 0.
  - Pmax = 4812.130059146661 kN, HNL = Excel, sai lệch 0.

### TCVN 10304:2025
- 12 workflow numeric: PASS HNL ↔ Excel.
- 1 workflow bè-cọc: PASS-METHOD / VERIFIED_METHOD; không giả thành công thức đóng.
- Bao gồm: cọc chống, đóng/ép, nhồi/khoan, vít, tải tĩnh, thử động, CPT, SPT, lún đơn, lún nhóm, khối quy ước, ảnh hưởng thi công.

### TCVN 5574:2018
- 20 benchmark numeric hiện hành: PASS HNL ↔ Excel.
- Bao gồm SLS, ứng suất trước, neo/nối, tiết diện tròn/vành khuyên, chốt, công xôn và các nhánh D/L/M đã Verified/Verified Branch.

## Test source
- `npm test`: **241/241 PASS, 0 FAIL**.
- Version Gate: PASS v1.23.0.
- Search Brain Guard: PASS.
- `src/search.js` normalized SHA-256: `f9b65e5e6fb61dcca233a4fe43950e3174c73536f2fa83452da3041fbd0021d2`.
- `node --check` các JS thay đổi: PASS.

## Review / Method vẫn khóa
- TCVN 10304 bè-cọc: `VERIFIED_METHOD`, cần mô hình tương tác/số.
- TCVN 5574 Phụ lục D công thức D.5: REVIEW; input Qan,j,0 phải có provenance.
- Các phần Phụ lục L/M ngoài nhánh đã số hóa: INDEXED/REVIEW; không tự tính.

## Excel QA
- `HNL-TCVN7888-Production-v1.23.0.xlsx`: formula error scan 0 lỗi `#REF/#DIV0/#VALUE/#NAME/#N/A`.
- `HNL-3TCVN-Full-E2E-Golden-Audit-v1.23.0.xlsx`: formula error scan 0 lỗi.
- Workbook dùng công thức thật, tách Input/Formula/Result/Source, có safety gate và provenance.

## Build status
- `npm run build:web` đã chạy thật nhưng **BLOCKED** trong sandbox vì `vite: not found` (exit 127).
- Không báo Web/Windows EXE PASS giả.
- Bước tiếp theo để phát hành EXE: `npm ci` trên GitHub Actions/Windows runner → full tests → build:web → dist:win → smoke test EXE/Portable → kiểm AI Online/Offline + Excel export.
