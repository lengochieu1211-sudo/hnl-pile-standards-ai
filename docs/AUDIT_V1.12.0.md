# Audit HNL Pile Standards AI v1.12.0

## Nguồn audit
- Source nền: ZIP source mới nhất đã được sửa thành v1.11.2 trong chính cuộc trò chuyện này.
- Dữ liệu tiêu chuẩn dùng để xác minh Code Pack: 3 PDF người dùng tải trực tiếp: TCVN 7888:2014, TCVN 5574:2018, TCVN 10304:2025.
- `src/search.js` không thay logic.

## Các lỗi tìm thấy và root cause
1. AI có thể trả lời “Bảng 2/3 không có trong tài liệu” dù PDF TCVN 10304:2025 có đầy đủ.
   - Root cause: Code Pack trước chỉ có index bảng, chưa có dữ liệu cấu trúc Bảng 2/3/4 và prompt chưa khóa workflow tính toán.
2. Phần Tính vẫn thiên về một công thức TCVN 7888, chưa có workflow nhiều lớp cho TCVN 10304.
   - Root cause: chưa có Calculation Engine tách lớp địa chất, tra bảng và provenance.
3. Excel chưa có workflow đầy đủ cho bài toán cọc đóng/ép nhiều lớp.
   - Root cause: exporter chủ yếu xuất công thức đơn/Code Pack index.
4. Panel AI & kết nối/cài đặt chiếm chiều cao lớn, ở màn 1366x768/Windows scaling có cảm giác che vùng hỏi đáp.
   - Root cause: settings chi tiết luôn bung trong tab và `.panel-body` scroll chung; chat composer không được khóa trong flex flow riêng.
5. Cỡ chữ không đồng đều: một số nhãn 8.5–9.5px quá nhỏ, trong khi các card/toolbar tốn chiều cao.
   - Root cause: nhiều lớp CSS lịch sử chồng nhau theo version.

## Sửa code thật
- Thêm `src/pile-workflows.js`:
  - Bảng 2 `q_b` VERIFIED, trang chuẩn/PDF 32–33.
  - Bảng 3 `f_i` VERIFIED, trang chuẩn/PDF 33–34.
  - Bảng 4 `gamma_RR`, `gamma_Rf` VERIFIED, trang chuẩn/PDF 34–35.
  - Nội suy tuyến tính theo chú thích bảng.
  - Workflow cọc vuông/tròn, đóng bằng búa hoặc ép, nhiều lớp đất.
  - Provenance AUTO/VERIFIED và MANUAL khi override.
  - Thiếu IL/địa chất: trả danh sách dữ liệu thiếu, không bịa số.
- `src/main.js`:
  - Thêm UI workflow TCVN 10304:2025.
  - Tính từng lớp, hiển thị `h_i`, `z_tb`, `f_i`, `gamma_Rf`, `R_fi`, mũi cọc và tổng.
  - Thêm nút xuất Excel workflow.
  - AI guardrail đưa hình học chắc chắn + dữ liệu thiếu vào prompt.
- `src/ai.js`:
  - Bắt buộc AI không dừng ở chép công thức khi gặp bài toán kỹ thuật.
  - Không được nói Bảng 2/3/4 không có khi Code Pack đã nạp.
  - Chỉ dùng VERIFIED cho số học.
- `src/codepack-tables.js`:
  - Nạp dữ liệu cấu trúc Bảng 2/3/4 TCVN 10304.
  - Bổ sung mapping trang chuẩn/PDF cho bảng vật liệu TCVN 5574.
- `src/excel-export.js`:
  - Thêm workbook `HNL_TCVN10304_Coc_Dong_Ep_Workflow.xlsx` với INPUT, địa chất, bảng tra, CALC, kết quả, thuyết minh nguồn.
  - Công thức Excel thay input tự tính lại; override giữ dấu vết nhập tay.
- `src/styles.css`:
  - AI & kết nối thu gọn mặc định.
  - Header/tabs thấp hơn.
  - Chat có flex layout riêng, composer luôn ở đáy, không bị toolbar che.
  - Tăng font nội dung chính/field/button; giảm khoảng trống card.
  - Tối ưu container assistant ~315–420px và 1366x768/Windows 125%.

## VERIFIED hiện tại
### TCVN 7888:2014
- Bảng 1 PC/PHC.
- Bảng 2 NPH.
- Điều 6.2: PC >= 60 MPa; PHC/NPH >= 80 MPa.
- NPH chỉ A/B/C, không AB.
- Phụ lục B: B.1–B.5 đang dùng cho calculator vật liệu.

### TCVN 10304:2025
- Công thức (5)–(9) trước đây đã khóa Verified trong Code Pack.
- Bảng 1.
- **Mới: Bảng 2 q_b**.
- **Mới: Bảng 3 f_i**.
- **Mới: Bảng 4 gamma_RR/gamma_Rf**.
- Bảng 5, 9, 10, 14, 17, 18 đã có dữ liệu cấu trúc từ source trước.
- Workflow số học Verified mới: cọc đóng/ép không moi đất theo CT (9), phương pháp búa/ép.

### TCVN 5574:2018
- Bảng 7: Rb/Rbt cho bê tông nặng.
- Bảng 10: Eb.
- Bảng 13/14: Rs/Rsc/Rsw.
- Mapping trang chuẩn ↔ PDF cho các bảng trên được bổ sung.
- Các module còn lại vẫn giữ REVIEW/INDEXED nếu chưa xác minh công thức máy đầy đủ.

## REVIEW / chưa tự tính
- TCVN 10304: cọc nhồi/khoan, cọc vít, cọc ống thép, cọc liên hợp, tải tĩnh, thử động, CPT, SPT, lún cọc đơn, lún nhóm, khối quy ước, bè-cọc: vẫn có index sâu nhưng chưa tất cả workflow được chuyển sang Calculation Engine.
- TCVN 5574: uốn/nén/cắt/xoắn/chọc thủng/nứt/biến dạng/ứng suất trước/neo/nối/phụ lục: chưa toàn bộ công thức được Verified máy.

## Benchmark mới
- Đề: “tính toán sức chịu tải của một cọc vuông dài 12m và cạnh 0,4m được đóng vào đất dính”.
- Engine xác định ngay: A = 0,16 m²; u = 1,60 m; workflow 7.2.2.1/CT (9).
- Engine dừng đúng vì thiếu IL và phân lớp địa chất; không gán q_b/f_i giả.
- Khi cấp 4 lớp mẫu có IL: tính được từng lớp và tổng deterministic; cùng input cho cùng kết quả không phụ thuộc Gemini/OpenAI/Ollama.

## Test
- `npm test`: **152/152 PASS**.
- Golden search hash: PASS, normalized SHA-256 `f9b65e5e6fb61dcca233a4fe43950e3174c73536f2fa83452da3041fbd0021d2`.
- JS syntax scan: PASS.
- Version Gate v1.12.0: PASS.
- `npm run build:web`: **CHƯA PASS trong sandbox** vì `vite` chưa được cài; `npm install` timeout. Không báo build PASS giả.
- Windows Setup/Portable: chưa chạy trong môi trường Windows ở lượt này; cần GitHub Actions/Windows runner xác nhận.

## Ghi chú UI
Không có browser runtime trong sandbox để chụp visual regression thực tế. CSS/layout đã được kiểm bằng static test và selector wiring; cần chạy preview/GitHub build để xác nhận pixel-level trên máy người dùng.
