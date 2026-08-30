# HNL Pile Standards AI v1.27.0

**Version duy nhất của ứng dụng:** v1.27.0  
**Giai đoạn chứng nhận:** Master System Audit  
**Golden Baseline:** v1.25.7  
**Search Brain:** v1.9.23 — LOCKED  
**Baseline source trước cập nhật:** `660bda57ca50a7326e13c3b858f05c4864875f3c`

## Mục tiêu v1.27.0

- Chuẩn hóa Excel Production theo hướng tiếng Việt, dropdown cho lựa chọn hữu hạn và công thức thật có thể thay input.
- Tăng tương thích Excel cũ; không để đường tính Production phụ thuộc tùy tiện vào `LET/XLOOKUP/LAMBDA`.
- Bổ sung biểu đồ Excel native động khi dữ liệu kỹ thuật phù hợp.
- Sửa DCE UDF Golden chạy chéo Linux/Windows.
- Chạy **Master System Audit & Golden Certification** trên Web + Calculation Engine + Excel + Windows + CI + provenance + cross-workflow.
- Lập **Gap Matrix P0 → P1 → P2**; chỉ sửa theo nhóm nguyên nhân gốc và thêm gate chống regression.

## Quy ước version

- **Chỉ có một version sản phẩm: `v1.27.0`.** Đây là version trên Web, EXE, PWA, package, changelog, release và artifact hiện hành.
- Các tên **Pass 1 / Pass 2 / Master Audit** chỉ là giai đoạn công việc, **không phải version**.
- **Golden Baseline `v1.25.7`** là danh tính bộ bằng chứng Golden đang dùng để chứng nhận; giữ nguyên để bảo toàn lịch sử benchmark.
- **Search Brain `v1.9.23 LOCKED`** là lõi tìm kiếm đã khóa; không phải version ứng dụng.

## Cập nhật bằng GitHub Desktop

1. Giải nén gói `HNL-Pile-Standards-AI-v1.27.0-MASTER-AUDIT-FULL-OVERWRITE.zip`.
2. Copy toàn bộ nội dung bên trong thư mục đã giải nén.
3. GitHub Desktop → **Repository → Show in Explorer**.
4. Dán vào thư mục gốc `hnl-pile-standards-ai` → **Replace the files in the destination**.
5. GitHub Desktop → **Changes** → Commit: `audit: v1.27.0 master system audit and golden certification`.
6. **Push origin** và chờ Actions.
7. Chưa gọi `PRODUCTION VERIFIED` cho tới khi Master Audit/RC Final đóng hết P0/P1 theo quy định.

## Lịch sử phát hành

### v1.27.0 — Excel Production Compatibility + Master System Audit Foundation
Ngày: 2026-08-26

- Một version duy nhất: v1.27.0.
- Excel Production: dropdown tiếng Việt, mã nội bộ ẩn, native chart cho các workflow đã triển khai.
- SPT explicit dùng VLOOKUP + IF + MIN cho q_b/f_s để tăng tương thích Excel.
- Windows DCE path repair.
- Master Audit sinh Gap Matrix P0/P1/P2 và chặn RC theo mức độ nghiêm trọng.
- Golden Baseline v1.25.7 và Search Brain v1.9.23 LOCKED được giữ như danh tính bằng chứng/lõi khóa.

### v1.25.7 — Universal Formula Paste + Small Panel Responsive Fix
Ngày: 2026-08-24

- Recognize sigma_cu/σcu/σ_{cu} and concrete compressive-strength wording as the same deterministic input.
- Recover common stripped LaTeX command tokens before math rendering.
- Remove assistant-panel horizontal overflow and switch soil-layer inputs/results to responsive cards on narrow widths.
- Add regression tests for sigma_cu parsing and responsive CSS gates.

### v1.25.6 — Engineering Symbol & Formula Normalizer
Ngày: 2026-08-24

- Paste formulas directly into Q&A and Chat-to-Calculation textareas from PDF/Word/LaTeX without parser breakage.
- Normalize fractions, subscripts/superscripts, Greek symbols, units, decimal commas, citation wrappers and hidden clipboard characters.
- Keep raw user wording for chat while deterministic routing/calculation/export uses a normalizedQuestion copy.
- Added regression for A=A_p=0,09 m² plus square 300x300 mm geometry so pile tip area is not falsely requested again.

### v1.25.5 — Chat-to-Calculation-to-Excel + Math Display Fix
Ngày: 2026-08-24

- Hỏi đáp kỹ thuật luôn hiện hành động rõ ràng: Xuất Excel, Bổ sung dữ liệu/Mở trong Tính và Xem nguồn tính theo trạng thái workflow.
- Đề bài từ Hỏi đáp được chuyển sang Calculation Engine; có thể bổ sung trực tiếp trong tab Tính rồi chạy lại mà không nhập lại từ đầu.
- Excel từ Hỏi đáp lấy payload deterministic của Calculation Engine và tiếp tục dùng Lean Formula-Only exporter.
- Sửa renderer công thức cho LaTeX inline dạng $...$, \(...\), \approx, \text{kN}, chỉ số dưới/trên; không còn lộ chuỗi LaTeX thô như ảnh lỗi.
- Giữ safety gate: REVIEW/INDEXED không xuất Excel số học; VERIFIED thiếu dữ liệu chỉ cho bổ sung dữ liệu.

### v1.25.4 — Full Table Golden Benchmark
Ngày: 2026-08-24

