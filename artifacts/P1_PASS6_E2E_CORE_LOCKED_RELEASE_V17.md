# P1 Pass 6 — End-to-End Structural Workflow Integration — Core Locked v17

## Locked chain

DCE/CSV structural data → Pass 5 Core LOCKED importer → canonical schema → Pass 4 IMPORTED_NODAL_REACTION LOCKED numeric core → upstream LOCKED Rpile/γn → per-pile check → governing pile/combo → Excel/report.

## Golden

- Tests: 148/148 PASS, 0 FAIL.
- DCE ↔ CSV E2E: 19/19 PASS.
- Piles: 19.
- Combination: EULS.
- Capacity: Rpile=843.428571428572 kN; γn=1.15; Nd,max=733.416149068323 kN/pile.
- Governing pile/point: 168.
- Governing demand: 365.292050700582 kN.
- Governing utilization: 0.498069276446.
- Overall: PASS.

## Safety boundaries

- Manual/unverified capacity: BLOCK.
- Rpile/γn inconsistency: BLOCK.
- Unknown combination: BLOCK.
- DCE Rd=350 is REFERENCE and is not used as Production capacity.
- ANALYTICAL_RIGID_CAP is not invoked by this Golden.
- Live ETABS/SAP certification remains deferred.
- Full-source integration remains a separate gate.

## Excel

`HNL_P1_Pass6_E2E_Structural_Golden_v17.xlsx` contains editable locked-capacity inputs, real Excel formulas for Nd,max, utilization/status/governing, imported structural rows, provenance, and gate evidence. Formula-error scan: PASS (0 matches).
