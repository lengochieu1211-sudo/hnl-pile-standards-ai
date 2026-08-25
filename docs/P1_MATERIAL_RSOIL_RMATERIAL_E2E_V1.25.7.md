# HNL Pile Standards AI v1.25.7 — P1 Material → Rsoil/Rmaterial End-to-End Lock

## 1. Mục tiêu

Khóa chuỗi thiết kế sức chịu tải một cọc vuông theo hai giới hạn độc lập:

- `Rsoil = Rd` từ workflow TCVN 10304:2025 đã LOCKED, nghĩa là sức kháng đất nền sau `γk`;
- `Rmaterial = Nu` từ TCVN 5574:2018, nhánh nén gần đúng tâm tiết diện chữ nhật/vuông, CT (49)–(50), Bảng 16;
- `Rpile = min(Rsoil, Rmaterial)`;
- nếu có `γn`, chỉ sau khi đã tìm `Rpile` mới tính `Nd,max(final)=Rpile/γn`.

AI không thực hiện phép tính. AI chỉ parse input, chọn workflow và diễn giải kết quả của deterministic engine.

## 2. Nguồn chuẩn và phạm vi

### TCVN 5574:2018

Production branch sử dụng:

- Bảng 7: `Rb`;
- Bảng 13: `Rsc`;
- 8.1.2.4.3, CT (49)–(50): nén gần đúng tâm;
- Bảng 16: hệ số `φ` dài hạn, nội suy tuyến tính trong miền đã khóa;
- điều kiện áp dụng đã machine-gate: tiết diện chữ nhật/vuông; cốt dọc ở các phía đối diện trong mặt phẳng uốn; `e0` đã kể lệch tâm ngẫu nhiên; `e0 ≤ h/30`; `L0/h ≤ 20`; ngoài miền tra bảng không ngoại suy.

Benchmark vật liệu bắt buộc: B30 `Rb=17 MPa`; CB400-V `Rsc=350 MPa`.

### TCVN 10304:2025

Integrated engine chỉ nhận `Rsoil` từ một child workflow có Production Registry LOCKED và kết quả deterministic `status=VERIFIED`:

- cọc đóng/ép §7.2.2;
- cọc chống trên đá §7.2.1;
- cọc có moi đất §7.2.3;
- SPT Phụ lục D theo SPT PDF Decision đã khóa.

Không nhận Rk, số nhập tay, MIXED/MANUAL hoặc rock preliminary làm Rsoil Production.

## 3. XLSM reference

`10.1 DCE_SctCoc_10304 2025.xlsm / SCT VatLieu` tiếp tục mang trạng thái `REFERENCE/BUGGED`:

- `F23` ghi nhãn `Rsc` nhưng VLOOKUP lấy cột `Rs`;
- bảng nội bộ workbook có CB400-V `Rsc=365 MPa`, mâu thuẫn với Bảng 13 TCVN 5574:2018 (`350 MPa`);
- công thức φ của workbook không được dùng thay CT (49)–(50)/Bảng 16.

Không có số XLSM nào cấp trực tiếp cho `PileMaterialEngine` Production.

## 4. Calculation Engine mới

### `src/pile-capacity-engine.js`

`combineLockedPileResistance()` thực hiện strict composition:

1. xác định Registry ID của workflow đất;
2. kiểm child soil là LOCKED/VERIFIED numeric;
3. kiểm `RdKn > 0` và `γk > 0`;
4. kiểm material result là `VERIFIED`, `productionNumeric=true`, `capacityBasis=DESIGN_RESISTANCE_TTGH1`;
5. kiểm cùng hình học cọc vuông giữa hai nhánh;
6. tính `Rpile=min(Rsoil,Rmaterial)`;
7. xác định `SOIL` hoặc `MATERIAL` governing;
8. nếu có `γn`, tính `Nd,max(final)=Rpile/γn` sau phép min.

### Phạm vi cọc tròn/vành khuyên

Không tạo `Rmaterial` vô hướng giả. Phụ lục F của TCVN 5574:2018 là kiểm N–M demand/capacity. Do đó integrated scalar min hiện LOCKED cho cọc vuông; circular/annular bị safety-block và phải dùng workflow N–M riêng.