- Added 1,130 Golden cases across TCVN 10304 tables 2,3,4,6,7,8,12,15,16,17 covering exact/mid/boundary/outside/sparse-cell policies.
- Fixed bilinear sparse-grid bug: Bảng 8 now evaluates only the requested IL bracket instead of unrelated blank columns.
- Full benchmark now passes 1,130/1,130; results exported to JSON and Excel audit workbook.
- Search brain remains unchanged.

### v1.25.3 — Interpolation & Table Audit
Ngày: 2026-08-24

- Strict shared interpolation engine: exact, linear 1D, bilinear 2D, explicit boundary plateau, no silent extrapolation.
- TCVN 10304 Tables 2/3/6/7/8/12/15/16/17 classified and synchronized between Calculation Engine and Excel.
- Driven-pile side friction automatically splits soil layers into subsegments no thicker than 2 m.
- CPT Table 15 intermediate values are blocked unless a sourced manual override is supplied; Table 16 uses local linear interpolation only through numeric cells.
- Table 17 no longer clamps outside nu 0..0.5; mv interpolates locally and zeta0 nu=0.5 uses the verified limiting value 0.25.

### v1.25.2 — Lean Workbook Audit + True Recalculation
Ngày: 2026-08-24

- TCVN 7888 workbook lookup values now recalculate from Type/Class/D using Excel formulas; no export-time frozen table results.
- Removed QA benchmark sheet from TCVN 5574 Annex D/L/M user workbooks.
- Fixed a TCVN 5574 result cell that contained formula text instead of a live Excel formula.
- Production workbook audit gates check lean sheets, formula-only result paths and input-driven recalculation.

### v1.25.1 — Lean Export + Formula-Only Production
Ngày: 2026-08-24

- Excel export now dispatches to the exact workflow workbook; unrelated standard/module sheets are not included.
- Production result cells remain Excel formulas linked to input/table sheets instead of copying deterministic HNL numeric results as dead values.
- Golden/benchmark data remains QA-only; Image provenance is included only when confirmed image input exists.
- REVIEW/INDEXED numeric export remains blocked.

### v1.25.0 — Unified Production Excel Exporter
Ngày: 2026-08-24

- All AI/Calculation Engine engineering exports use one v1.25.0 production workbook template.
- Vietnamese workbook includes TCVN 7888, 10304, 5574 modules, charts, Golden Test and provenance.
- Each export injects normalized input, deterministic result and confirmed image provenance into the unified workbook.
- REVIEW/INDEXED numeric export remains blocked.

### v1.24.0 — Image-to-Engineering Input · Confirm-before-Calculate
Ngày: 2026-08-24

- Chat supports image attach, paste and drag-drop.
- Local OCR hint + Vision structured extraction + mandatory user confirmation before deterministic calculation.
- Golden Image tests for TCVN 7888, TCVN 10304 and TCVN 5574.
- Fixed false circular-section routing for phrase 'tiết diện trong ảnh'; TCVN 7888 Excel button is visible in AI chat.

### v1.23.0 — Full 3-TCVN End-to-End Audit · TCVN 7888 AI-to-Excel
Ngày: 2026-08-24

- TCVN 7888 free-text deterministic workflow and safety gates.
- TCVN 7888 specialized AI-to-Excel production workbook.
- Golden Engineering benchmark matrix for all three standards.
- Search brain hash remains unchanged; build status reported honestly.

### v1.22.0 — TCVN 5574 Annex D / L / M verification pass
Ngày: 2026-08-24

- Phụ lục D: D.1-D.4/D.6 + D.7 verified branches; D.5 remains provenance-required input.
- Phụ lục L: Bảng L.1 mục 1-3 verified lookup.
- Phụ lục M: M.4.1.3, Bảng M.1-M.4 và M.2 verified branches.
- Calculation Engine ↔ Excel benchmarks and router wiring added.

### v1.21.0 — TCVN 5574 Detailing · Anchorage/Lap · Annex G/H · Annex F Safety Gate
Ngày: 2026-08-24

- Neo cốt thép CT (255)–(258): Rbond, L0,an, Lan và Ns với safety gate α.
- Nối chồng CT (259): tự chọn α=1,2 kéo / 0,9 nén cho trường hợp thông thường; khóa d>40 mm.
- Phụ lục G: chốt bê tông G.1–G.3; Phụ lục H: công xôn ngắn H.1 với giới hạn L1/h0≤0,9.
- Phụ lục F: vành khuyên F.1–F.6 và tròn F.7–F.10 đã machine-verified; F.9/F.10 giải lặp hội tụ, benchmark HNL ↔ Excel.
- Calculation Engine ↔ Excel benchmark bắt buộc trước khi VERIFIED.

### v1.20.0 — TCVN 5574 Deep SLS · Cracked deformation · Shear deformation · Prestress friction/creep
Ngày: 2026-08-24

- Số hóa Bảng 6 Rb,ser/Rbt,ser; Bảng 12 Rs,ser; Bảng 17 acrc,u; Bảng 18 ma sát ứng suất trước.
- Độ võng có nứt CT (186),(193)-(204) và biến dạng trượt CT (181)-(184) cho nhánh dầm tựa đơn tải đều.
- Ứng suất trước: CT (214) ma sát + Bảng 18; CT (216) từ biến; nối vào tổng hao tổn.
- Benchmark HNL ↔ Excel và safety gates cho nhánh SLS sâu.

### v1.19.0 — TCVN 5574 Deep Verification Pass 1 · Material · Flexure · Eccentric · Shear · Torsion · Local · Punching
Ngày: 2026-08-24

