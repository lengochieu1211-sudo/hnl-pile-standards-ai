# TM SCT Coc Formula Pattern Reconstruction — v5

## Evidence boundary
Prior workbook reverse engineering confirms `TM SCT Coc` has 6,082 formula cells and 0 UDF/XLL calls.
It consumes Point Coordinates, Nodal Reactions, Point Spring Assignments and Rd/capacity; its
intermediate role is pile/point/load matching + utilization, with per-pile check output.

The current evidence set does **not** expose all 6,082 individual formulas/cell addresses.
Therefore no per-block formula count or XLSM cell range is invented.

## Reconstructed deterministic blocks
1. JOIN
   - pointId → coordinates
   - pointId → spring → pileId
   - pointId + combinationId → nodal reaction
   - missing/duplicate join → BLOCK

2. ACTION
   - preserve raw Fz
   - explicit compression-positive / compression-negative normalization
   - classify COMPRESSION/TENSION
   - Fx/Fy/Mx/My/Mz remain imported metadata for this axial check

3. CAPACITY
   - pileId → verified compression capacity from upstream HNL
   - tension requires a separately verified tension capacity
   - never reuse compression Rpile as uplift capacity

4. UTILIZATION
   - compression: max(0, demand) / compression capacity
   - tension: |demand| / verified tension capacity

5. STATUS
   - utilization <= 1 → PASS
   - utilization > 1 → FAIL
   - missing critical data or tension capacity → BLOCK
   - governing is maximum verified utilization, distinct from maximum compression demand

## Golden fixture
`TM-SCT-COC-GOLDEN-SEED-IMPORT-001` covers 4 piles × 2 combinations.
Expected governing row is C1/P4 with utilization 0.875.

## Test gate
The new pattern reconstruction contributes 15 tests. All prior Pass 4 tests are also run together.

## Promotion boundary
This reconstruction narrows the remaining XLSM work from “understand 6,082 formulas” to:
- obtain exact XLSM cell inventory;
- assign formulas/cell ranges to these five blocks;
- compare cached XLSM outputs to this trace;
- verify exact sign/filter/capacity conventions;
- then run XLSM ↔ Engine ↔ Excel Golden before LOCKED.
