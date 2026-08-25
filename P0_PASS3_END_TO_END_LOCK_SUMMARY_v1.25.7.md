# P0 PASS 3 — HNL v1.25.7

- Regression: 328/328 PASS.
- Full Table Golden: 1242/1242 PASS.
- Workflow Golden: 3/3 workflows PASS; 35/35 metrics PASS; 5/5 XLSM traceable benchmarks PASS; 5/5 boundary PASS.
- New Formula-Only Excel raw workflows: Rock / §7.2.3 Bored / SPT.
- DCE XLL is REFERENCE only; no Production dependency.
- Search Brain unchanged: `f9b65e5e6fb61dcca233a4fe43950e3174c73536f2fa83452da3041fbd0021d2`.
- Local `npm ci`, ExcelJS smoke, web build remain blocked because the source ZIP does not carry `package-lock.json` / installed dependencies.
- CI is wired to run workflow Golden + ExcelJS smoke + Windows Excel COM recalculation checks when environment supports them.

Chi tiết: `docs/P0_PASS3_END_TO_END_LOCK_V1.25.7.md`.
