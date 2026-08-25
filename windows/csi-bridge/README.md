# P1 Pass 5.2 — Windows CSi Live Bridge

- `HnlCsiLiveBridge.cs`: attaches to a running ETABS/SAP2000 instance through `CSiAPIv1.Helper.GetObject`, forces/validates `kN_m_C`, reads DatabaseTables, PointObj.GetCoordCartesian and Results.JointReact, then emits raw JSON only.
- `BUILD_CSI_BRIDGE.cmd`: builds the bridge with the .NET Framework compiler already present on Windows.
- `RUN_CSI_BRIDGE.cmd`: convenience runner.
- `../excel-fallback/HnlExcelFallback.ps1`: reads the five DCE-compatible sheets when ETABS/SAP is not open. CSV fallback is handled by `src/csi-live-bridge.js` without Excel.

The bridge must never calculate pile reaction, capacity, utilization, governing combination or pile count.