- Xác minh sâu vật liệu và Es; εb2 ngắn hạn, CT (31)-(38) cho uốn chữ nhật/T/I.
- Nén lệch tâm tiết diện chữ nhật: độ lệch tâm ngẫu nhiên và CT (40)-(48), có safety gate N<Ncr khi đủ dữ liệu uốn dọc.
- Lực cắt: CT (88), (92)-(96); xoắn thuần: CT (102), (107), (109), (111)-(113).
- Nén cục bộ không lưới: CT (116)-(118); chọc thủng do lực tập trung: CT (123)-(128).
- Nối AI → deterministic workflow → Excel cho toàn bộ workflow TCVN 5574 đã VERIFIED trong pass này.
- Excel production có input, bảng vật liệu, công thức thật, tính từng bước, kiểm tra, thuyết minh module-specific, provenance và chỉ báo trực quan.

### v1.17.0 — TCVN 10304 full regression audit
Ngày: 2026-08-24


### v1.16.0 — TCVN 10304 Construction Effects · AI-to-Excel Wiring
Ngày: 2026-08-24

- Đối chiếu trang 68-69: Bảng 18, CT (47) V=2π·α·δ và CT (48) Fc,min≥γc·Rk; nâng workflow ảnh hưởng thi công lên VERIFIED.
- Bảng 18 được dùng để kiểm vận tốc dao động cho phép theo loại kết cấu và trạng thái cát/IL của đất sét.
- AI chat lưu metadata workflow deterministic và hiển thị nút Xuất Excel ngay trên câu trả lời khi đề bài đủ input.
- Đường AI → workflow → Excel được ánh xạ cho toàn bộ workflow TCVN 10304 trong registry; cọc đóng/ép dùng workbook nhiều lớp, các workflow còn lại dùng production exporter tương ứng.

### v1.15.0 — TCVN 10304 Advanced Verification · Settlement & Dynamic
Ngày: 2026-08-24

- Thử động CT (22)-(24) được nối Calculation Engine deterministic.
- Lún cọc đơn CT (30)-(35), Bảng 17; lún nhóm CT (36)-(40); móng khối quy ước CT (41)-(46) được chuyển sang workflow Verified có kiểm điều kiện và đơn vị.
- Bè-cọc 7.4.5 được xác minh phương pháp nhưng giữ VERIFIED_METHOD vì tiêu chuẩn yêu cầu mô hình tương tác/numerical model, không có công thức đóng để tự bịa.
- Thêm exporter Excel production cho dynamic, lún đơn, lún nhóm, khối quy ước và checklist bè-cọc.

### v1.14.0 — Universal Engineering Router · Deterministic AI Math
Ngày: 2026-08-24

- Thêm router nhận dạng bài toán trên 3 TCVN và chọn workflow kỹ thuật trước khi gọi AI.
- Kết quả số học VERIFIED do HNL Calculation Engine tạo; Gemini/OpenAI/Ollama chỉ diễn giải và phải giữ nguyên số.
- Thêm parse đề bài cọc đóng/ép cơ bản, tra B30/CB400-V và workflow uốn chữ nhật TCVN 5574 CT (33)-(35).
- Workflow REVIEW được định tuyến đúng Điều/Công thức/Bảng nhưng khóa tính số và Excel cho tới khi Verified.

### v1.12.2 — Math/LaTeX renderer fix
Ngày: 2026-08-24

- Chuẩn hóa delimiter LaTeX bị AI trộn giữa \\[...\\] và $$...$$.
- Render công thức kỹ thuật offline-safe: chỉ số dưới/trên, ký hiệu Hy Lạp, tổng, tích, phân số.
- Prompt bắt buộc provider dùng delimiter nhất quán để tránh tái diễn lỗi ký tự công thức.

### v1.12.1 — Compact AI header + readable answers
Ngày: 2026-08-24


### v1.12.0 — Verified engineering workflow + overlap-free UI
Ngày: 2026-08-24


### v1.11.2 — Windows Build Hash Guard · LF/CRLF Safe
Ngày: 2026-08-24

- Sửa 3 test hash search brain FAIL trên GitHub Actions Windows do LF bị checkout thành CRLF, không phải thay đổi logic RAG.
- Thêm .gitattributes để giữ LF ổn định cho JS/MJS/CJS/JSON/Markdown/YAML/HTML/CSS.
- Hash guard chuẩn hóa CRLF về LF trước SHA-256, vẫn phát hiện mọi thay đổi logic/nội dung thực tế trong src/search.js.
- Mô phỏng đúng hash Windows c0c900... và xác nhận toàn bộ 145 test PASS.

### v1.11.0 — Deep 3-TCVN Code Packs · Verified Tables · Excel Calculation Trace
Ngày: 2026-08-24

- Nạp sẵn Code Pack sâu cho TCVN 7888:2014, TCVN 10304:2025 và TCVN 5574:2018; AI định vị Điều/Bảng/Công thức trước khi đọc trang PDF gốc.
- Giữ nguyên search brain v1.9.23; Code Pack không thay tokenizer/ranking proven RAG.
- TCVN 7888: 18 công thức index, B.1–B.5 Verified; Bảng 1/Bảng 2 cấu trúc.
- TCVN 10304: 48 công thức + 18 bảng index; bảng tra đã đối chiếu mới cho automatic lookup.
- TCVN 5574: >300 công thức index; bảng vật liệu Rb/Rbt/Eb và Rs/Rsc/Rsw có lookup Verified.
- Xuất Excel từng công thức và toàn Code Pack; công thức chưa Verified chỉ xuất tham chiếu, không tự tính.
- Thêm regression cho deep Code Pack, material lookup, Excel wiring và giữ Golden Test cọc chống.

