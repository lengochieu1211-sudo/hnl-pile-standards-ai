# P1 Pass 5.2 — Live CSi API Bridge v14

## Scope
Importer/bridge only: connect, read raw data, normalize, validate, hand off. No pile engineering calculations live in this layer.

## Windows live bridge
Implemented `windows/csi-bridge/HnlCsiLiveBridge.cs`:
- attach through `CSiAPIv1.Helper.GetObject`;
- ETABS and SAP2000 ProgID candidates;
- save current Present Units, force/verify kN-m-C, restore original units in `finally`;
- `DatabaseTables.GetAvailableTables` + `GetTableForDisplayArray`;
- `PointObj.GetNameList` + `GetCoordCartesian`;
- `Results.JointReact` with ObjectElm=0;
- JSON-only raw output.

The Node adapter cross-checks direct `GetCoordCartesian` against the coordinate table and direct `JointReact` against the reaction table. If both sources exist and disagree beyond tolerance, live import is blocked.

## Fallback
- CSV: pure Node parser, no Excel required.
- Excel: Windows Excel COM extractor for Point Coordinates, Nodal Reactions, Point Spring Assignments, PIERFORCES, PIERSECTION.
- Both fallback routes require an explicit `kN_m_C` profile; silent unit guessing is prohibited.

## Golden replay
Exact DCE source data was shaped as a live API payload and sent through the same bridge adapter:
- coordinates 194/194;
- nodal raw reactions 38;
- envelopes 19/19;
- direct-vs-table reaction groups 19/19;
- point springs 19;
- PIERFORCES 234/234;
- PIERSECTION 39;
- Pass 4 handoff reproduces the exact DCE compression decisions once capacity is supplied by the locked upstream engine.

Replay Golden result: PASS, issues=0.

## Tests
126/126 Node/static-contract tests PASS, 0 FAIL.

## Lock boundary
Pass 5.2 schema/adapter/fallback contracts are ready, but **full Pass 5 remains REVIEW**.
The actual Windows CSi API call and bridge compilation cannot be executed in this Linux runtime.
Use `windows/csi-bridge/RUN_LIVE_GOLDEN.cmd` on Windows with the reference ETABS/SAP model. Full Pass 5 may be promoted only after that Live Golden passes and prior regression/Search Brain gates remain unchanged.
