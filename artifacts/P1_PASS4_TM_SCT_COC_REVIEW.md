# HNL Pile Standards AI v1.25.7 — P1 Pass 4 `TM SCT Coc` / PileReactionEngine REVIEW Patch

## Trạng thái

Patch này **không phải bản LOCKED**. Nó được tạo vì source ZIP Pass 3 và workbook XLSM hiện chỉ khả dụng dưới dạng File Library reference, chưa được mount thành bytes trong runtime hiện tại để audit cell-by-cell hoặc tích hợp trực tiếp.

Không có tuyên bố giả rằng đã sửa source gốc hoặc đã benchmark `TM SCT Coc`.

## Bằng chứng đã xác nhận

Audit P0 trước đó đã xác nhận:

- `TM SCT Coc` có 6.082 formula cells;
- không có UDF/XLL trong sheet;
- input workflow: `Point Coordinates + Nodal Reactions + Point Spring Assignments + Rd`;
- intermediate: match point/pile/load + utilization;
- output: kiểm tra từng cọc;
- ETABS/SAP importer vẫn phải để sau khi reaction model rõ.

P1 Pass 3 đã khóa đầu vào cho Pass 4:

- `PilePoint[]`;
- `loadCombinations[]`;
- `Rpile`/`Nd,max` đã có provenance;
- layout chỉ `PROPOSAL_ONLY_NOT_REACTION_CHECKED`.

## Mô hình REVIEW được dựng

Reaction field:

`Ni = a + b*x_i + c*y_i`

Giải trực tiếp hệ cân bằng:

- `ΣNi = N`;
- `ΣNi*x_i = My`;
- `ΣNi*y_i = Mx`.

Dùng full 3×3 matrix nên không giả `Σxy = 0`. Vì vậy layout quay hoặc bất đối xứng vẫn được xử lý đúng theo mô hình đài cứng tuyến tính.

### Sign convention

- `N > 0` = nén;
- `My > 0` tăng nén phía `+x`;
- `Mx > 0` tăng nén phía `+y`;
- hỗ trợ `compression-negative` cho dữ liệu ETABS nhưng phải khai báo rõ.

### Vx/Vy/T

Patch **không** dùng Vx/Vy/T để tự tăng phản lực đứng. Chúng chỉ được carry-forward metadata và phát cảnh báo.

### Tension

Nếu `Ni < 0`:

- chuyển sang kiểm kéo;
- nếu không có `tensionCapacityKn` đã xác minh → FAIL/BLOCK;
- không lấy `Rpile` nén làm sức chịu kéo.

## Điều kiện chưa đạt để LOCK

1. Chưa có formula mapping `TM SCT Coc cell → variable → formula`.
2. Chưa có XLSM cached-value fixture riêng cho 6.082 formulas.
3. Chưa benchmark `TM SCT Coc ↔ Engine`.
4. Chưa có independent Formula-Only Excel reaction workbook.
5. Chưa xác minh chính xác sign mapping của workbook cho `Fz/Mx/My`.
6. Chưa xác minh workbook dùng Nodal Reactions trực tiếp hay chỉ để đối chiếu spring point.
7. Chưa xác minh capacity basis trong sheet là `Rd`, `Rpile`, hay giá trị khác.
8. Chưa tích hợp patch vào ZIP Pass 3 gốc vì source bytes chưa mount.
9. Search Brain không bị sửa trong patch này.

## Bước khóa tiếp theo khi source/XLSM bytes khả dụng

- trích toàn bộ sheet XML `TM SCT Coc`;
- lập inventory formula theo block/cột;
- xác định các key join giữa Point Coordinates / Spring / Nodal Reactions;
- benchmark tối thiểu: pure N, N+Mx, N+My, N+Mx+My, tension, capacity boundary, rotated/asymmetric layout, multiple combos;
- dựng Formula-Only Excel;
- chỉ khi Engine ↔ Excel ↔ XLSM PASS mới đổi status từ REVIEW sang LOCKED.