### v1.10.2 — Runtime Acceptance · NPH Table 2 · Verified Source Guard
Ngày: 2026-08-24

- Bổ sung Bảng 2 NPH từ TCVN 7888:2014 trang 12; calculator nạp đúng chiều dày, ứng suất hữu hiệu và ký hiệu Dk-D cho NPH, không dùng nhầm Bảng 1.
- Công cụ Verified chỉ mở khi tài liệu xác nhận đúng TCVN 7888:2014 qua metadata/tên đầy đủ hoặc nội dung PDF; bare 7888 và TCVN 7888:2008 bị từ chối.
- Thêm calcDraft giữ dữ liệu máy tính qua render; sửa source provenance để chỉnh tay không bị ghi nhầm là đã nạp Bảng 1/Bảng 2.
- Lịch sử tính có liên kết mở trang công thức/nguồn và metadata riêng cho tablePage/designation.
- Khóa điều kiện áp dụng Phụ lục B: PC yêu cầu σcu ≥ 60 MPa; PHC/NPH yêu cầu σcu ≥ 80 MPa trong calculator và công thức Verified.
- Giữ nguyên search brain v1.9.23; Golden Test cọc chống/cọc ma sát/hash tiếp tục khóa regression.
- Mở rộng Runtime Acceptance regression cho calculation/source/UI/version/offline/archive và responsive.

### v1.10.1 — Calculation Integrity · Unit-safe Formula · NPH Logic Audit
Ngày: 2026-08-24

- Sửa lỗi hệ số 1000 trong calculator động của công thức Phụ lục B: MPa × mm² được đổi từ N sang kN trước khi hiển thị và lưu lịch sử.
- Tách PC/PHC/NPH; NPH chỉ có cấp A/B/C và không tự nạp dữ liệu Bảng 1, tránh nhầm với Bảng 2.
- Bổ sung metadata đơn vị biến/kết quả/điều kiện cho công thức xác minh và liên kết nguồn chi tiết cho lịch sử tính toán.
- Khóa cứng AI/Vision formula gate: allowCompute cũ không còn đủ để bật calculator; chỉ công thức đã verified sau đối chiếu trang gốc mới tính tự động.
- Giữ nguyên search brain v1.9.23; bổ sung regression test cho unit conversion, NPH class logic và responsive/version wiring.
- Pin dependency trực tiếp và mở rộng Version Gate cho Service Worker/runtime version để giảm lệch build.

### v1.10.0 — Professional Workspace · Evidence · Diagnostics · Stable RAG
Ngày: 2026-08-23

- Giữ nguyên byte-for-byte lõi src/search.js của v1.9.23; test hash tiếp tục khóa bộ tìm kiếm đã tra đúng “cọc chống”.
- Thêm workspace tự lưu/khôi phục, bookmark/ghi chú vùng PDF, ghim/phân loại/lọc thư viện và cảnh báo tài liệu cùng họ/phiên bản.
- Thêm Sức khỏe tài liệu, lập chỉ mục lại, gói chẩn đoán ZIP đã lọc key, Backup/Restore metadata + lịch sử + workspace.
- Mỗi câu trả lời hiển thị phương thức RAG/OCR/Vision/Native/Page Batch, độ tin cậy và nút kiểm tra nguồn; PDF >50 MB dùng Page Batch trang mục tiêu.
- Lịch sử chat có tìm/ghim/đổi tên/xuất; thêm So sánh và Kiểm tra mâu thuẫn hồ sơ, chế độ hiện trường, hiệu năng Nhẹ/Cân bằng/Mạnh, Undo/Redo.
- Windows workflow chạy smoke test Portable sau Verify EXE để kiểm tra runtime files, build-info và version trước upload artifact.

### v1.9.26 — v1.9.23 Search Brain · v1.9.25 Unified Scope/UI
Ngày: 2026-08-23

- Khóa lõi src/search.js byte-for-byte theo v1.9.23, bản đã tra được trường hợp thực tế “cọc chống”.
- Giữ UI/phạm vi v1.9.25 cho Tra cứu và Công thức nhưng tách parser trang sang src/scope.js để không chạm search brain.
- Tra cứu theo phạm vi tiếp tục dùng thuật toán searchEveryPage/TCVN 7888 của v1.9.23 trên đúng tập trang được chọn, không chồng ranking pipeline mới.
- Giữ UI de-duplication, Native PDF compact, UI State Guard, Offline AI/Ollama, archive và lịch sử hỏi đáp/tính toán.
- Thêm regression guard để phát hiện nếu search brain v1.9.23 bị thay đổi ngoài ý muốn.

### v1.9.25 — Unified Smart Scope · Formula/Lookup Target Scan · Professional UI
Ngày: 2026-08-23

- Tra cứu có phạm vi riêng: Thông minh, Vùng chọn, Trang hiện tại, Nhiều trang, Tài liệu hiện tại, Tài liệu đã tick hoặc Toàn thư viện.
- Công thức mặc định quét Trang hiện tại; có thể chọn vùng T▧, nhiều trang hoặc phạm vi rộng hơn. OCR/Vision không tự vượt ngoài phạm vi.
- Tra cứu Thông minh ưu tiên exact/RAG/text, Fresh PDF.js và Local OCR đúng trang mục tiêu để giảm RAM/token; không tự Vision toàn tài liệu.
- Đổi tên phạm vi sidebar thành Nguồn mặc định AI/RAG để tách rõ nguồn dữ liệu với phạm vi thao tác của từng tab.
- Giữ UI de-duplication v1.9.24, Native PDF compact, UI State Guard, Offline AI và archive hardening.

