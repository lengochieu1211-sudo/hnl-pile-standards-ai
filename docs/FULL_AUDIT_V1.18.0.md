# HNL Pile Standards AI v1.19.0 — TCVN 5574 Deep Verification Pass 1

Ngày audit: 2026-08-24

## 1. Nguồn và nguyên tắc

- Source code nền duy nhất: `HNL-Pile-Standards-AI-v1.17.0-TCVN10304-Full-Audit.zip`.
- Nguồn tiêu chuẩn: PDF `TCVN 5574:2018` do người dùng cung cấp.
- Không thay `src/search.js`; Search Brain v1.9.23 giữ nguyên SHA-256 chuẩn hóa `f9b65e5e6fb61dcca233a4fe43950e3174c73536f2fa83452da3041fbd0021d2`.
- Formula chỉ được ghi `VERIFIED` khi đã đối chiếu PDF và có deterministic workflow. Generic single-formula evaluator vẫn không được phép chạy các workflow ghép công thức của 5574.

## 2. VERIFIED trong pass này

### 2.1 Vật liệu
- Bảng 7: Rb/Rbt; Bảng 10: Eb; Bảng 13: Rs/Rsc; Bảng 14: Rsw.
- Es cho thép thanh theo 6.2.3.3: 2,0×10^5 MPa.
- Benchmark bắt buộc giữ: B30 Rb=17 MPa, Rbt=1,15 MPa, Eb=32500 MPa; CB400-V Rs=Rsc=350 MPa, Rsw=280 MPa.

### 2.2 Uốn
- CT (31)–(32): xiR và epsilon_s,el; epsilon_b2 ngắn hạn theo 6.1.4.2.
- CT (33)–(35): tiết diện chữ nhật.
- CT (36)–(38): tiết diện T/I có cánh nén; tự kiểm vùng nén trong cánh hay xuống sườn.

### 2.3 Nén lệch tâm tiết diện chữ nhật
- Độ lệch tâm ngẫu nhiên `ea >= max(L/600, h/30, 10 mm)`.
- Phân biệt hệ tĩnh định và siêu tĩnh khi xác định e0.
- CT (40)–(43): điều kiện bền và tự chọn x theo xiR.
- CT (44)–(48): eta, Ncr, D, kb, phiL khi có đủ L0/I/Is/ML/ML1.
- Nếu thiếu dữ liệu uốn dọc, engine để eta=1 nhưng trả warning; không tuyên bố kiểm cột mảnh đầy đủ.

### 2.4 Lực cắt
- CT (88): kiểm dải bê tông.
- Nhánh đơn giản CT (92)–(96): qsw, Qb1, Qsw1, Q<=Qb1+Qsw1 và điều kiện tối thiểu cốt đai.
- Engine kiểm đồng thời CT88 và CT93.

### 2.5 Xoắn thuần
- CT (102): giới hạn dải bê tông.
- CT (107), (109), (111)–(113): qsw1, delta, Tsw1, Ts1, tổng sức kháng.
- Kiểm tỷ số `qsw1*Z1/(Rs*As1)` trong khoảng 0,5–1,5.

### 2.6 Nén cục bộ không lưới thép
- CT (116)–(118): N<=psi*Rb,loc*Ab,loc; Rb,loc=phi_b*Rb; phi_b=0,8*sqrt(Ab,max/Ab,loc), giới hạn 1,0–2,5.

### 2.7 Chọc thủng do lực tập trung
- CT (123)–(128): Ab=u*h0, Fb,u=Rbt*Ab, qsw, Fsw,u.
- Cốt ngang chỉ được kể nếu Fsw,u >= 0,25 Fb,u; phần cốt ngang dùng tính bị khống chế để tổng sức kháng không vượt 2 Fb,u.

## 3. Các nhánh vẫn REVIEW — không tự tính

- Nén gần đúng tâm CT (49)–(50) và Bảng 16.
- Các nhánh lực cắt ngoài workflow CT88 + CT92–96 hiện hành.
- Xoắn kết hợp uốn/cắt, các kiểm tra tương tác ngoài xoắn thuần hiện hành.
- Nén cục bộ có lưới thép CT (119)–(122).
- Chọc thủng có mô men tập trung từ CT (129) trở đi.
- Nứt; biến dạng; ứng suất trước; neo/nối; tiết diện tròn/vành khuyên; công xôn ngắn; các Phụ lục chưa benchmark đầy đủ.

## 4. AI → workflow → Excel

- Router deterministic nhận dạng các workflow 5574 đã VERIFIED trước khi gọi provider AI.
- Gemini/OpenAI/Ollama chỉ nhận kết quả Calculation Engine để diễn giải; không được thay số.
- `src/main.js` cho nút Xuất Excel trên các workflow VERIFIED của pass này.
- `export5574WorkflowWorkbook()` tạo workbook riêng cho material/uốn/nén lệch tâm/cắt/xoắn/nén cục bộ/chọc thủng.
- Workbook có input, bảng vật liệu, công thức Excel thật, trace từng bước, kiểm tra, thuyết minh riêng theo module, provenance và data-bar hệ số sử dụng.

## 5. Benchmark

- Uốn chữ nhật B30/CB400-V: x=102,941176 mm; Mu=261,727941 kN.m — PASS.
- Uốn T: nhận đúng vùng nén trong cánh; Mu=443,719363 kN.m — PASS.
- Nén lệch tâm mẫu: Ne=426 kN.m; RHS=547,975067 kN.m — PASS.
- Cắt mẫu: Qstrip=688,5 kN; Qu=171,328125 kN; Q=200 kN → KHÔNG ĐẠT đúng logic — PASS benchmark.
- Xoắn mẫu: Tstrip=76,5 kN.m; tỷ số cốt thép hợp lệ; workflow PASS.
- Nén cục bộ: phi_b=1,6; Nu=1088 kN — PASS.
- Chọc thủng: Fb,u=621 kN; Fu=1069 kN — PASS.

## 6. Test và build

- `npm test`: **199/199 PASS, 0 FAIL**.
- Version Gate: PASS v1.19.0.
- Search Brain Guard: PASS; hash chuẩn hóa giữ nguyên.
- JS syntax scan: PASS.
- Secret pattern scan: 0 hit đối với các mẫu API/private-key được quét.
- Excel production formula scan: 0 lỗi hiển nhiên `#REF/#DIV0/#VALUE/#NAME/#N/A` trong artifact evaluator.
- `npm run build:web`: **CHƯA PASS** trong sandbox vì `vite: not found`. Không báo build PASS giả.

## 7. Root causes / hardening

- Registry 5574 trước đây chỉ có material + uốn cơ bản VERIFIED; các workflow khác bị khóa REVIEW dù Code Pack đã lập chỉ mục sâu. Pass này thêm dedicated calculation engine thay vì mở generic evaluator.
- Nén lệch tâm trước đây chưa phân biệt đầy đủ tĩnh định/siêu tĩnh và chưa có đường CT44–48. Đã tách rõ.
- Excel trước đây chưa có thuyết minh chuyên biệt cho từng workflow cắt/xoắn/nén cục bộ/chọc thủng. Đã thêm nội dung module-specific.
- `CODEPACK_5574.formulas` giờ đánh dấu `workflowComputable=true` cho công thức đã xác minh, nhưng vẫn giữ `computable=false` ở generic evaluator để tránh chạy rời công thức sai ngữ cảnh.
