# HNL Pile Standards AI v1.25.7 — DCE UDF Behavioral Golden

Ngày audit: 2026-08-25

## 1. Mục tiêu và nguyên tắc

Vòng này dùng **signature từ `DCE Excel.dll` + cached runtime result trong `10.1 DCE_SctCoc_10304 2025.xlsm`** để đặc trưng hành vi của các UDF DCE. DCE **không** trở thành nguồn pháp lý hoặc Production dependency.

Thứ tự quyết định vẫn là:

`TCVN PDF → HNL deterministic implementation → Golden → DCE/XLSM reference`.

Nếu DCE khác HNL, khác biệt được ghi lại và giữ `REVIEW` cho đến khi PDF quyết định. Không sửa HNL chỉ để khớp DCE.

Nguồn tham chiếu binary/XLSM ngoài ZIP source HNL:

- XLSM SHA-256: `ec38b68f753b08e50d9d1f9df988be5084cab1aedf391ba1aaecf112e9d88bd1`
- `V.2020.zip` SHA-256: `6b523b82bb362e972d90a9bdb696f129048e55560e44097b11cd54d0d8526415`
- `DCE Excel.dll` SHA-256: `9011a640477decf36dc687e94eb8586081ece1ef540bb62eca3890a6b6efd785`
- `DCE Excel-AddIn64.dna` SHA-256: `cf5070437fa5b9cf68917886659a151ff35b6209f84a589a5351962ad0362587`

Binary/XLSM không được đóng vào release HNL; chỉ fixture evidence, hash, formula/cached-value trace được lưu.

## 2. Phạm vi UDF thật trong workbook

Fixture được sinh trực tiếp từ OOXML của XLSM, không chạy XLL:

| UDF | Số lời gọi formula | Behavioral coverage vòng này | Trạng thái sau audit |
|---|---:|---|---|
| `NoiSuySPT` | 140 | 51 cao độ cached | REFERENCE – characterized |
| `GetKsFromRQD` | 1 | 1 direct runtime point | REFERENCE – PDF replacement |
| `qb_SPT2025` | 169 | 51 diagnostic qb | REFERENCE – Appendix D mapping PASS |
| `flu_SPT2025` | 548 | 51 unit-f + 51 cumulative | REFERENCE – Appendix D mapping PASS |
| `GetQbBang8` | 0 | 5 indirect `Qb_CocMaSatCMD(...,"qb")` | REFERENCE – indirect Bảng 8 match |
| `TinhGammaqbCMS` | 218 | 102 numeric row observations → 5 unique tuples | REVIEW |
| `TinhGammafiCMS` | 218 | 102 numeric row observations → 5 unique tuples | REVIEW |
| `qbEQ_SPT2025` | 239 | chỉ inventory ở vòng này | REVIEW |
| `fluEQ_SPT2025` | 338 | chỉ inventory ở vòng này | REVIEW |

Lưu ý: số lời gọi `flu_SPT2025=548` và `fluEQ_SPT2025=338` là số đếm trực tiếp formula trong workbook hiện tại.

## 3. `NoiSuySPT` — hành vi cached đã xác định

51/51 diagnostic depth trong sheet `SPT 10304-2025` được tái lập chính xác bằng:

`LINEAR-1D giữa hai điểm SPT đo kề nhau theo cao độ`.

Ví dụ:

- z=1.0 m: N=2.6666666667 từ (0,0) và (1.5,4)
- z=2.0 m: N=3.75 từ (1.5,4) và (3.5,3)
- z=3.0 m: N=3.25
- z=39.0 m: N=34.4
- z=40.0 m: N=47.4
- z=41.0 m: N=50

Đây là **behavioral reference**, không phải phép nội suy được tự động cấp quyền Production. HNL hiện cố ý dùng điểm đo thực tế/cửa sổ được số hóa từ Phụ lục D, không gọi `NoiSuySPT`.

## 4. `qb_SPT2025` — 51/51 mapping PASS

Với workbook benchmark `Cọc khoan nhồi`, hành vi cached khớp primitive Appendix D của HNL ở toàn bộ 51 diagnostic rows:

- đất rời: `qb = min(120·N, 7500)` kPa;
- đất dính trong profile này: `cu = 6.25·N`, sau đó `qb = min(6·cu, 7500) = min(37.5·N,7500)` kPa.

Ví dụ mũi z=43.2 m, N=50:

- DCE `qb = 6000 kPa`;
- HNL Bảng D.1 `qb = 6000 kPa`;
- A = π/4 m² → `Qb = 4712.38898038469 kN` ở cả hai.

