# P1 Pass 5 Core Locked Release — v16

## Decision

`P1 Pass 5 Core = LOCKED`.

This is a scoped Core Lock. It does **not** claim that ETABS/SAP live COM was executed.

## Locked scope

- Canonical structural import schema.
- DCE workbook table adapter.
- CSI flat-table payload contract.
- CSV fallback with explicit `kN_m_C` profile.
- Point/Node identity and spring-property mapping.
- Nodal raw-row preservation + Fz max/min data envelope with provenance.
- Source-specific compression sign convention.
- Pass 3 PIERFORCES handoff.
- Pass 4 imported nodal-reaction handoff.
- Missing/orphan/duplicate-data blocking rules.
- Importer invariant: `parse -> normalize -> map -> validate -> handoff` only.

## Deferred / not part of Core Lock

- Live ETABS/SAP CSi API certification: READY, NOT CERTIFIED LIVE.
- Windows Excel COM runtime certification: contract/source ready, not run here.
- Full current HNL source integration: separate release/integration gate.

## Exact DCE coverage

- Point Coordinates: 194.
- Nodal Reactions raw rows: 38.
- Nodal envelopes: 19.
- Point Spring Assignments: 19.
- PIERFORCES: 234.
- PIERSECTION: 39.

## Golden chain

- Nodal envelope -> TM SCT Coc F/G: 19/19 PASS.
- PIERFORCES -> Pass 3 source rows: 39/39 PASS.
- Imported reaction handoff -> Pass 4 numeric decision: PASS with independently supplied LOCKED capacity.
- CSV fallback reproduces canonical counts: PASS.
- Live-shaped replay reproduces DCE canonical data: PASS, but is not used as live certification.

## Prior locked evidence retained

- Regression: 388/388 PASS.
- Full Table Golden: 1242/1242 PASS.
- Pass 3 pile quantity: 39/39 XLSM rows and 273/273 behavioral checks PASS.
- Search Brain normalized SHA-256 remains the prior locked value:
  `f9b65e5e6fb61dcca233a4fe43950e3174c73536f2fa83452da3041fbd0021d2`.

## Future live certification

When ETABS/SAP becomes available on Windows, run:

`windows\csi-bridge\RUN_PASS5_FINAL_LOCK.cmd`

That future gate upgrades only the Live Adapter certification. It does not redefine the already-locked Core importer logic.
