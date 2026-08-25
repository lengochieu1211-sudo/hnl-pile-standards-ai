# P0 Workbook Reverse Engineering + HNL Gap Matrix — v1.25.7

## 0. Quy tắc quyết định

**TCVN PDF → deterministic HNL logic → benchmark → XLSM reference.** Workbook `10.1 DCE_SctCoc_10304 2025.xlsm` là nguồn workflow/benchmark, không phải nguồn pháp lý. Cached result hoặc `_xll.*` không đủ để nâng trạng thái lên VERIFIED.

SHA-256 workbook: `ec38b68f753b08e50d9d1f9df988be5084cab1aedf391ba1aaecf112e9d88bd1`.

## A. Workbook Audit Report

- 21 sheet: 10 visible, 11 hidden; không phát hiện `veryHidden` trong workbook XML.
- 14.947 formula cells.
- 59.149 dependency edges trực tiếp được trích từ tham chiếu A1 trong formula.
- 80 Defined Names; **53 chứa `#REF!`**.
- 17 tên UDF/XLL; tổng **6,871** lần gọi theo formula scan.
- Có `xl/vbaProject.bin`; đã giải nén stream VBA để đọc source thực.
- `ThisWorkbook.Workbook_Open` ép `Application.Calculation=xlCalculationAutomatic` và gọi `EnsureDceAddinLoaded`.
- `EnsureDceAddinLoaded` hard-code DCE XLL ở `C:\Dce Pro\V.2020\DCE Excel-AddIn64.xll` / `DCE Excel-AddIn.xll`.
- Không phát hiện OOXML `externalLinks` part; tuy nhiên proprietary XLL được load bằng VBA nên vẫn là dependency ngoài quan trọng.

| Sheet | Visible/Hidden | Nhóm | Formula | XLL/UDF | Chuẩn/liên quan | Trạng thái |
|---|---|---:|---:|---:|---|---|
| LYTHUYET | hidden | Lý thuyết | 0 | 0 | TCVN 10304:2014 | LEGACY |
| BANGTRA | hidden | Bảng tra | 0 | 0 | TCVN 5574:2018 + TCVN 10304:2014 | MIXED/LEGACY |
| PIERFORCES | hidden | Phản lực kết cấu | 0 | 0 | ETABS/SAP | REVIEW |
| PIERSECTION | hidden | Tiết diện pier | 156 | 0 | ETABS/SAP | REVIEW |
| HK1 | hidden | Địa chất/lỗ khoan | 1118 | 0 | Dữ liệu địa chất + legacy 2014 | MIXED |
| OGAreas01 | hidden | Phụ/ẩn | 0 | 0 | Không xác định | REVIEW |
| Chon_SL_Coc | visible | Chọn số lượng cọc | 468 | 0 | Workflow thiết kế | REVIEW |
| Point Coordinates | hidden | Tọa độ kết cấu | 0 | 0 | ETABS/SAP | REVIEW |
| Nodal Reactions | hidden | Phản lực nút | 0 | 0 | ETABS/SAP | REVIEW |
| Point Spring Assignments | hidden | Spring assignment | 0 | 0 | ETABS/SAP | REVIEW |
| TM SCT Coc | visible | Kiểm từng cọc | 6082 | 0 | Workflow kết cấu→cọc | REVIEW |
| SPT 9386-2012 | hidden | SPT legacy | 0 | 0 | TCVN 9386:2012 | LEGACY |
| LT 10304-2025 | hidden | Lookup phương pháp thi công | 0 | 0 | TCVN 10304:2025 | REVIEW-MAPPING |
| SPT 10304-2025 | visible | SPT | 988 | 787 | TCVN 10304:2025 Phụ lục D | BLACK_BOX/REVIEW |
| SPT 10304-2025 EQ | visible | SPT động đất | 1101 | 927 | TCVN 10304:2025 + EQ | BLACK_BOX/REVIEW |
| 7.2.1-10304-Cọc Chống | visible | Cọc chống/đá | 22 | 3 | TCVN 10304:2025 §7.2.1 | PARTIAL |
| 7.2.2-10304-Không moi đất | visible | Cọc không moi đất | 928 | 703 | TCVN 10304:2025 §7.2.2 | PARTIAL |
| 7.2.2-10304-Không moi đất EQ | visible | Không moi đất EQ | 1673 | 1981 | TCVN 10304:2025 + EQ | BLACK_BOX/REVIEW |
| 7.2.3-10304-Có moi đất | visible | Cọc có moi đất | 858 | 633 | TCVN 10304:2025 §7.2.3 | PARTIAL |
| 7.2.3-10304-Có moi đất EQ | visible | Có moi đất EQ | 1535 | 1837 | TCVN 10304:2025 + EQ | BLACK_BOX/REVIEW |
| SCT VatLieu | visible | Sức chịu tải vật liệu | 18 | 0 | TCVN 5574:2018 / 10304:2025 | BUGGED/REVIEW |

