# P1 Pass 4 v4 — Mode Separation Audit

## Confirmed workbook evidence
The prior P0 workbook audit identifies `TM SCT Coc` as:
- input: Point Coordinates + Nodal Reactions + Point Spring Assignments + Rd;
- intermediate: match pile/point/load + utilization;
- output: per-pile check;
- 6,082 formulas;
- 0 UDF/XLL.

This evidence supports an imported-reaction checking workflow. It does not prove that `TM SCT Coc`
derives pile forces from global N/Mx/My using a rigid-cap equation.

## Architecture correction
P1 Pass 4 is therefore split into two deterministic modes:

1. `ANALYTICAL_RIGID_CAP`
   - HNL derives Ni from N/Mx/My;
   - full coupled 3x3 equilibrium;
   - independent engineering model;
   - REVIEW until normative/model assumptions are fully sourced.

2. `IMPORTED_NODAL_REACTION`
   - strict join Point -> Spring -> Pile -> Nodal Reaction;
   - explicit compression sign convention;
   - per-pile compression/tension utilization;
   - no reuse of compression capacity for tension;
   - multi-combination envelope;
   - closest to audited `TM SCT Coc` data-flow;
   - still REVIEW until exact XLSM cell formula mapping is benchmarked.

## Tests
- Previous analytical tests: 24/24 PASS.
- New imported reaction tests: 12/12 PASS.
- Total P1 Pass 4 local tests: 36/36 PASS.

## Lock gate
Do NOT promote to LOCKED yet. Required remaining evidence:
- exact `TM SCT Coc` formula blocks/cell references;
- exact sign/case filtering behavior;
- exact capacity basis used by workbook;
- XLSM cached results vs HNL imported checker;
- Engine vs Formula-Only Excel benchmark on workbook-derived fixture;
- prior full regression and Search Brain gates on the integrated source.
