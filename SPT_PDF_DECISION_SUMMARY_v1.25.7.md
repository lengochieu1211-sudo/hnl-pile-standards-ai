# SPT PDF Decision — HNL v1.25.7

- Normative: TCVN 10304:2025 Phụ lục D, D.1–D.6, Bảng D.1, tr.110–111.
- Tip N: mean điểm SPT đo thật trong cửa sổ quy định; cap 100; không có điểm → BLOCK.
- Shaft Ns/Nc: N đại diện lớp có provenance hoặc mean điểm đo thật trong chính lớp.
- Boundary: `[top,bottom)`, điểm đúng ranh giới thuộc lớp sâu hơn.
- DCE `NoiSuySPT` + right-end accumulation: REFERENCE-ONLY, không Production.
- DCE full scenario: Qb match; Qs HNL=6574.222451 kN vs DCE=6975.297018 kN; classification `DIFFERENT_BY_NORMATIVE_POLICY_DECISION`.
- Focused: 18/18 PASS; regression 361/361; Table Golden 1242/1242; DCE Behavioral 213/213; SPT Decision Golden 26/26.