### Input / Intermediate / Output theo sheet

| Sheet | Input | Intermediate | Output | Công thức/UDF chính |
|---|---|---|---|---|
| LYTHUYET | Không có input tính | Văn bản/công thức minh họa TCVN 10304:2014 | Không output Production | Không formula Excel |
| BANGTRA | Không input trực tiếp | Bảng vật liệu 5574 + bảng legacy 10304:2014 | Lookup ranges/named ranges | Dữ liệu tĩnh |
| PIERFORCES | ETABS/SAP pier forces | Story/Pier/CaseCombo/Location | P,V2,V3,T,M2,M3 | Raw data |
| PIERSECTION | ETABS/SAP pier sections | Ghép key + hình học/properties | Section properties | 156 formulas |
| HK1 | Địa tầng, chỉ tiêu cơ lý, cao độ/độ sâu | Chuẩn hóa lớp + nhiều tính toán legacy | Borehole profile và kết quả legacy | >1000 formulas; vùng AA:AX là dữ liệu địa chất quan trọng |
| OGAreas01 | Không đáng kể | Không đáng kể | Không đáng kể | 0 formulas |
| Chon_SL_Coc | N/M/V + SCT một cọc + hệ số nhóm | SoLuongCoc/HSAT/XacDinhSCT | Số cọc/FS/capacity nhóm | Excel + VBA UDF |
| Point Coordinates | ETABS/SAP points | Global coordinates | Point→XYZ | Raw data |
| Nodal Reactions | ETABS/SAP nodal reactions | Load case/combo + node | Fx,Fy,Fz,Mx,My,Mz | Raw data |
| Point Spring Assignments | Point/Spring | Mapping point→spring | Pile/spring association | Raw data |
| TM SCT Coc | Coordinates + reactions + spring + Rd | Match pile/point/load + utilization | Per-pile check | 6082 formulas |
| SPT 9386-2012 | Legacy | Legacy/empty | Legacy | 0 formulas |
| LT 10304-2025 | Không input | Enum phương pháp thi công | Code 1..7 và 1,2,3a..8 | Lookup static |
| SPT 10304-2025 | Pile geometry + borehole + SPT N profile | NoiSuySPT/qb_SPT2025/flu_SPT2025 | Qb/Qs/Rk/Rd | 988 formulas; 787 XLL calls |
| SPT 10304-2025 EQ | SPT + EQ params | SPT + gamma/qb/fi EQ XLL | QbEQ/QsEQ/Rk/Rd | 1101 formulas; 927 XLL calls |
| 7.2.1-10304-Cọc Chống | D10:D16 geometry; rock/RQD/Rc,n; gamma | Ld/Ks/Rm/qb/Ab | Rk/Rd/net capacity | D18/F32/F40/F41 visible; Ld/Ks XLL |
| 7.2.2-10304-Không moi đất | Geometry + head/tip + geology + method code | Qb XLL + cumulative shaft at head/tip | Qb/Qs/Rk/Rd | D24-D34 + diagnostic rows |
| 7.2.2-10304-Không moi đất EQ | 7.2.2 + EQ parameters | gamma EQ + modified qb/fi | RkEQ/RdEQ | Heavy XLL |
| 7.2.3-10304-Có moi đất | Geometry + geology + construction code | Qb/shaft XLL + factors | Qb/Qs/Rk/Rd | D25-D34 + diagnostic rows |
| 7.2.3-10304-Có moi đất EQ | 7.2.3 + EQ parameters | gamma EQ + modified qb/fi | RkEQ/RdEQ | Heavy XLL |
| SCT VatLieu | Pile geometry + concrete/steel + reinforcement | Ab/I/slenderness/material lookup | Material pile capacity Rm | 18 formulas; F23 has confirmed Rsc lookup bug |

### Phân nhóm workflow

1. **Geometry**: các sheet 7.2.1/7.2.2/7.2.3/SPT/SCT VatLieu dùng cùng pattern hình học. Đặc biệt workbook tách `Di_tip` và `Di_mass`; đây là yêu cầu đúng và đã được đưa vào HNL P0.
2. **Địa chất**: `HK1` là schema lỗ khoan thực tế nhưng đồng thời chứa vùng tính legacy 2014. HNL chỉ lấy mô hình dữ liệu địa tầng, không nhập logic 2014.
3. **§7.2.1**: visible formulas cho geometry/Rm/qb; `Ld` và `Ks` có XLL. Nhánh này chưa được promote toàn bộ.
4. **§7.2.2**: XLL trả Qb và shaft cumulative. D27 cho thấy workflow `Qb + Qs(tip) − Qs(head)`; HNL đã có Bảng 2/3/4 VERIFIED nên XLSM chỉ làm benchmark.
5. **§7.2.3**: XLL lớn; HNL hiện có Bảng 6/7/8 VERIFIED nhưng chưa có full layer-by-layer shaft workflow.
6. **SPT**: gần như toàn bộ qb/fi/N lookup phụ thuộc XLL. Giữ BLACK_BOX/REVIEW.
7. **EQ**: phụ thuộc XLL nặng nhất. Giữ P2/REVIEW.
8. **Material**: workbook có bug Rsc lookup được xác nhận bằng cell thật.
9. **Kết cấu/P1**: `PIERFORCES`, `Point Coordinates`, `Nodal Reactions`, `Point Spring Assignments`, `TM SCT Coc`, `Chon_SL_Coc` cung cấp schema tốt để thiết kế importer/quantity/reaction engine.