Kết luận: **không có sai lệch hệ số qb trong benchmark này**.

## 5. `flu_SPT2025` — hệ số đúng, cách tích phân khác HNL

### 5.1 Unit shaft resistance

51/51 diagnostic rows khớp primitive Appendix D HNL:

- đất rời: `f = min(3.3·N,165)` kPa;
- đất dính: `f = min(6.25·N,100)` kPa trong benchmark cọc khoan nhồi.

### 5.2 Cumulative behavior của DCE

51/51 cumulative rows được tái lập bởi:

`ΔQs_i = u · Li · f(z_end,i)`

và cộng dồn theo **right-end rectangular integration** trên lưới cao độ do DCE sinh ra. `N(z_end)` đến từ `NoiSuySPT` liên tục.

Ví dụ đoạn 0→1 m:

- N(1)=2.6666666667;
- f=16.6666666667 kPa;
- u=π m;
- ΔQs=π·1·16.6666666667=`52.3598775598 kN`, khớp cached DCE.

## 6. Sai lệch SPT DCE ↔ HNL được cô lập chính xác

Benchmark cùng workbook:

| Intermediate | DCE | HNL | Δ HNL-DCE |
|---|---:|---:|---:|
| Qb | 4712.388980 kN | 4712.388980 kN | 0 |
| Qs/Ru,f | 6975.297018 kN | 6574.222451 kN | -401.074568 kN |
| Rk/Ru | 11687.685999 kN | 11286.611431 kN | -401.074568 kN |

Sau SPT PDF Decision + boundary `[top,bottom)`, DCE cao hơn HNL khoảng **6.1007% ở shaft** và **3.5535% ở Rk** nếu lấy HNL làm mẫu số.

Root cause đã cô lập:

- **không phải** hệ số Bảng D.1 (`qb` và `f` unit đều match);
- DCE: nội suy N liên tục + tích phân right-end theo các phân đoạn sinh tự động;
- HNL hiện tại: không tạo N ảo liên tục; dùng measured-window/layer measured averaging theo policy P0 đã khóa.

Trạng thái: `DIFFERENT_BY_NORMATIVE_POLICY_DECISION`.

**SPT PDF Decision đã LOCKED:** HNL không clone `NoiSuySPT` hoặc right-end integration. Ns/Nc lấy theo lớp có provenance / trung bình điểm đo thực trong lớp với boundary `[top,bottom)`. DCE tiếp tục là REFERENCE-ONLY.

## 7. `GetKsFromRQD`

Workbook chỉ có một direct runtime observation:

`RQD=30 → Ks=0.24`.

HNL Bảng 1 cũng trả `0.24` bằng LINEAR-1D trong bracket RQD 25–50. Direct benchmark: **1/1 PASS**.

Không tuyên bố DCE runtime coverage cho các RQD khác vì workbook không có direct cached call khác. Golden toàn Bảng 1 của HNL vẫn do PDF quyết định.

## 8. `GetQbBang8`

Workbook không gọi trực tiếp `GetQbBang8`. Tuy nhiên các diagnostic `Qb_CocMaSatCMD(...,"qb")` cung cấp indirect runtime evidence cho Bảng 8.

5/5 điểm chọn lọc khớp HNL Bảng 8, gồm các điểm z=4/5/6 m với IL=0.3 và các điểm sâu hơn. Ví dụ:

- z=4, IL=0.3 → 575 kPa;
- z=5, IL=0.3 → 650 kPa;
- z=6, IL=0.3 → 700 kPa.

Các cell có chiều sâu ngàm lớp chịu lực <2 m trả warning text trong DCE, không được dùng để suy ra qb.

Trạng thái `GetQbBang8`: `REFERENCE`; Production vẫn dùng implementation Bảng 8 trực tiếp từ PDF.

## 9. `TinhGammaqbCMS` / `TinhGammafiCMS` — EQ

Từ 218 formula calls cho mỗi UDF, có 102 paired numeric row observations và 5 unique input/output tuples trong workbook hiện tại. Tất cả thuộc benchmark cố định:

- `agR/g = 0.0848`;
- loại cọc `Cọc nhồi chiếm chỗ`;
- loại nền `D`;
- phổ `Loại 1`.

Observed tuples chính:

