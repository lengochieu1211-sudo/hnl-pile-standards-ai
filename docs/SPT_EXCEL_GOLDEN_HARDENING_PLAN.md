# SPT Excel Golden Hardening

Baseline: main@9856a06fe79df0ee6acefc4d8718a1c3efc1e4c4

Status: IN PROGRESS — do not mark SPT EXCEL GOLDEN PASS until all hardening gates are certified.

Scope derived from the 2026-08-30 user acceptance form:
- geometry source inputs: square/rectangle/circle via b/h/D; A and u derived only for SPT Golden workflows;
- deterministic parser -> normalized schema -> validation -> engine -> result -> explanation -> Excel;
- 8 natural-language parser regressions;
- explicit Rc,k -> Rd -> Nd,max output chain;
- qb/fs cap parity;
- formula-only Excel with live recalculation;
- Web ↔ Excel ↔ Golden parity;
- provenance and SI unit audit;
- multi-layer SPT Golden after summary workflow hardening.

Safety locks:
- Search Brain v1.9.23 remains LOCKED.
- P4 core remains SHADOW_ONLY.
- No AI-owned numerical result.
- No Golden hard-coded output values in production calculation chain.
- Existing TCVN 10304:2025 Appendix D qb/fs coefficients and caps remain owned by the LOCKED table engine.
