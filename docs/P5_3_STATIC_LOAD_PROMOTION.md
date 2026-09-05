# P5.3 Static Load Test Promotion

Baseline: `main@05917f4b8e8c204ee1a6521dec962b10917200d8`.

Scope:
- Preserve direct `Ru,k` path using TCVN 10304:2025 CT (20).
- Add deterministic CT (21) derivation from a measured load-settlement curve.
- Determine target settlement as `s = min(zeta * su,mt, 40 mm)`.
- Default `zeta = 0.2` when `IL > 0.5`, otherwise `zeta = 0.35`, unless zeta is explicitly supplied.
- Use exact measured point when available; otherwise linear interpolation only between measured points.
- Refuse extrapolation and return REVIEW when the target settlement is outside the measured curve or required data are insufficient.
- Keep Search Brain 1.9.23 locked.

Certification contract:
- P5.3 focused Golden: 6 tests.
- Exact total regression count: 619 = 574 baseline + 18 P4 + 13 SPT + 8 CPT + 6 Static Load.
- Source-sync and release-sync fingerprints updated for the certified router/test/gates.