| Soil detail | IL | γqb | γfi |
|---|---:|---:|---:|
| Cát Chặt ít ẩm và ẩm | – | 0.98552 | 0.93552 |
| Đất sét | 0.3 | 0.94276 | 0.84276 |
| Đất sét | 0.2 | 0.94276 | 0.84276 |
| Đất sét | 0.1 | 0.94276 | 0.84276 |
| Cát Chặt vừa ít ẩm và ẩm | – | 0.93552 | 0.93552 |

Các con số này **chưa đủ để suy ra công thức tổng quát**, vì chỉ có một agR, một loại nền, một loại phổ và một loại cọc. Vì vậy:

- `xll-TinhGammaqbCMS`: REVIEW / numeric disabled;
- `xll-TinhGammafiCMS`: REVIEW / numeric disabled;
- `10304-seismic-eq`: REVIEW / numeric disabled.

Không fitting công thức từ 5 tuple và không nâng EQ thành Production.

## 10. Golden/Test kết quả cuối

### DCE Behavioral Golden

- required checks: **213/213 acceptable, 0 FAIL**;
- `NoiSuySPT`: 51/51;
- `qb_SPT2025`: 51/51;
- `flu_SPT2025` unit f: 51/51;
- `flu_SPT2025` cumulative: 51/51;
- `GetKsFromRQD`: 1/1;
- Bảng 8 indirect: 5/5;
- EQ safety gate: PASS, Production vẫn bị khóa.

### Regression / existing Golden

- `npm test`: **351/351 PASS**;
- Full Table Golden: **1242/1242 PASS**;
- P0 Workflow Golden: **3/3 workflows, 35/35 metrics, 5/5 XLSM benchmark, 5/5 boundary PASS**;
- P1 Material Golden sau đồng bộ gate `e0/ea`: **7/7 capacity, 42/42 metrics, 2/2 governing, 5/5 boundary PASS**;
- Version Gate: PASS v1.25.7;
- Search Brain: PASS, normalized SHA-256 `f9b65e5e6fb61dcca233a4fe43950e3174c73536f2fa83452da3041fbd0021d2`.

### Runtime/build gate tại sandbox

- `npm ci`: BLOCKED — source ZIP không có `package-lock.json`;
- `excel:smoke`: BLOCKED — `exceljs` chưa cài;
- `build:web`: BLOCKED — `vite` chưa cài;
- Windows/Excel COM: không chạy trong Linux sandbox.

`.github/workflows/rc-final.yml` đã được bổ sung `npm run golden:dce-udf` trên cả Linux và Windows gate, vì vậy CI sẽ bắt regression hành vi DCE-reference sau khi dependencies được cài từ lock của repo.

## 11. Code/artifact thay đổi

- `scripts/audit/extract-dce-udf-behavioral.py` — đọc OOXML formula + cached values, không chạy XLL.
- `artifacts/dce-udf-behavioral/dce-udf-observed-v1.25.7.json` — evidence fixture tái sinh được.
- `scripts/dce-udf-behavioral-golden.mjs` — Golden comparator.
- `artifacts/dce-udf-behavioral/dce-udf-behavioral-golden-v1.25.7.json` — full check trace.
- `tests/v1.25.7-dce-udf-behavioral.test.mjs` — 8 focused behavioral/safety tests.
- `src/production-status-registry.js` — cập nhật evidence level; không mở numeric EQ/XLL.
- `package.json` — thêm `golden:dce-udf`.
- `.github/workflows/rc-final.yml` — nối Behavioral Golden vào CI.
- `scripts/p1-pass1-material-golden.mjs` — benchmark được đồng bộ với hardening e0 đã kể ea + reinforcement on opposing sides; **không nới Production engine**.

## 12. Quyết định sau vòng này

1. `GetKsFromRQD`: behavior tham chiếu phù hợp, nhưng HNL tiếp tục dùng PDF Bảng 1.
2. `qb_SPT2025`: coefficient behavior benchmark phù hợp Appendix D.
3. `flu_SPT2025`: unit coefficient phù hợp; **integration policy khác HNL** và SPT PDF Decision đã khóa HNL theo nguồn TCVN, không theo DCE.
4. `NoiSuySPT`: DCE behavior đã biết; **không clone** vì Phụ lục D/Bảng D.1 không quy định continuous-depth interpolation cho Production.
5. `GetQbBang8`: indirect runtime match hỗ trợ benchmark, không thay authority PDF.
6. `TinhGammaqbCMS/TinhGammafiCMS`: đã biết contract + 5 tuple runtime, nhưng **REVIEW** vì chưa đủ miền input/provenance để tái dựng công thức.
7. Chưa nâng thêm SPT/EQ module chỉ vì DCE/XLL đã được behavioral-characterized.