## A2. Chuẩn hóa biến P0

| Symbol | Code | Ý nghĩa | Đơn vị | Cell XLSM chính | Nguồn | Điều kiện | Range | Status |
|---|---|---|---|---|---|---|---|---|
| D | `outerDiameterM` | Đường kính ngoài cọc | m | 7.2.1!D12 / SCT VatLieu!F13-W7 | INPUT | cọc tròn | >0 | VERIFIED-GEOMETRY |
| a | `sideM` | Cạnh cọc vuông | m | D12/F13 tùy shape | INPUT | cọc vuông | >0 | VERIFIED-GEOMETRY |
| Di_tip | `tipInnerDiameterM` | Đường kính trong dùng tính diện tích mũi | m | 7.2.1!D13 / 7.2.2!D13 | INPUT | cọc rỗng tròn | 0≤Di_tip<D | VERIFIED-GEOMETRY |
| Di_mass | `massInnerDiameterM` | Đường kính trong dùng thể tích/tự trọng | m | 7.2.1!D14 / 7.2.2!D14 | INPUT | cọc rỗng tròn | 0≤Di_mass<D | VERIFIED-GEOMETRY |
| L | `lengthM` | Chiều dài cọc | m | 7.2.1!D18=ABS(D16-D15) | GEOMETRY |  | >0 | VERIFIED |
| Ab | `tipAreaM2` | Diện tích mũi | m² | 7.2.1!F32; 7.2.2!D20 | GEOMETRY | shape/Di_tip | >0 | VERIFIED |
| Ac | `concreteAreaM2` | Diện tích bê tông dùng thể tích/trọng lượng | m² | implicit in D26/D31/D32 self-weight | GEOMETRY | shape/Di_mass | >0 | VERIFIED |
| u | `perimeterM` | Chu vi thân ngoài | m | 7.2.1!D20; 7.2.2!D21 | GEOMETRY |  | >0 | VERIFIED |
| I | `secondMomentM4` | Moment quán tính tiết diện | m⁴ | SCT VatLieu!F20 | GEOMETRY |  | >0 | VERIFIED |
| Wself | `selfWeightKn` | Tự trọng cọc | kN | 7.2.1!D26; 7.2.2!D31 | GEOMETRY+CONVENTION | cần unit weight/factors rõ | ≥0 | REVIEW-CONVENTION |
| z_tip | `tipDepthM` | Độ sâu/cao độ quy ước mũi | m | 7.2.1!D16; 7.2.2!D16 | INPUT | hệ tọa độ phải nhất quán |  | VERIFIED-DATA |
| z_head | `shaftStartDepthM` | Độ sâu bắt đầu vùng thân tham gia ma sát | m | 7.2.2!D15; flu(head) subtraction | INPUT/PROFILE | 0≤z_head<z_tip |  | VERIFIED-WORKFLOW |
| RQD | `rqdPercent` | Rock Quality Designation | % | 7.2.1!F37 | INPUT | rock branch | 0..100 | REVIEW-FOR-KS-MAPPING |
| Ks/Kr | `rockReductionFactor` | Hệ số giảm cường độ đá | - | 7.2.1!F38=_xll.GetKsFromRQD | XLL / TCVN Table1 ranges | rock branch | Table 1 | BLACK_BOX/REVIEW |
| Rc,n | `rockCompressiveStrengthKpa` | Cường độ nén mẫu đá | kPa | 7.2.1!F35 | INPUT | rock branch | >0 | REVIEW-VARIABLE-MAPPING |
| γg | `gammaG` | Hệ số đất/đá trong workbook | - | 7.2.1!F34 | INPUT | rock branch | >0 | REVIEW |
| Rm | `rockDesignResistanceKpa` | Sức kháng đá trung gian | kPa | 7.2.1!F40 | VISIBLE FORMULA | rock branch | >0 | REVIEW/PDF-GATE |
| qb | `tipResistanceKpa` | Sức kháng đơn vị mũi | kPa | F41 / XLL Qb functions | TCVN lookup/formula | workflow-specific | table/formula domain | VERIFIED only in existing HNL table branches |
| fi | `shaftResistanceKpa` | Sức kháng đơn vị thân phân tố | kPa | diagnostic XLL rows | TCVN lookup/formula | layer/ztb/soil | table domain | VERIFIED for HNL Table3 branch |
| γRR | `gammaRR` | Hệ số điều kiện làm việc mũi | - | XLL mode GanmaRR | TCVN Bảng 4/other workflow table | construction method | discrete | VERIFIED in HNL Table4 branch |
| γRf | `gammaRf` | Hệ số điều kiện làm việc thân | - | XLL mode GanmaRf | TCVN Bảng 4/6 | method+soil | discrete | VERIFIED in existing HNL branches |
| Qb | `tipResistanceKn` | Sức kháng mũi tổng | kN | 7.2.2!D24 | CT/workflow |  | ≥0 | VERIFIED formula identity when inputs VERIFIED |
| Qsi | `segmentResistanceKn` | Sức kháng thân từng phân tố | kN | diagnostic fludon | CT9 workflow | segment | ≥0 | VERIFIED in HNL driven |
| ΣQs | `sideResistanceKn` | Tổng sức kháng thân vùng hoạt động | kN | D26-D25 cumulative difference | workflow identity | shaft interval | ≥0 | VERIFIED |
| Rk | `RkKn` | Sức chịu tải đặc trưng | kN | 7.2.2!D27 | TCVN CT9 for driven |  | ≥0 | VERIFIED in HNL driven |
| γk | `gammaK` | Hệ số tin cậy đất | - | 7.2.2!D32 | INPUT/standard branch |  | >0 | INPUT/WORKFLOW |
| Rd | `RdKn` | Sức chịu tải tính toán trước γn theo HNL current semantics | kN | D33 with self-weight+FLOOR differences | derived | rounding/self-weight convention must be explicit |  | VERIFIED core division; workbook presentation differs |
| γn | `gammaN` | Hệ số tầm quan trọng/hậu quả theo workflow | - | 7.2.2!D29 | INPUT |  | >0 | INPUT |
| Nd,max | `NdMaxKn` | Giới hạn sử dụng sau γn theo HNL workflow | kN | D34 analogous | derived |  |  | VERIFIED when branch inputs VERIFIED |
| N_SPT | `sptN` | Chỉ số SPT theo độ sâu | blows | SPT profile + _xll.NoiSuySPT | INPUT + XLL | Appendix D | source dependent | BLACK_BOX/REVIEW for interpolation implementation |

