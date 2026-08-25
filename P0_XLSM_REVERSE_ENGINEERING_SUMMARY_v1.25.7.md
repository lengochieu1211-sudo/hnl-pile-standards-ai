# HNL Pile Standards AI v1.25.7 — P0 XLSM Reverse Engineering Summary

Nguồn benchmark: `10.1 DCE_SctCoc_10304 2025.xlsm`  
SHA-256: `ec38b68f753b08e50d9d1f9df988be5084cab1aedf391ba1aaecf112e9d88bd1`

## Kết quả P0

- Audit 21 sheet: 10 visible, 11 hidden.
- 14,947 formula cells; 59,149 direct dependency edges.
- 80 Defined Names; 53 chứa `#REF!`.
- 6,871 XLL calls; 17 distinct `_xll.*` UDF.
- VBA xác nhận workbook tự nạp proprietary DCE XLL từ `C:\Dce Pro\V.2020\...`.
- TCVN 10304:2014 / dữ liệu cũ được tag LEGACY, không được phép lẫn vào Calculation Engine 2025.
- Workbook bug xác nhận tại `SCT VatLieu!F23`: nhãn Rsc nhưng VLOOKUP chỉ lấy cột Rs; không sao chép sang HNL.

## Module đã tích hợp sau verification deterministic

1. `src/pile-geometry-engine.js`
   - cọc tròn/vuông, đặc/rỗng;
   - tách `Di_tip` và `Di_mass`;
   - diện tích mũi, diện tích bê tông, chu vi, I, thể tích, chiều dài theo cao độ;
   - tự trọng chỉ tính khi unit weight được nhập rõ.
2. `src/borehole-engine.js`
   - normalize địa tầng;
   - explicit tip boundary policy;
   - chia interval địa tầng deterministic.
3. `src/pile-workflows.js`
   - `shaftStartDepthM` cho vùng ma sát thực;
   - `maxSegmentM` cấu hình nhưng bắt buộc `0 < Δz ≤ 2 m`;
   - logic Bảng 2/3/4 VERIFIED hiện hữu không bị thay bằng XLL.
4. `src/excel-export.js`
   - Formula-Only Excel dùng cùng `shaftStartDepthM` và `maxSegmentM`;
   - không còn hard-code ma sát từ z=0 hoặc bước đúng 2m.

## Nhánh chưa được promote

`GetKsFromRQD`, full SPT profile (`NoiSuySPT/qb_SPT2025/flu_SPT2025`), bored-pile XLL và EQ XLL vẫn `REVIEW/BLACK_BOX`. PDF TCVN 10304:2025 và TCVN 5574:2018 đã locate trong File Library nhưng việc locate PDF không thay thế targeted clause/table extraction + boundary/probe benchmark.

## Verification

- P0 focused tests: **7/7 PASS**.
- Regression: **304/304 PASS**.
- Full Table Golden: **1,130/1,130 PASS**.
- Search Brain: unchanged; SHA-256 `f9b65e5e6fb61dcca233a4fe43950e3174c73536f2fa83452da3041fbd0021d2`.
- `npm ci`: BLOCKED — ZIP nguồn đầu vào không có `package-lock.json`.
- `excel:smoke`: BLOCKED — `exceljs` chưa cài do gate trên.
- `build:web`: BLOCKED — `vite` chưa cài do gate trên.

Repo GitHub hiện có `package-lock.json` v1.25.7 (blob SHA `c948babe0e82afa9a5b8fdf3b3e7fceea26728da`), nhưng file này không được thay thế vào source P0 từ GitHub; source ZIP người dùng vẫn là nguồn code authoritative.

## Deliverables trong source

- `docs/P0_XLSM_REVERSE_ENGINEERING_V1.25.7.md`
- `docs/UDF_REVERSE_ENGINEERING_DCE_V2020.md`
- `artifacts/p0-xlsm-audit/workbook_audit.json` (qua evidence)
- `artifacts/p0-xlsm-audit/p0-gap-matrix-v1.25.7.json`
- `artifacts/p0-xlsm-audit/mismatch-matrix-v1.25.7.json`
- `artifacts/p0-xlsm-audit/evidence/formulas.json`
- `artifacts/p0-xlsm-audit/evidence/dependency_edges.json`
- `artifacts/p0-xlsm-audit/evidence/A_Function.vba.txt`
- `artifacts/p0-xlsm-audit/evidence/ThisWorkbook.vba.txt`
- test/golden/gate logs trong `artifacts/p0-xlsm-audit/`.