### v1.9.24 — Professional UI De-duplication · Single AI Status · Responsive Cleanup
Ngày: 2026-08-23

- Provider/model/trạng thái kết nối chỉ hiển thị một lần trong khối AI & kết nối; bỏ các badge Gemini/OpenAI trùng ở topbar và tiêu đề Trợ lý.
- Bỏ nút mở Cài đặt trùng và công tắc Khóa nguồn thứ hai; mỗi state có một nguồn điều khiển rõ ràng.
- PDF native tiếp tục thu gọn, bỏ badge provider lặp và thay câu chữ debug bằng mô tả người dùng.
- Giảm lặp version ở card phụ và dọn CSS ai-quickbar/quick-model cũ không còn render.
- Giữ responsive 3 panel trên >880px, toolbar PDF container-responsive và tab Trợ lý 4→3→2 cột.

### v1.9.23 — Runtime RAG Rescue · Stable Native Mode · Compact AI Settings
Ngày: 2026-08-23

- Sửa Đọc PDF native: đổi Tiết kiệm/Cân bằng/Toàn tài liệu commit ngay và không tự quay về Cân bằng sau render.
- PDF vượt giới hạn native không làm đổi mode: báo rõ và fallback sang RAG + OCR/Vision trang mục tiêu.
- Thêm Fresh PDF.js phrase rescue đọc lại text items trực tiếp từ Blob gốc khi index không tìm thấy cụm kỹ thuật như ‘cọc chống’.
- Gộp AI/Model/Kết nối về một nguồn điều khiển duy nhất trong Cài đặt; đầu panel chỉ còn summary compact.
- Thu gọn Đọc PDF native thành tóm tắt + Xem chi tiết, giữ trạng thái mở qua UI State Guard.

### v1.9.22 — Full Runtime Audit · Upstream Error Fidelity · Bridge Request Guard
Ngày: 2026-08-23

- Sửa bộ đọc phản hồi API ở Direct và Bridge để giữ nguyên thông báo lỗi dạng text/non-JSON; không còn biến lỗi upstream thành thông báo rỗng hoặc chung chung.
- Thêm giới hạn an toàn cho số message, ảnh, PDF và tổng payload base64 trên HNL Bridge để tránh treo ứng dụng hoặc cạn bộ nhớ khi request bất thường.
- Mở lại lịch sử chat nay cảnh báo rõ số PDF nguồn đang thiếu, tránh người dùng tưởng phiên cũ vẫn có đủ căn cứ để hỏi nối tiếp.
- Audit xác nhận OpenAI Responses API hỗ trợ detail low/auto/high ngay trên input_file PDF; giữ nguyên chế độ PDF native hiện có.
- Kiểm tra lại version gate, toàn bộ cú pháp JavaScript, regression test, Pages workflow và Windows Setup/Portable workflow.

### v1.9.21 — Native PDF AI · Persistent History · Hybrid RAG Citation
Ngày: 2026-08-23

- Gemini/OpenAI có chế độ đọc PDF native trực tiếp để hiểu text, ảnh, bảng, sơ đồ và công thức; HNL RAG chạy song song để tìm nhanh và giữ citation.
- Ba chế độ PDF AI: Tiết kiệm, Cân bằng và Toàn tài liệu; Cân bằng chạy RAG trước và chỉ bật PDF native khi câu hỏi rộng, căn cứ text yếu hoặc cần đọc hình/scan; Toàn tài liệu phải xác nhận khi có nguy cơ dùng nhiều quota/token.
- Gemini native bundle được giới hạn tổng tối đa 1000 trang và dưới ngưỡng PDF an toàn; OpenAI dùng Responses API input_file với detail low/auto/high và bundle raw dưới 42 MB.
- Lịch sử Hỏi đáp được lưu Local-first trong IndexedDB theo phiên, gồm provider/model, nguồn/citation và thời gian; mở lại phiên khôi phục các PDF nguồn còn tồn tại.
- Lịch sử Tính toán lưu input/result/source/appVersion và cho phép nạp lại dữ liệu; API key không được ghi vào lịch sử.
- Câu hỏi nối tiếp dùng ngữ cảnh các lượt trước để hiểu đại từ/ý tiếp theo nhưng không coi câu trả lời cũ là căn cứ kỹ thuật.
- Tăng timeout riêng cho PDF native lớn; giữ nguyên quy tắc retry model hiện tại và chỉ fallback model sau xác nhận OK.
- Giữ toàn bộ hardening v1.9.20: re-index, Exact Phrase Guard, visual target OCR/Vision, UI State Guard, Offline AI và version gate.

### v1.9.20 — PDF Text Reindex · Exact Phrase Guard · False-negative RAG Fix
Ngày: 2026-08-23