## B. Formula Mapping

| XLSM cell | Biến | Formula | Cached | HNL mapping | Status |
|---|---|---|---:|---|---|
| `7.2.1-10304-Cọc Chống!D18` | pileLength | `ABS(D16-D15)` | 28.2 | `calculatePileGeometry` | VERIFIED |
| `7.2.1-10304-Cọc Chống!F32` | tipArea | `IF(circle,PI()*(Do^2-Di_tip^2)/4,side^2)` | 0.7853981633974483 | `calculatePileGeometry.tipAreaM2` | VERIFIED |
| `7.2.1-10304-Cọc Chống!D26` | selfWeight | `A_mass*L*2.5*10*factor` | 609.0762757147212 | `calculatePileGeometry.selfWeightKn only when unitWeightKnM3 explicitly supplied` | REVIEW-CONVENTION |
| `7.2.1-10304-Cọc Chống!F33` | embedmentLength | `_xll.LNgamTrongDat(D16,H11:I24)` | 5 | `BoreholeEngine can derive interval geometry, not promoted as standard formula` | INFERRED |
| `7.2.1-10304-Cọc Chống!F38` | Ks | `_xll.GetKsFromRQD(F37)` | 0.24 | `NO PRODUCTION MAPPING` | BLACK_BOX/REVIEW |
| `7.2.1-10304-Cọc Chống!F40` | Rm | `Rc,n*Ks/gamma_g` | 5365.714285714286 | `calcEndBearing10304 accepts Rm` | REVIEW-MISMATCH |
| `7.2.1-10304-Cọc Chống!F41` | qb | `MIN(IF(Ld<0.5,Rm,Rm*(1+0.4*Ld/df)),20000)` | 16097.142857142859 | `calcEndBearing10304 currently CT8 branch only` | REVIEW/PDF-GATE |
| `7.2.2-10304-Không moi đất!D24` | Qb | `_xll.Qb_CocMaSatKMD(...)` | 13650.220079847652 | `lookupQb10304 + Table4 factor + tip area` | HNL-VERIFIED / XLSM-BENCHMARK |
| `7.2.2-10304-Không moi đất!D27` | Rk | `D24+D26-D25` | 21809.48912152738 | `calculateDrivenPile10304 with shaftStartDepthM` | VERIFIED-WORKFLOW-IDENTITY |
| `SCT VatLieu!F20` | secondMoment | `IF(circle,PI()*(Do^4-Di^4)/64,side^4/12)` | 0.04908738521234052 | `calculatePileGeometry.secondMomentM4` | VERIFIED |
| `SCT VatLieu!F23` | Rsc | `VLOOKUP(C23,BANGTRA!G12:H25,2,0)` | 350 | `TCVN5574_STEEL lookup Rsc` | WORKBOOK-BUG |
| `SPT 10304-2025!D21` | Qb_SPT | `_xll.qb_SPT2025(...)*D19` | 4712.38898038469 | `calcSpt10304 currently requires qb as input` | BLACK_BOX/REVIEW |

