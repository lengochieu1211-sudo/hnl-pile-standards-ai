# P1 Pass 7 – Full Calculation Report / Excel Production Integration – Core Locked v18

## Phạm vi đã khóa

Chuỗi một nút:

`Địa chất + vật liệu → Multi-Borehole LOCKED → Rsoil → Rmaterial → Rpile → γn → Nd,max → Pass 5 canonical structural import → Pass 4 imported nodal-reaction check → cọc bất lợi → kết luận → Excel sản xuất tiếng Việt`.

Pass 7 chỉ orchestration và report integration. Không viết lại công thức TCVN đã khóa ở các engine con.

## Golden v18

- Rsoil = 843.4285714285716 kN.
- Rmaterial = 2952 kN.
- Rpile = 843.4285714285716 kN.
- γn = 1.15.
- Nd,max = 733.4161490683232 kN/cọc.
- 3 lỗ khoan × 2 phương pháp = 6 nhánh.
- Địa chất bất lợi: HK2 · Cơ lý · 7.2.2 cọc đóng/ép.
- 19 phản lực cọc EULS: 19/19 ĐẠT.
- Cọc bất lợi: Point/Pile 168.
- Nhu cầu bất lợi = 365.2920507005818 kN.
- Hệ số sử dụng = 0.4980692764464232.
- Kết luận = ĐẠT.

## Gate

- Test hiện tại: 156/156 PASS.
- Excel ↔ Engine: Rsoil/Rmaterial/Rpile/γn/Nd,max/governing/kết luận đều PASS.
- Formula error scan: 0 lỗi `#REF!/#DIV0!/#VALUE!/#NAME?/#N/A`.
- Prior regression: 388/388.
- Full Table Golden: 1242/1242.
- Pass 3: 39/39 rows + 273/273 checks.
- Search Brain evidence giữ nguyên SHA-256 khóa; patch Pass 7 không chứa/sửa `src/search.js`.

## Excel sản xuất tiếng Việt

Workbook gồm 13 sheet:

- `00_HƯỚNG_DẪN`
- `01_TỔNG_HỢP`
- `02_ĐẦU_VÀO`
- `03_ĐỊA_CHẤT_SPT`
- `04_TÍNH_ĐẤT`
- `05_VẬT_LIỆU`
- `06_SỨC_CHỊU_TẢI`
- `07_DỮ_LIỆU_KẾT_CẤU`
- `08_KIỂM_TRA_CỌC`
- `09_CỌC_BẤT_LỢI`
- `10_NGUỒN_ĐỐI_CHIẾU`
- `11_BẢNG_TRA`
- `12_KIỂM_TRA_GOLDEN`

Excel có công thức thật cho CT (50), lookup vật liệu, nội suy Bảng 16, Qb/Qs/Rk/Rd/Rpile/Nd,max từ các intermediate lookup đã được HNL engine khóa, kiểm từng cọc và governing.

### Ranh giới quan trọng

Nếu người dùng thay **địa chất thô** (lớp đất/N-SPT), phải bấm **TÍNH** trong HNL để engine tra lại qb/fi/τ đúng Bảng 2/3/D.1 rồi xuất workbook mới. Excel không được tự bịa hoặc ngoại suy các bảng TCVN phức tạp. Sau khi HNL xuất các intermediate đã khóa, các công thức Excel phía sau tự tính lại đầy đủ.

Live ETABS/SAP và full-source merge vẫn là gate riêng, không được suy diễn từ Core Locked Patch này.