- Tự động tái lập chỉ mục PDF cũ từ Blob gốc bằng TEXT_INDEX_VERSION mới; không cần xóa/nhập lại tài liệu sau nâng cấp.
- Text extraction ghép các PDF.js text item theo tọa độ/khoảng cách hình học, không còn chèn khoảng trắng mù làm vỡ thuật ngữ như “C ọ c c h ố n g”.
- Compact exact matching là safety-net cho lớp chữ tách glyph; exact phrase scan chạy toàn bộ corpus trước semantic/top-k.
- Exact Phrase Guard ưu tiên trang nội dung/định nghĩa hơn trang mục lục; “cọc chống là gì” có thể tìm mục 6.2 thay vì chỉ mục 7.2.1.
- Nếu AI vẫn trả câu thiếu căn cứ dù HNL có exact body pages, ứng dụng retry một lần với ngữ cảnh hẹp và giữ nguyên provider/model.
- Thống kê RAG ghi textIndexVersion, số tài liệu được reindex, số trang exact/body và số trang Visual RAG đã kiểm tra.
- Giữ các sửa v1.9.19: TOC-targeted OCR/Vision, compact Settings UI, UI State Guard, Offline AI/Ollama và version gate.

### v1.9.19 — Hybrid Visual RAG · TOC Target OCR · Compact Settings UI
Ngày: 2026-08-23

- Sửa truy vấn tiếng Việt kỹ thuật: stop-word chỉ loại từ an toàn sau bỏ dấu; giữ các từ dễ trùng dấu như tải/trọng, bảng, co ngót, độ lún; “cọc chống là gì” rút đúng về “cọc chống”.
- Hybrid Visual RAG nhận diện mục lục có số trang, suy ra offset trang in ↔ trang PDF từ các đề mục đối chiếu và định vị đúng trang nội dung cần đọc.
- PDF hỗn hợp text + scan dùng pipeline có mục tiêu: text layer → OCR cục bộ TextDetector → chỉ gửi tối đa vài ảnh trang đích cho Vision trong cùng lượt hỏi; không tự OCR/Vision toàn bộ PDF.
- Dòng mục lục chỉ dùng để định vị, không được coi là nội dung định nghĩa; nếu trang ảnh không đọc đủ rõ vẫn phải báo không đủ căn cứ.
- Thu gọn Phiên bản/Build, Dữ liệu đầu vào và Chẩn đoán thành thông tin tóm tắt; chi tiết chỉ bung khi người dùng bấm Xem chi tiết.
- UI State Guard lưu cả trạng thái các khối chi tiết đang mở qua full-render, tránh người dùng phải mở lại sau thao tác kiểm tra/cập nhật.
- Chẩn đoán chỉ hiện điểm tổng quan bên ngoài (ví dụ 8/8 đạt); danh sách từng kiểm tra nằm trong phần chi tiết.
- Giữ toàn bộ sửa v1.9.18: OCR/API không nhảy vị trí, citation đúng docId, Ollama 11434 ready trước pull, responsive 3-panel và version gate.

### v1.9.18 — UI State Guard · Offline AI Ready · Full Logic/Responsive Audit
Ngày: 2026-08-23

- Sửa OCR/Chọn vùng không còn full-render làm PDF nhảy về đầu; giữ trang và vị trí cuộn.
- Sửa Kiểm tra kết nối API cập nhật kết quả tại chỗ, không kéo tab Cài đặt về đầu và không làm mất focus/key nháp.
- Thêm UI State Guard bảo toàn PDF scroll/page, panel scroll, thư viện scroll và focus qua các render cần thiết.
- Trước khi tải model, HNL Bridge bảo đảm Ollama API 11434 thật sự sẵn sàng; tự chạy ollama serve nếu cần và trả OLLAMA_NOT_READY rõ ràng.
- Cancel tải model Windows dừng cả process tree; giữ kiểm tra dung lượng và xác nhận trước download.
- Audit lại button delegation, responsive toolbar/container, model sync và version gate.
- Các nút thay đổi bố cục giữ nguyên viewport PDF thay vì ép scroll trang hiện tại về đầu.
- Citation sang PDF khác xác minh docId của viewer trước khi dùng shell trang, tránh nhảy/ render nhầm DOM tài liệu cũ.

### v1.9.17 — Full Source Audit · Unified AI Key · Local-first PDF Region OCR · Archive/Offline Hardening

- Sửa root cause API key PC: UI session key hiện cho cả Direct và Bridge; Test Connection, Models API và Chat dùng cùng provider-specific key trong bộ nhớ/session.
- Gemini catalog dự phòng luôn ghi rõ “Không xác minh được danh sách model”; Models API thật đọc phân trang và lọc model hỗ trợ generateContent cho picker chính.
- Text/Vision/Embedding retry model hiện tại trước; fallback chỉ đổi sau khi người dùng bấm OK, không tự chuyển provider/model.
- Smart PDF Region theo local-first: lấy text layer trong vùng → Chromium TextDetector nếu có → chỉ hỏi xác nhận trước khi gửi crop vùng chọn sang Vision AI; thêm menu Copy/Hỏi AI/Tra cứu/Tóm tắt/Dùng làm nguồn/Tìm toàn thư viện/Quét công thức.
- Desktop archive giữ đúng source path khi thư mục lồng/trùng tên, hỗ trợ nested archive; ưu tiên 7-Zip → WinRAR/UnRAR → tar → HNL Built-in RAR và có chẩn đoán engine/đường dẫn cài 7-Zip.
- Desktop mở UI trước khi chờ Bridge/Ollama; Bridge health phản hồi nhanh, chỉ bind localhost, thử cổng 8787–8799 và kiểm tra đúng nhận dạng HNL Bridge.
- Offline AI kiểm tra Ollama/disk/model folder, hiển thị ước tính dung lượng trước tải và chặn gói model nếu ổ trống thấp hơn mức dự phòng; vẫn yêu cầu OK trước mọi tải/đổi model.
- Giữ PDF.js legacy API/worker, responsive 3 panel, model sync một state, Gemini Models API phân trang, version gate và workflow bắt buộc đủ Setup + Portable EXE.