### Dependency graph kỹ thuật chính

**Geometry**  
`Do/side + Di_tip → Ab`  
`Do/side → u`  
`Do/side + Di_mass → Aconcrete → volume → self-weight`  
`head/tip coordinate → L`

**§7.2.2 không moi đất**  
`geology + tipDepth + method → Bảng 2/4 → qb, γRR → Qb`  
`geology + shaft interval + ztb + IL + method → Bảng 3/4 → fi, γRf → Qsi → ΣQs`  
`Qb + ΣQs → Rk → γk → Rd → γn → Nd,max`.

Workbook biểu diễn phần shaft dưới dạng cumulative XLL và trừ tại đầu cọc; HNL P0 biểu diễn trực tiếp interval `[shaftStartDepth, tipDepth]`, minh bạch hơn nhưng toán học tương đương khi cùng input.

**SPT**  
`SPT profile → NoiSuySPT → N(z) → qb_SPT2025 / flu_SPT2025 → Qb/Qs → Rk/Rd`.  
Hiện graph này mới INFERRED vì implementation XLL không nằm trong XLSM.

### Construction method enum phát hiện trong workbook

Nguồn trực tiếp `LT 10304-2025!AL:AO`. Đây là **mapping tham khảo**; trị số γ tiếp tục lấy từ bảng HNL/PDF VERIFIED.

**Không moi đất:** 1=búa cơ khí/hơi/diesel; 2=hố khoan dẫn; 3=xói nước rồi đóng vỗ; 4=rung/ép rung; 5=cọc rỗng mũi hở bằng búa; 6=cọc tròn rỗng mũi kín + mũi nổ mở rộng; 7=ép.

**Có moi đất:** 1=nhồi 6.4a/6.4b; 2=nhồi ép rung; 3a=khoan khô/CFA; 3b=dưới nước/bentonite; 3c=bê tông cứng+đầm sâu; 4=barrette; 5=cọc-ống rung có moi đất; 6=cọc-trụ; 7=khoan phun áp lực; 8=PDT.

## C. UDF/XLL Reverse Engineering Report

| UDF/XLL | Calls | Inferred output | Status | Kết luận |
|---|---:|---|---|---|
| `_xll.TimTinhChatDatCotTU` | 1744 | property at z / EQ variants | INFERRED | Keep REVIEW for selector semantics. |
| `_xll.flu_CocMaSatKMD` | 863 | f/segment/cumulative shaft | INFERRED/REVIEW | Workbook chứng minh pattern cumulative-at-head / cumulative-at-tip. |
| `_xll.flu_CocMaSatCMD` | 855 | shaft bored | BLACK_BOX/REVIEW | Thiếu layer-by-layer implementation minh bạch. |
| `_xll.flu_SPT2025` | 548 | shaft SPT | BLACK_BOX/REVIEW | Cần Phụ lục D PDF. |
| `_xll.TimTenLoaiDat` | 498 | soil name at z | INFERRED | Replaced by generic BoreholeEngine, no XLL dependency. |
| `_xll.TimTinhChatDat` | 498 | property at z | INFERRED | Replaced by generic BoreholeEngine/profile data access. |
| `_xll.Qb_CocMaSatKMD` | 361 | Qb hoặc γRR/qb diagnostic | INFERRED/REVIEW | Đối chiếu bằng HNL Bảng 2/4; không sao chép XLL. |
| `_xll.fluEQ_SPT2025` | 338 | fiEQ | BLACK_BOX/REVIEW | P2. |
| `_xll.qbEQ_SPT2025` | 239 | qbEQ | BLACK_BOX/REVIEW | P2. |
| `_xll.TinhGammaqbCMS` | 218 | γeq tip | BLACK_BOX/REVIEW | P2. |
| `_xll.TinhGammafiCMS` | 218 | γeq shaft | BLACK_BOX/REVIEW | P2. |
| `_xll.Qb_CocMaSatCMD` | 179 | Qb bored | INFERRED/REVIEW | HNL Bảng 7/8 VERIFIED; XLL chỉ benchmark. |
| `_xll.qb_SPT2025` | 169 | qb SPT | BLACK_BOX/REVIEW | Cần Phụ lục D PDF + probe benchmark. |
| `_xll.NoiSuySPT` | 140 | N nội suy | BLACK_BOX/REVIEW | Không dùng cached result để xác minh. |
| `_xll.LNgamTrongDat` | 1 | chiều dài ngàm trong lớp mũi | INFERRED | Có cached benchmark; thuật toán hình học có thể viết độc lập, nhưng UDF không dùng Production. |
| `_xll.TinhGammaqb` | 1 | hệ số mũi | BLACK_BOX | Chưa có implementation XLL. |
| `_xll.GetKsFromRQD` | 1 | Ks/Kr | BLACK_BOX | Bảng 1 HNL cho khoảng Kr, không phải hàm đơn trị. Cached RQD=30→0.24 không đủ xác minh. |

