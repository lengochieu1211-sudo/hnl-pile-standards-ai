# HNL Pile Standards AI v1.15.0 — TCVN 10304 Advanced Verification

Ngày audit: 2026-08-24

## Nguồn duy nhất cho công thức tiêu chuẩn
- TCVN 10304:2025 PDF do người dùng tải lên.
- Source nền: HNL-Pile-Standards-AI-v1.14.0-TCVN10304-Verify-Pass1.
- Không thay logic `src/search.js`.

## Nâng trạng thái trong pass này

### VERIFIED numeric
1. Thử động — 7.3.3.2, CT (22)–(24), Bảng 11–14, trang 52–55.
   - Tách nhánh theo độ chối dư `s_a >= 0,002 m` và `< 0,002 m`.
   - CT (24) tính hệ số theta từ np, nf, A, Af, khối lượng và năng lượng va chạm.
   - Cọc BTCT dài trên 20 m / cọc thép theo chỉ dẫn chuyên dụng vẫn bị safety gate, không ép CT22/23 ngoài phạm vi.
2. Độ lún cọc đơn — 7.4.2, CT (30)–(35), Bảng 17, trang 59–60.
   - Kiểm `L/d > 5` và `G1 L/(G2 d) > 1`.
   - Tự chọn nhánh `k >= 7,5` hoặc `k <= 7,5`.
   - Có kv, lambda1, beta, chi, zeta0, mv và đường kính quy đổi.
3. Độ lún nhóm cọc — 7.4.3, CT (36)–(40), trang 61–62.
   - Lún nhóm cơ bản và lún từng cọc có tương tác `delta_ij`.
   - Chiều dài tương đương CT (39), độ cứng tương đối nhóm CT (40).
4. Móng khối quy ước — 7.4.4, CT (41)–(46), trang 62–65.
   - Tổng lún `s = s_ef + Delta s_p + Delta s_c`.
   - CT (42)–(45) được machine-code hóa.
   - `s_ef` vẫn phải đến từ tính nền theo TCVN 9362; HNL không bịa công thức ngoài TCVN 10304.

### VERIFIED_METHOD, không giả thành numeric VERIFIED
5. Bè-cọc — 7.4.5, trang 65–67.
   - Đã số hóa điều kiện áp dụng và checklist tương tác cọc–đất, bè–đất, cọc–cọc, cọc–bè.
   - TCVN 10304 yêu cầu mô hình không gian / phi tuyến hoặc tấm trên nền với hệ số phản lực hiệu chỉnh từ mô hình tương tác; tiêu chuẩn không cung cấp một công thức đóng duy nhất để Excel tự tính toàn bộ bè-cọc.
   - Vì vậy trạng thái đúng là `VERIFIED_METHOD`. Kết quả mô hình số có thể nhập lại để lập thuyết minh/provenance, nhưng HNL không tự sáng tác hệ số nền.

## Sửa source thật
- Thêm `src/tcvn10304-advanced.js`:
  - `calcDynamic10304`
  - `calcSingleSettlement10304`
  - `calcGroupSettlement10304`
  - `calcEquivalentBlock10304`
  - `verifyPiledRaft10304`
  - `T10304_TABLE17`
- `src/engineering-router.js`:
  - dynamic / lún đơn / lún nhóm / khối quy ước => VERIFIED.
  - bè-cọc => VERIFIED_METHOD.
  - AI nhận deterministic context trước khi provider diễn giải.
- `src/codepacks.js`: cập nhật trạng thái + machine expression cho nhóm CT (22)–(46) đã xác minh.
- `src/excel-export.js`: thêm `export10304AdvancedWorkflowWorkbook()` cho dynamic, settlement-single, settlement-group, equivalent-block và piled-raft method workbook.
- Version đồng bộ lên v1.15.0.

## Benchmark / test thực chạy
- `npm test`: **176/176 PASS, 0 FAIL**.
- Version Gate: PASS.
- Search Brain Guard: PASS.
- Normalized search SHA-256: `f9b65e5e6fb61dcca233a4fe43950e3174c73536f2fa83452da3041fbd0021d2`.
- `node --check` các file thay đổi: PASS.
- Secret-like key scan: không phát hiện khóa thật theo pattern kiểm tra.
- Standalone production workbook: formula error scan **0** (`#REF!/#DIV0!/#VALUE!/#NAME?/#N/A`).

## Build
- `npm run build:web`: **CHƯA PASS trong sandbox** vì `vite: not found` (exit 127). Không báo build PASS giả.
- Cần GitHub Actions / Windows runner chạy `npm ci` rồi build Setup/Portable để xác nhận artifact Windows.

## Trạng thái TCVN 10304 sau pass này
- Đã VERIFIED số học: cọc chống; cọc đóng/ép; cọc nhồi/khoan; cọc vít; tải tĩnh; thử động; CPT; SPT; lún cọc đơn; lún nhóm; móng khối quy ước.
- Bè-cọc: VERIFIED_METHOD đúng bản chất tiêu chuẩn, không có phép tính đóng độc lập để nâng thành numeric VERIFIED.
- `Ảnh hưởng thi công` CT (47)–(48), Bảng 18 vẫn REVIEW trong v1.15.0; chưa đưa numeric engine trong pass này.

## Kết luận
Không thể nói “100% mọi bài TCVN 10304 đều numeric” khi bè-cọc phụ thuộc mô hình số và ảnh hưởng thi công (47)–(48) còn REVIEW. Tuy nhiên 4 cụm còn lại được yêu cầu trong pass này đã có deterministic Calculation Engine + Excel formulas; bè-cọc đã được khóa đúng ở VERIFIED_METHOD thay vì tạo công thức giả.