### v1.9.16 — PC AI Key Sync, Built-in RAR, One-click Offline AI & Smart PDF Select/OCR

- API key kiểm tra thành công được kích hoạt ngay cho phiên; Direct/Bridge/chat/model discovery dùng cùng key mà không ghi key xuống .env.
- RAR Desktop ưu tiên node-unrar-js tích hợp trong ứng dụng, sau đó mới fallback 7-Zip/WinRAR/tar; giữ hỗ trợ mật khẩu.
- Nếu thiếu Ollama, HNL có luồng cài tự động trên Windows và tiếp tục tải model Offline sau khi cài xong.
- PDF text layer cho phép bôi chọn/copy chữ; trang scan/ảnh tự chuyển OCR vùng, chỉ crop vùng chọn để giảm tải.
- Giữ PDF.js Legacy, responsive UI, model approval, version gate và Windows Setup/Portable verification.

### v1.9.14 — PDF Legacy Compatibility & Desktop AI Stability

- Sửa lỗi PDF getOrInsertComputed is not a function bằng pdfjs-dist legacy build cho cả main API và worker.
- Thêm Map/WeakMap getOrInsertComputed compatibility shim trước module để Web/Desktop không phụ thuộc engine JS mới.
- Giảm spam lỗi PDF: lỗi tương thích được nhận diện và toast được chống lặp.
- AI Offline kiểm tra Ollama rõ ràng trước khi pull model, tránh tác vụ giả chạy rồi mới lỗi ENOENT.
- Giữ model quickbar/Cài đặt đồng bộ, responsive toolbar/panel và Desktop startup ổn định từ v1.9.13.

### v1.9.13 — Desktop Fit, Single Model Source & Always-visible Settings

- Model văn bản dùng một nguồn trạng thái duy nhất; thanh AI và Cài đặt luôn đồng bộ sau mọi chuyển model được xác nhận.
- Cài đặt dùng cùng hộp chọn model với quickbar, loại bỏ ô model độc lập gây lệch trên/dưới.
- Tabs Trợ lý dùng container query 4/3/2 cột nên Cài đặt luôn hiện, không phụ thuộc cuộn ngang.
- Electron tự co cửa sổ theo work area của Windows, tránh mở 1500x940 vượt màn laptop/scale cao.
- Bridge health không còn chờ Ollama 2.5 giây; Desktop xác minh HNL Bridge, thử cổng 8787-8791 và mở UI trước khi kiểm tra Ollama.
- Ollama chạy nền tùy chọn, không chặn AI Online/PDF khi máy chưa cài Ollama.

### v1.9.12 — Collision-proof Reader Toolbar & Gemini Model Sync

- Toolbar PDF dùng container query theo chiều rộng thực của vùng đọc và tự chuyển 1/2/3 hàng, loại bỏ lỗi nút 1 trang đè lên tên tài liệu.
- Chia điều khiển PDF thành nhóm chế độ đọc, zoom, trang và bố cục; panel desktop co có giới hạn nhưng không tự biến mất.
- Đồng bộ Gemini Web + Bridge với gemini-3.7-flash, catalog đầy đủ hơn và Models.list phân trang; trạng thái nêu rõ model API tìm thấy và model chat phù hợp.
- Catalog dự phòng luôn được đánh dấu chưa xác minh; mọi chuyển provider/model tiếp tục bắt buộc người dùng bấm OK.
- Đồng bộ default Claude giữa Web và Bridge; thêm test chống overlap toolbar và lệch default/model catalog.

### v1.9.11 — Responsive Model Picker, Gemini Catalog & Windows Build Fix

- Thay native model select bằng modal chọn model có tìm kiếm, trạng thái xác minh và nhập model thủ công để không che tab Trợ lý.
- Tabs Trợ lý dùng một hàng cuộn ngang, chống chồng lấn ở 1366x768 và Windows scale 125%.
- Cập nhật Gemini catalog hiện hành và Models.list đọc đủ phân trang; khi không có API key hiển thị rõ catalog gợi ý, khi có key hiển thị danh sách đã xác minh.
- Giữ bắt buộc xác nhận OK cho mọi chuyển provider/model và fallback.
- Sửa PowerShell Validate Windows builder config bị nội suy ${target} làm hỏng lệnh Node trước khi build EXE.

### v1.9.10 — Full Version Sync, Logic & UI Hardening

- Version Gate mới đồng bộ package.json, README, changelog, release hiện hành, BUILD_METADATA và build-info sinh thử từ chính source.
- Loại bỏ assertion version cũ 1.9.8 trong test; test hiện đọc version động từ package.json để không lệch khi phát hành bản mới.
- Web/Windows Actions có bước Version Gate riêng trước test/build; Pages nâng checkout/setup-node lên v5 để tránh cảnh báo Node action cũ.
- Giữ nguyên cơ chế hỏi OK trước mọi thay đổi Text/Vision/Embedding/provider; Refresh model và Kiểm tra kết nối không commit cài đặt nháp/API key.
- Giữ layout tự co 3 vùng trên desktop và mobile tab dưới 880 px; panel không tự biến mất do resize.
- Windows build tiếp tục tách artifactName Setup/Portable và verify đủ cả hai EXE trước upload.

### v1.9.9 — Full Logic, UI & Version Hardening

