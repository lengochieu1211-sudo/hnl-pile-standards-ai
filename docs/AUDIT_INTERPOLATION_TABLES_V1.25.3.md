# HNL v1.25.3 — Interpolation & Table Audit

Ngày audit: 2026-08-24

## Kết luận
Đã rà lại các bảng tra chủ yếu của TCVN 10304:2025 bằng PDF tiêu chuẩn trong bộ dự án và dùng các DOCX từ điển người dùng cung cấp làm checklist. Quy tắc cốt lõi: **chỉ nội suy khi bảng/chú thích/công thức cho phép; không ngoại suy ngầm**.

| Bảng | Nội dung | Chính sách | Ngoài biên | HNL ↔ Excel |
|---|---|---|---|---|
| 2 | q_b cọc đóng/ép | LINEAR-1D; BILINEAR-2D z+IL | z<3 BLOCK; z>40 dùng hàng 40; IL ngoài 0–0,6 BLOCK | Đồng bộ |
| 3 | f_i thân cọc | LINEAR-1D; BILINEAR-2D z+IL | z ngoài 1–40 BLOCK; IL≤0,2 dùng cột ≤0,2; IL>1 BLOCK | Đồng bộ + chia đoạn ≤2m |
| 4 | γR,R / γR,f | DISCRETE | Không nội suy | Đồng bộ |
| 6 | γR,f cọc khoan | DISCRETE | Không nội suy | Đồng bộ policy |
| 7 | α1…α4 | α1/α2 1D; α3/α4 bilinear | φ ngoài 23–39 BLOCK; h/d<4 BLOCK; h/d≥25 plateau; d≤0,8 plateau; d>4 BLOCK | Đồng bộ |
| 8 | q_b cọc khoan trong sét | BILINEAR-2D z+IL | z<3 BLOCK; z≥40 plateau; ô “–” BLOCK | Đồng bộ |
| 12 | M thử động | DISCRETE | Không nội suy; cát chặt hàng 2–4 ×1,6 theo chú thích | Đồng bộ |
| 15 | β1, β2, βi CPT | EXACT / EDGE-BAND | Không auto-interpolate mốc giữa; override có nguồn | Đồng bộ |
| 16 | q_b, f_i theo qc | LINEAR-1D | Không nội suy qua ô “–”; không ngoại suy | Đồng bộ |
| 17 | k_v, ζ0, m_v | CT(33), CT(34), m_v LINEAR-1D | ν ngoài 0–0,5 BLOCK | Đồng bộ |

## Điểm sửa quan trọng
- Tách interpolation thành engine strict dùng chung, trả cả mode và bracket/provenance.
- Cọc đóng/ép tự tách địa tầng thành các đoạn ≤2 m trước khi tra f_i; ranh giới lớp được giữ nguyên.
- Bảng 15 không còn giả định “có bảng là được nội suy”. Nếu qs/fs nằm giữa mốc, engine yêu cầu hệ số nhập tay có nguồn hoặc dữ liệu phương pháp khác.
- Bảng 17 không clamp ν ngoài phạm vi; ζ0 tại ν=0,5 dùng giới hạn 0,25; m_v nội suy giữa đúng hai mốc kề nhau.
- Excel dùng công thức tương ứng, không FORECAST.LINEAR toàn bảng, không kéo giá trị ngoài biên.

## TCVN 5574:2018 liên quan nội suy
- εb2 đối với B70→B100 đã dùng nội suy tuyến tính trong HNL và Excel.
- Bảng 15/16 hệ số φ theo L0/h có chú thích nội suy tuyến tính, nhưng nhánh nén gần đúng tâm đang ở trạng thái INDEXED/REVIEW nên chưa tự mở numeric chỉ vì đã biết phép nội suy.
- Phụ lục M nhánh nhà một tầng có các mốc chiều cao và quy định nội suy tuyến tính; giữ theo phạm vi VERIFIED hiện hành.

## Gate
- Không đổi `src/search.js`.
- Mọi bảng rời rạc phải dùng exact category.
- Chỉ explicit boundary plateau mới được phép giữ giá trị biên.
- Ô gạch ngang/null cắt đứt đoạn nội suy.
- Override thủ công phải hiện `MANUAL / Nhập tay` và không được giả là giá trị tra bảng.

## Regression sau sửa
- `npm test`: **271/271 PASS, 0 FAIL**.
- `src/search.js`: normalized SHA-256 `f9b65e5e6fb61dcca233a4fe43950e3174c73536f2fa83452da3041fbd0021d2` — không đổi.
- Workbook audit: `artifacts/HNL-Interpolation-Table-Audit-v1.25.3.xlsx`.

## Benchmark nội suy đã khóa
- Bảng 2: z=12 m, IL=0,35 → q_b=3150 kPa (bilinear).
- Bảng 3: z_tb=2,5 m, IL=0,7 → f_i=7,5 kPa.
- Bảng 7: φ=30°, h/d=12, d=1,2 m → α1=29,5; α2=54,75; α3=0,691; α4=0,25875.
- Bảng 8: z=16 m, IL=0,35 → q_b=1266,6667 kPa.
- Bảng 12: cát mịn chặt → M=1,76 theo quy tắc +60%.
- Bảng 15: q_s=5000 → β1=0,65; q_s=6000 bị BLOCK nếu không có override có nguồn.
- Bảng 16: q_c=6000, nhánh q_b cát → 980 kPa.
- Bảng 17: ν=0,325 → m_v=1,646; ν=0,5 → ζ0=0,25.
