# HNL Pile Standards AI v1.25.7 — P1 Pass 2 Multi-Borehole

## 1. Scope locked in this pass

P1 Pass 2 evaluates **one common square pile** against many boreholes (`HK1`, `HK2`, `HK3`, …) and, for every borehole, executes two independently locked soil-resistance branches:

1. Mechanical method:
   - `10304-driven` — TCVN 10304:2025 §7.2.2, or
   - `10304-bored` — TCVN 10304:2025 §7.2.3.
2. `10304-spt` — TCVN 10304:2025 Appendix D with the locked SPT PDF Decision policy.

The same independently locked `PileMaterialEngine` result is then applied to every row.

This batch layer does **not** introduce a new TCVN resistance formula. It is an HNL deterministic composition/orchestration layer over child workflows whose normative provenance remains unchanged.

## 2. Calculation graph

For each borehole `HK_i` and each method `m`:

`borehole profile -> child soil workflow -> Qb, Qs, Rk -> gamma_k -> Rd = Rsoil`

`common pile/material inputs -> PileMaterialEngine -> Rmaterial`

`Rpile(i,m) = min(Rd(i,m), Rmaterial)`

If `gamma_n` is available:

`Nd,max(i,m) = Rpile(i,m) / gamma_n`

Batch selection:

`Rpile,min = min over all HK x method rows`

The engine also reports independently:

- `Rd,min` and the adverse borehole/method for soil only;
- `Qb,min`;
- `Qs,min`;
- the soil at pile tip for each row;
- per-borehole adverse method.

## 3. Material-tie rule

`Rmaterial` is common because the physical pile is common. Therefore many rows can have the same `Rpile,min` when material governs.

In that case HNL does **not** fabricate a single adverse borehole or method:

- `materialTie = true`
- `criticalBoreholeId = null`
- `criticalMethodId = null`

The separate `soilMinimum` record remains available to identify the adverse geological borehole/method.

## 4. Safety gates

Production batch is blocked when any of the following occurs:

- fewer than two boreholes;
- duplicate borehole IDs;
- unsupported mechanical child workflow;
- a borehole profile does not continuously cover shaft start to pile tip;
- any HK×method child workflow is not Production-valid;
- `Rmaterial` is not Production-valid;
- Production Status Registry does not report the batch module as LOCKED.

No failed child row is silently skipped when selecting the minimum.

## 5. SPT policy

This pass inherits the locked SPT PDF Decision:

- no DCE `NoiSuySPT` continuous interpolation in Production;
- pile-tip N uses measured points in the normative influence window;
- shaft Ns/Nc is resolved by geological layer and measured/representative layer data;
- layer boundary policy is `[top,bottom)`, so an exact boundary point belongs to the deeper layer.

DCE XLSM/XLL remains behavioral reference only.

## 6. Excel Formula-Only architecture

`exportMultiBoreholePileCapacityWorkbook()` creates:

- `README`
- `BATCH_INPUT`
- `BOREHOLE_BATCH`
- `BATCH_SOURCE`
- one complete formula-only child workbook clone for every HK×method branch.

`BATCH_INPUT` is the **single common material/gamma_n input**. Every cloned `MATERIAL_INPUT` sheet links back to it by Excel formula, so editing `As`, concrete grade, steel grade, `L0`, `e0`, load duration, or `gamma_n` propagates to all boreholes/methods.

`BOREHOLE_BATCH` does not contain dead Engine results. It links to child formula cells for:

- Qb
- Qs
- Rk
- Rd
- Rmaterial
- Rpile
- Nd,max
- governing status

and calculates minima using Excel formulas.

The Windows Excel COM gate additionally verifies that:

1. initial batch governing is HK2 mechanical for the Golden fixture;
2. changing common `As` updates `Rmaterial` in every branch identically;
3. strengthening only HK2 mechanical soil moves the batch governing method to HK2 SPT after recalculation.

## 7. Golden benchmark

Base fixture: 3 sand boreholes × 2 methods = 6 deterministic rows.

Expected governing results:

- HK1 mechanical Rd = 1227.257142857143 kN
- HK1 SPT Rd = 1641.6000000000001 kN
- HK2 mechanical Rd = **843.4285714285716 kN**
- HK2 SPT Rd = 1093.3333333333335 kN
- HK3 mechanical Rd = 1654.6857142857148 kN
- HK3 SPT Rd = 2394.666666666667 kN

Therefore:

- adverse borehole = `HK2`
- adverse method = `10304-driven`
- `Rpile,min = 843.4285714285716 kN`

Golden checks:

- 6 rows;
- 42/42 row intermediate metrics Engine ↔ independent Excel-like model PASS;
- 5/5 batch summary metrics PASS;
- 5/5 boundary/safety cases PASS;
- 3/3 fixed engineering benchmarks PASS.

## 8. XLSM relationship

The DCE workbook is a workflow/reference source and helped reveal borehole-oriented data structures. The Multi-Borehole batch selector itself is an **HNL architecture extension** requested for production use; it is not claimed to be a formula copied from the XLSM and it is not claimed to be a standalone TCVN formula.

Normative authority remains the child TCVN calculations.

## 9. Production status

`pile-capacity-multiborehole-square` = **LOCKED / productionNumeric=true** within this defined scope.

EQ remains REVIEW and is not included in the batch Production matrix.