### VBA nhìn thấy và đã reverse

- `NoiSuy2`: nội suy tuyến tính giữa hai điểm; ngoài miền trả 0. Đây **không** được dùng thay interpolation policy HNL vì trả 0 ngoài miền là nguy hiểm.
- `NoiSuy`: biến thể lấy trung bình quanh mũi với các vị trí phụ thuộc `D`.
- `NoiSuyMeyerhof`: biến thể mũi khác; hiện tag LEGACY/REVIEW.
- `SoLuongCoc`, `HSAT`, `XacDinhSCT`: P1, chứa nhóm hệ số và rounding; chưa promote vì chưa có provenance chuẩn.
- `DoTimSoLuongCocGanNhau`: cluster pile theo khoảng cách, useful reference cho PileGroupEngine; REVIEW.
- `LinkData_SPT`/`CopyData_SPT_ValueOnly`: loop `k=0..27`, xác nhận workbook hỗ trợ cấu trúc tới **28 block lỗ khoan**. HNL tương lai phải dùng `boreholes[]`, không hard-code 28.

## D. Bug Report

| ID | Severity | Sheet | Cell/Scope | Problem | Engineering impact | Proposed fix |
|---|---|---|---|---|---|---|
| XLSM-B01 | BLOCKER | ThisWorkbook/VBA | Workbook_Open / EnsureDceAddinLoaded | Workbook tự nạp proprietary DCE XLL từ C:\Dce Pro\V.2020\DCE Excel-AddIn64.xll hoặc bản 32-bit. | Không tái tính độc lập; hàng nghìn formula thành black box khi thiếu add-in. | HNL không phụ thuộc XLL; reverse từng workflow và chỉ promote khi PDF+Golden PASS. |
| XLSM-B02 | HIGH | SCT VatLieu | D23/F23 | Nhãn D23 là Rsc nhưng F23=VLOOKUP(C23,BANGTRA!G12:H25,2,0) trả cột H=Rs. Với CB400-V cached=350 trong khi BANGTRA!I21 (Rsc)=365. | Có thể dùng sai cường độ thép nén trong workbook. | Không kế thừa. HNL tiếp tục dùng bảng TCVN5574 VERIFIED riêng; workbook chỉ ghi bug benchmark. |
| XLSM-B03 | HIGH | Workbook Defined Names | 53 names | 53/80 Defined Names chứa #REF!, gồm B4.CHITIEUCOLY, ExternalData_1, AST/B/DDY/EC/ES/FC/FY/KX/KY/LUX/LUY và một số Print Area. | Rủi ro macro/name lookup/print/import hỏng âm thầm. | Không import named-range infrastructure; importer HNL dùng schema explicit. |
| XLSM-B04 | HIGH | LYTHUYET/BANGTRA/HK1 | nhiều vùng | Logic/dữ liệu TCVN 10304:2014 cùng tồn tại với workflow 2025. | Nguy cơ dùng nhầm bảng/công thức legacy cho engine 2025. | Tag LEGACY và cô lập namespace/edition. |
| XLSM-B05 | HIGH | SPT/EQ/7.2.2/7.2.3 | ~6,871 XLL calls | Kết quả phụ thuộc cached values và implementation XLL không nằm trong XLSM. | Không thể audit trực tiếp công thức thật chỉ từ workbook. | Probe + PDF provenance + deterministic HNL implementation; không promote từ cached value. |
| XLSM-B06 | MEDIUM | A_Function VBA | NoiSuy2 | Ngoài miền dữ liệu hàm trả 0 thay vì lỗi/cảnh báo. | Có thể biến outside-domain thành sức kháng/N bằng 0 âm thầm. | HNL dùng strict interpolation policy và explicit BLOCK/plateau chỉ khi tiêu chuẩn cho phép. |
| XLSM-B07 | MEDIUM | 7.2.1/7.2.2/7.2.3/SPT | Rd cells | FLOOR(...,10) làm tròn xuống 10 kN trước khi trình bày. | Có sai khác benchmark final value so với engine giữ full precision. | HNL giữ precision nội bộ; rounding chỉ presentation, provenance rõ. |
| XLSM-B08 | MEDIUM | VBA | EnsureDceAddinLoaded | Đường dẫn add-in hard-code theo C: và Dce Pro V.2020. | Không portable và khó CI/build reproducible. | Loại bỏ phụ thuộc add-in trong HNL. |

### Bug Rsc xác nhận

`SCT VatLieu!D23` ghi **Rsc**, nhưng `F23=VLOOKUP(C23,BANGTRA!G12:H25,2,0)`.  
Với `CB400 - V`, `BANGTRA!H21=350 (Rs)` và `BANGTRA!I21=365 (Rsc)`, nên workbook cached `F23=350`. Đây là lỗi nội bộ của workbook. HNL **không** sao chép lỗi này; HNL dùng dữ liệu TCVN 5574 đã VERIFIED riêng.