## 5. AI Router

Workflow mới: `pile-capacity-integrated`.

Khi người dùng yêu cầu “kiểm cả đất và vật liệu”, router:

`question → soil child workflow → PileMaterialEngine → strict composition → governing → Excel payload`.

`deterministicEngineeringContext()` đưa cho AI đúng các số `Rsoil`, `Rmaterial`, `Rpile`, governing và `Nd,max(final)`; AI không tính lại.

## 6. Excel Formula-Only

`exportIntegratedPileCapacityWorkbook()` không đổ kết quả Engine thành số chết.

Nó tái sử dụng chính formula-only soil workbook đã LOCKED, sau đó thêm:

- `MATERIAL_INPUT`
- `MATERIAL_LOOKUP`
- `MATERIAL_CALC`
- `PILE_GOVERNING`
- `E2E_SOURCE`

`PILE_GOVERNING` liên kết bằng công thức tới `Rd` của child soil workbook và `Nu` của `MATERIAL_CALC`, sau đó dùng `MIN`. Có formula-level geometry gate và `γn` riêng sau min.

Excel runtime smoke và Microsoft Excel COM đã được thêm vào GitHub RC workflow; local sandbox hiện không có `exceljs`/Microsoft Excel nên runtime gate này không được báo PASS giả.

## 7. Golden End-to-End

`golden:material-e2e` chạy 4 child soil workflow:

- Driven — đất khống chế;
- Rock — vật liệu khống chế;
- Bored — đất khống chế;
- SPT — đất khống chế.

So Engine ↔ independent Excel formula model tại 5 intermediate mỗi case:

`Rsoil`, `Rmaterial`, `Rpile`, `γn`, `Nd,max(final)`.

Boundary/safety gồm:

- thiếu `γk`;
- MIXED/MANUAL soil;
- rock preliminary;
- geometry mismatch;
- circular N–M không được ép thành scalar min;
- kiểm `γn` chỉ áp dụng sau min.

## 8. Kết quả gate tại sandbox

- Focused P1 E2E: `9/9 PASS`.
- Regression: `370/370 PASS`.
- Full Table Golden: `1242/1242 PASS`.
- P0 Workflow Golden: `3/3 workflow`, `35/35 intermediate PASS`.
- P1 Material Golden: `7/7 capacity`, `42/42 Engine↔Excel formula model PASS`.
- P1 Material E2E Golden: `4/4 workflow`, `20/20 intermediate`, `6/6 boundary`, `3/3 benchmark PASS`.
- DCE Behavioral Golden: `213/213 acceptable`, `0 FAIL`.
- SPT PDF Decision: `26/26 PASS`.
- Version Gate: PASS v1.25.7.
- Search Brain: PASS, normalized SHA-256 `f9b65e5e6fb61dcca233a4fe43950e3174c73536f2fa83452da3041fbd0021d2`.

### Local environment BLOCKED

- `npm ci`: BLOCKED vì source ZIP không chứa `package-lock.json`;
- `excel:smoke`: BLOCKED vì `exceljs` chưa cài;
- `build:web`: BLOCKED vì `vite` chưa cài;
- Windows NSIS/portable + Microsoft Excel COM: chưa thể chạy trong Linux sandbox.

GitHub RC workflow đã được nối để chạy `golden:material-e2e`, ExcelJS smoke và Excel COM check khi môi trường CI có dependency/Windows phù hợp.

## 9. Production status

- `pile-capacity-integrated-square`: `LOCKED`, `productionNumeric=true`;
- child soil workflows: giữ status LOCKED hiện hành;
- `5574-pile-material-near-centered-rect`: LOCKED;
- XLSM `SCT VatLieu`: REFERENCE/BUGGED;
- EQ: REVIEW, `productionNumeric=false`.

## 10. Definition of Done của pass

PASS về logic deterministic/Golden trong sandbox. Release-level ExcelJS/Web/Windows chỉ được coi PASS khi GitHub/Windows runner thực sự chạy xong các gate tương ứng.
