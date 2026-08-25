# P1 Pass 5 Final Windows Live Lock Gate — v15

This bundle adds the only allowed final promotion path for P1 Pass 5.

## Final live chain

`Running ETABS/SAP2000`
→ `CSiAPIv1 live bridge`
→ exact raw JSON
→ direct-vs-DatabaseTables cross-check
→ canonical Pass 5 importer
→ DCE reference Golden comparison
→ current Node regression
→ prior 388 / 1242 / Pass3 gates
→ actual `src/search.js` normalized SHA-256
→ `P1_PASS5_LOCKED.json`

## Fail-safe rules

The final LOCK manifest is written only in `--mode live`.
Replay mode can validate the gate implementation but can never create a LOCKED manifest.

Live mode requires:

- sourceMode = LIVE_API
- verified `kN_m_C`
- original CSi Present Units restored after reading
- 194/194 coordinates
- 19/19 nodal-reaction envelopes
- 234/234 PIERFORCES rows
- 19 spring assignments
- 39 PIERSECTION rows
- direct `GetCoordCartesian` vs DatabaseTables = PASS
- direct `Results.JointReact` vs DatabaseTables = PASS
- current Pass4/Pass5 test suite = PASS
- prior Regression = 388/388
- Full Table Golden = 1242/1242
- Pass3 pile quantity = 39/39 and 273/273
- actual Search Brain normalized SHA-256 =
  `f9b65e5e6fb61dcca233a4fe43950e3174c73536f2fa83452da3041fbd0021d2`

## Windows command

Use:

`windows\csi-bridge\RUN_PASS5_FINAL_LOCK.cmd`

Arguments:

1. path to `CSiAPIv1.dll`
2. path to the FULL current HNL source root containing `src\search.js`
3. path to `gate-status-v1.25.7.json`
4. optional product: `auto`, `etabs`, or `sap2000`
5. optional output combination list

The script creates `P1_PASS5_LOCKED.json` only when every gate passes.

## Environment status here

The current environment is Linux and cannot attach to a live ETABS/SAP COM instance.
Therefore v15 is validated in replay mode only; it does not claim a Windows Live PASS.