## E. HNL Gap Matrix

| ID | Workflow | HNL trước P0 | Gap | Action | Status |
|---|---|---|---|---|---|
| G-P0-01 | Pile geometry | Chỉ square/circle solid cho driven; geometry parser cơ bản. | Thiếu engine geometry dùng chung và hai đường kính trong độc lập. | IMPLEMENTED | VERIFIED |
| G-P0-02 | Borehole/profile | Layers array + split riêng trong driven. | Thiếu engine địa tầng dùng chung/boundary policy/coverage audit. | IMPLEMENTED | VERIFIED |
| G-P0-03 | §7.2.2 shaft active interval | Driven split từ z=0 đến tip. | Không biểu diễn shaftStartDepthM khi đầu cọc không ở z=0. | IMPLEMENTED | VERIFIED-ID/CT9-COMPATIBLE |
| G-P0-04 | §7.2.1 rock | Có CT5-8 khi người dùng cung cấp qb/Rm/Ld/df; Table1 metadata là range. | Chưa có rule duy nhất RQD→Ks và các workbook branches chưa đối chiếu PDF trong lần audit này. | DO_NOT_IMPLEMENT_YET | REVIEW/BLOCKED_BY_PDF |
| G-P0-05 | §7.2.2 driven/non-excavated | Bảng 2/3/4 + CT9 deterministic, segmentation ≤2m, Golden coverage. | XLL không cần thay engine; cần benchmark cell-by-cell sau khi có matching inputs. | KEEP_HNL_VERIFIED | VERIFIED-HNL / XLSM-REFERENCE |
| G-P0-06 | §7.2.3 bored/excavated | Bảng6/7/8 + CT13-16, nhưng shaft nhận Σfi·hi aggregate. | Thiếu layer-by-layer bored shaft + construction factor trace. | P0-NEXT_AFTER_PDF_TRACE | REVIEW |
| G-P0-07 | SPT Appendix D | Chỉ tính từ qb/fs/fc/Ls/Lc đã cho. | Thiếu full SPT profile engine và lookup/nội suy N. | BLOCK_PRODUCTION | BLACK_BOX/REVIEW |
| G-P0-08 | Interpolation | Strict policies B2/3/4/6/7/8/12/15/16/17. | Không thay policy HNL bằng VBA; cần mismatch matrix per table. | KEEP_HNL_POLICY | VERIFIED-HNL |
| G-P1-01 | Material capacity | TCVN5574 material tables/calc present. | Cần full pile material capacity/gov min; workbook có Rsc bug. | P1 | REVIEW |
| G-P1-02 | Multi-borehole | Single profile workflows. | Thiếu boreholes[] batch/governing. | P1 | REVIEW |
| G-P1-03 | Pile quantity/reaction/import | Chưa workflow end-to-end. | Thiếu StructuralImport/PileQuantity/PileReaction. | P1 | REVIEW |
| G-P2-01 | EQ | Không production black-box EQ. | Thiếu provenance Điều/Bảng/Trang và deterministic implementation. | P2 | BLACK_BOX/REVIEW |

## E2. Mismatch Matrix

| ID | Variable | XLSM | HNL Engine | Decision | Status |
|---|---|---|---|---|---|
| MM-001 | Ks/Kr at RQD=30% | _xll.GetKsFromRQD(30) cached 0.24 | No automatic unique RQD→Kr mapping | DO NOT COPY; require PDF/engineering rule or explicit user-selected Kr | REVIEW |
| MM-002 | qb rock branch | MIN(IF(Ld<0.5,Rm,Rm*(1+0.4Ld/df)),20000) | No Ld<0.5/cap-20000 branch in current implementation | PDF GATE before code change | REVIEW/BLOCKED_BY_PDF |
| MM-003 | Driven shaft active interval | Qs = flu(tip)-flu(head) | P0 now integrates directly over [shaftStartDepthM, tipDepthM] | Engine + Formula-Only Excel đã dùng shaftStartDepthM thống nhất | IMPLEMENTED/VERIFIED |
| MM-004 | Segment size | D17 configurable; sample=1 m | P0 Engine + Formula-Only Excel dùng maxSegmentM trong (0,2], default 2 | IMPLEMENTED | VERIFIED |
| MM-005 | Rsc material lookup | D23 label Rsc; F23 VLOOKUP G:H returns workbook Rs=350 while workbook own I21 says Rsc=365 | Uses HNL verified table, not workbook BANGTRA | Do not inherit workbook mapping | WORKBOOK BUG |
| MM-006 | SPT qb/fi | qb_SPT2025/flu_SPT2025/NoiSuySPT hidden XLL | Requires precomputed qb/fs/fc/Ls/Lc | Keep REVIEW until Appendix D PDF/table logic is fully mapped | BLACK_BOX/REVIEW |

