# HNL Pile Standards AI v1.16.0 — Audit

## Scope
Source chính: v1.15.0 do người dùng cung cấp. Đối chiếu TCVN 10304:2025 PDF gốc người dùng tải lên, tập trung 7.6.5–7.6.7, trang 68–69.

## TCVN 10304:2025 — ảnh hưởng thi công

### VERIFIED: Bảng 18 — trang 69
Vận tốc dao động cho phép Va, cm/s:
- BTCT toàn khối / kết cấu khung thép: 4.5 / 3.0 / 1.0.
- Kết cấu khung BTCT: 3.0 / 1.5 / 0.5.
- Kết cấu khối xây gạch / panel: 2.0 / 1.5 / 0.4.
Ba cột lần lượt tương ứng: cát chặt hoặc đất sét IL<0.5; cát chặt vừa hoặc đất sét 0.5≤IL≤0.75; cát xốp hoặc đất sét IL>0.75.

### VERIFIED: CT (47) — trang 69
V = 2π·α·δ
- V: cm/s.
- α: biên độ dao động, cm.
- δ: tần số dao động, Hz (1/s).
- α và δ phải từ thực nghiệm khi đóng thử cọc.
Engine tính V và so sánh với Va tra Bảng 18.

### VERIFIED: CT (48) — trang 69
Fc,min ≥ γc·Rk
- Fc,min: kN.
- Rk: sức chịu tải tiêu chuẩn của cọc tại các độ sâu hạ cọc khác nhau, kN.
- γc = 1.2 được tự động áp dụng CHỈ khi tốc độ hạ cọc ≤3 m/min theo văn bản tiêu chuẩn.
- Nếu tốc độ >3 m/min mà người dùng không cung cấp γc có căn cứ, engine dừng và yêu cầu input; không suy đoán.

## AI → workflow → Excel UI
Chat AI bây giờ lưu metadata workflow deterministic trên từng câu trả lời. Khi workflow TCVN 10304 là VERIFIED/VERIFIED_METHOD và đề bài đủ input, câu trả lời hiển thị nút `⇩ Xuất Excel`.

Ánh xạ UI được kiểm tra cho toàn bộ registry TCVN 10304:
- cọc chống
- cọc đóng/ép
- cọc nhồi/khoan
- cọc vít
- tải tĩnh
- thử động
- CPT
- SPT
- lún cọc đơn
- lún nhóm
- móng khối quy ước
- bè-cọc
- ảnh hưởng thi công

Cọc đóng/ép dùng workbook nhiều lớp hiện hữu. Các workflow còn lại dùng `export10304AdvancedWorkflowWorkbook`; v1.16 bổ sung template công thức cho cọc chống, cọc nhồi/khoan, cọc vít, tải tĩnh, CPT, SPT và ảnh hưởng thi công.

## Safety gates
- Không hiện nút Excel tính toán nếu workflow chưa đủ input numeric.
- VERIFIED_METHOD (bè-cọc) vẫn giữ bản chất phương pháp; không tự sáng tác công thức đóng.
- CT (48) không tự lấy γc ngoài điều kiện tốc độ ≤3 m/min.
- Search brain `src/search.js` không bị sửa.

## Tests
- `npm test`: 182/182 PASS, 0 FAIL.
- Version Gate v1.16.0: PASS.
- Search Brain Guard: PASS; normalized SHA-256 `f9b65e5e6fb61dcca233a4fe43950e3174c73536f2fa83452da3041fbd0021d2`.
- New v1.16 tests cover CT47, CT48, exact Bảng 18 values, Code Pack status, router payload, and UI/Excel mapping for all TCVN10304 workflows.
- JS syntax checks for modified modules: PASS.
- Secret pattern scan: no API key/private-key pattern found.
- Production Excel v1.16 formula scan: 0 obvious `#REF/#DIV0/#VALUE/#NAME/#N/A` errors in artifact evaluator.

## Not reported as PASS
`npm run build:web` cannot run in this sandbox because `vite` executable is not installed (`sh: vite: not found`). Therefore real Vite browser build and actual pointer-click execution in a rendered browser are NOT claimed as runtime PASS here. Static event wiring, workflow mapping, deterministic engine tests, version/search gates all PASS.