- Thêm Version Gate: package.json là nguồn version duy nhất; test/build dừng ngay nếu README, changelog hoặc release hiện hành lệch version.
- Mọi thay đổi Text/Vision/Embedding model đều phải được người dùng bấm OK trước khi áp dụng; refresh/test không còn âm thầm lưu cài đặt.
- API key chỉ ghi vào sessionStorage khi bấm Lưu cài đặt; gõ thử/refresh/test không tự lưu key.
- Danh sách model phân biệt model đã xác minh qua API/Ollama với catalog gợi ý; fallback chỉ đề nghị model đã xác minh và vẫn bắt buộc OK.
- Cài bộ model Offline và cấu hình đề xuất theo máy đều hỏi xác nhận trước khi đổi model hiện tại.
- Chuẩn hóa responsive 3 vùng: desktop tự co thay vì mất panel; mobile chuyển tab; các nút phục hồi luôn có đường mở lại.
- Workflow Web/Windows chạy Version Gate trước test/build và Windows chỉ upload khi xác minh đủ Setup + Portable EXE.

### v1.9.8 — Dynamic Model Picker, User-approved Fallback & Windows EXE Build Fix

- Hiển thị bộ chọn AI và model trực tiếp trên panel Trợ lý.
- Làm mới danh sách model không tự đổi model đang dùng.
- Khi quota/rate limit/503 xảy ra, HNL retry model hiện tại trước; mọi chuyển model dự phòng đều phải được người dùng bấm OK.
- Không tự đổi sang nhà cung cấp AI khác và không tự đổi Vision model.
- Bridge giữ upstream status để nhận biết 429/503/404 và xử lý đúng loại lỗi.
- Sửa cấu hình electron-builder: Setup/Portable dùng artifactName riêng, loại bỏ macro ${target} gây lỗi build Windows.
- Workflow Windows xác minh đủ Setup EXE và Portable EXE trước khi upload artifact.

### v1.9.7 — Windows EXE Build Fix

- Tách artifactName riêng cho NSIS Setup và Portable, loại bỏ macro ${target} không được electron-builder hỗ trợ.
- Workflow Windows xác minh đủ cả Setup EXE và Portable EXE trước khi upload artifact.

### v1.9.6 — Fluid Responsive Layout

- Desktop giữ 3 vùng Thư viện/PDF/Trợ lý và tự co theo viewport thay vì tự ẩn panel.
- Dưới 880 px chuyển sang điều hướng 3 tab; splitter và kích thước panel đã lưu vẫn được bảo toàn.

### v1.9.5 — UI Settings Visibility & Automatic Windows EXE Build

- Sửa tab Trợ lý thành lưới 2 hàng/3-4 cột để Cài đặt luôn nhìn thấy, không còn bị cắt khỏi mép phải.
- Thêm nút bánh răng Cài đặt ngay trên header Trợ lý làm đường truy cập dự phòng.
- Cố định header + tabs của Trợ lý; chỉ phần nội dung bên dưới cuộn, tránh tab biến mất khi cuộn dài.
- Workflow Windows tự chạy khi push lên main, ngoài Run workflow/tag, nên mỗi lần cập nhật GitHub đều tạo artifact Setup/Portable EXE.
- Giữ nút phục hồi panel và toolbar PDF chống chồng lấn từ v1.9.4.

### v1.9.4 — UI Responsive & Panel Recovery

- Sửa lỗi thu gọn cả hai panel rồi không thể mở lại: thêm nút phục hồi Thư viện/Trợ lý nằm ngoài panel.
- Nút nguồn trên thanh đầu mở lại Thư viện; nút AI/Cài đặt mở lại Trợ lý trên desktop.
- Bỏ ID trùng của nút thu gọn/mở panel; bổ sung nút khôi phục bố cục 3 vùng.
- Toolbar PDF tự chuyển thành hai hàng ở màn hình vừa/1366 px để không đè lên vùng Trợ lý.
- Tối ưu breakpoint, header, tabs và độ rộng panel cho Windows 1366x768 và scale 125%.
- Đổi key layout v1.9.4 để không mang trạng thái panel bị kẹt từ bản v1.9.x cũ.

### v1.9.3 — Icon Pro & Windows Identity

- Tối ưu logo HNL cho icon Windows ở kích thước nhỏ, giảm khoảng trống và tăng độ nét/độ tương phản.
- ICO đa kích thước 16/20/24/32/40/48/64/128/256 px cho Setup, Portable, Desktop Shortcut, Start Menu và File Explorer.
- Bổ sung favicon 32/48/64 px và cập nhật PWA manifest dùng icon HNL tối ưu.
- Desktop đặt AppUserModelID cố định để icon taskbar/shortcut nhất quán trên Windows.

### v1.9.2 — Build Metadata & Update Diagnostics

- Ngày giờ trên giao diện lấy từ build-info.json được tạo sau khi Vite build thành công.
- Phiên bản chỉ lấy từ package.json; GitHub Actions và giao diện dùng chung một nguồn version.
- Hiển thị Build #, commit, nhánh, kênh Web/Desktop và nguồn build.
- Thêm kiểm tra cập nhật từ GitHub Releases và sao chép thông tin chẩn đoán.
- Service Worker dùng version từ URL đăng ký, build-info/changelog luôn network-first để tránh cache cũ.

### v1.9.1 — Offline Model Manager

- Quản lý model Ollama, dung lượng ổ đĩa, tiến độ tải, hủy tải và đổi thư mục model.

### v1.9.0 — Reader Pro

- PDF cuộn liên tục, kéo/pan, tìm trong PDF, focus reader và panel co giãn.