## F. Integration Plan

### P0 — audit hoàn tất; deterministic tranche đã tích hợp

**Đã code, VERIFIED ở phạm vi deterministic**

1. `PileGeometryEngine`: circle/square, solid/hollow, `Di_tip`/`Di_mass`, Ab, Aconcrete, u, I, volume, optional self-weight.
2. `BoreholeEngine`: normalize layers, layer-at-depth với boundary policy explicit, split interval, coverage audit.
3. `PileDrivenEngine`: thêm optional `shaftStartDepthM`; default vẫn 0 nên không phá regression cũ. Ma sát thân chỉ tích phân trên vùng cọc thực sự tham gia.
4. `PileDrivenEngine`: thêm `maxSegmentM`, chỉ chấp nhận `0 < maxSegmentM ≤ 2`; có thể benchmark workbook bước 1 m mà không vi phạm policy HNL.

**Giữ nguyên HNL đã VERIFIED**

- Bảng 2, 3, 4, 6, 7, 8, 12, 15, 16, 17 và interpolation policies hiện có.
- Không thay kết quả HNL theo XLL khi chưa có mismatch root cause.

**Chưa code Production**

- `RQD → Ks/Kr` đơn trị của `_xll.GetKsFromRQD`.
- Full SPT `NoiSuySPT/qb_SPT2025/flu_SPT2025`.
- Full bored shaft XLL.
- EQ XLL.

### P1

Material capacity governing `min(Rsoil,Rmaterial)`, multi-borehole batch, pile quantity, pile reaction, ETABS/SAP importer.

### P2

EQ/seismic, pile group advanced, report/visualization.

## G. Golden Benchmark Strategy

Mỗi case phải có matrix:

`Variable | PDF | XLSM | HNL Engine | HNL Excel | tolerance | decision`.

P0 hiện có hai tầng benchmark:

1. **Visible-formula benchmark**: geometry cells D18/F32/F20... được tái tạo độc lập và test PASS.
2. **HNL existing Full Table Golden**: dùng lại bộ bảng Verified; XLSM XLL chưa được dùng để override.

Các UDF BLACK_BOX chỉ được probe như reference. Chúng không thể trở thành expected truth khi thiếu PDF/source XLL.

## H. Code Changes

- **NEW** `src/pile-geometry-engine.js`
- **NEW** `src/borehole-engine.js`
- **UPDATED** `src/pile-workflows.js` để dùng geometry engine, `shaftStartDepthM` và `maxSegmentM`.
- **UPDATED** `src/excel-export.js` để Formula-Only Excel dùng cùng `shaftStartDepthM`/`maxSegmentM`, không còn hard-code vùng ma sát từ 0 m và bước 2 m.
- **NEW** `tests/v1.25.7-p0-xlsm.test.mjs`
- **NEW** `artifacts/p0-xlsm-audit/...` audit evidence/report data.
- **UNCHANGED** `src/search.js` (Search Brain locked).

## I. Test / Verification Gate

Sau code P0 đã chạy thật:

- `npm test`: **304/304 PASS**.
- Version gate: **PASS v1.25.7**.
- Search Brain gate: **PASS**, hash `f9b65e5e6fb61dcca233a4fe43950e3174c73536f2fa83452da3041fbd0021d2`.
- `npm run golden:tables`: **1.130/1.130 PASS**; không giảm coverage Bảng 2/3/4/6/7/8/12/15/16/17.
- `npm ci`: **BLOCKED** vì source ZIP đầu vào không có `package-lock.json`.
- `npm run excel:smoke`: **BLOCKED** vì môi trường chưa có `exceljs` do npm ci chưa chạy được.
- `npm run build:web`: **BLOCKED** vì môi trường chưa có `vite` do npm ci chưa chạy được.

Các BLOCKED trên là dependency/build gate, không được ghi PASS giả.

### Blocker chuẩn nguồn còn lại

Cuối vòng P0 đã **locate được PDF TCVN 10304:2025 và TCVN 5574:2018 trong File Library của dự án**. Tuy nhiên bản XLSM không chứa implementation của DCE XLL, và lượt P0 này chưa hoàn tất targeted clause extraction + probe/boundary benchmark cho từng hàm `GetKsFromRQD`, `qb_SPT2025`, `flu_SPT2025`, nhóm cọc khoan và EQ. Vì vậy các nhánh chỉ suy từ XLL/cached output vẫn giữ `REVIEW/BLACK_BOX`; việc locate PDF **không tự động nâng trạng thái**. Các phần HNL đã có provenance VERIFIED từ codepack/PDF trước đó được giữ nguyên, không tái gắn VERIFIED từ workbook.

P0 tiếp theo cho các nhánh này là: `PDF clause/table extraction → independent deterministic implementation → exact/mid/boundary/outside probes → HNL Engine ↔ HNL Excel ↔ XLSM reference`. Chỉ sau khi toàn bộ chuỗi PASS mới được promote Production.
