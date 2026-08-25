# P1 Pass 5 — ETABS/SAP Importer v13

## Architecture
Pass 5 is intentionally non-numeric:

`parse -> normalize -> map -> validate -> handoff`

It MUST NOT calculate pile reaction, capacity, utilization, rigid-cap force distribution, or select the governing structural combination.

## Exact DCE table schema
From `10.1 DCE_SctCoc_10304 2025.xlsm`:

- Point Coordinates: 194 data rows.
- Nodal Reactions: 38 raw rows.
- Point Spring Assignments: 19 rows.
- PIERFORCES: 234 rows.
- PIERSECTION: 39 rows.

### Identity correction
`Spring=C250` is a property/type, not a unique physical pile. The canonical physical pile identity defaults to the Point/Node ID.

### Reaction envelope correction
`Nodal Reactions` has two EULS rows per pile point. The importer must preserve both raw rows and create an import envelope with `FzMax` / `FzMin` plus source-row provenance.

For the DCE workbook:
- nodal Fz is compression-positive -> Pass 4 compression handoff uses FzMax;
- PIERFORCES P is compression-negative -> preserved unchanged for Pass 3.

No global sign convention is allowed.

## Golden
- All 19 pile points reproduce TM SCT Coc `F=Nd Max` and `G=Nd Min`.
- All 39 Pass 3 source rows preserve P/V2/V3/T/M2/M3 at Location=0.
- Import handoff reproduces the locked TM SCT Coc compression decision when capacity is supplied independently by the upstream HNL capacity chain.
- Full Pass 4 + Pass 5 Node suite: 101/101 PASS.

## CSi API evidence
The supplied `CSiAPIv1.dll` exposes symbols including `cSapModel`, `DatabaseTables`, `GetTableForDisplayArray`, CSV/XML table calls, `Results.JointReact`, and `GetCoordCartesian`. These symbols support the selected table/API adapter architecture.

Live ETABS/SAP COM invocation is NOT claimed: current runtime is Linux. The live Windows connector remains Pass 5.2 REVIEW.

## Gate
- Canonical schema: LOCKED.
- DCE workbook table adapter: LOCKED.
- Generic CSI flat table adapter contract: LOCKED.
- Live CSI API/COM adapter: REVIEW / NOT RUN.
- Full Pass 5: REVIEW.
