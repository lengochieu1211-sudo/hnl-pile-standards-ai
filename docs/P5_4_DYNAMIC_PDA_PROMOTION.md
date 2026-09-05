# P5.4 Dynamic Load / PDA Promotion

Baseline: `main@a4cacdaafda8c4b3c2b7a5d5921c03092a6e3320`.

## Dynamic test CT (22)–(24)

The existing deterministic implementation in `src/tcvn10304-advanced.js` is preserved. P5.4 promotes it through an independent Golden gate rather than rewriting certified formulas.

- `s_a >= 0.002 m` -> CT (22).
- `s_a < 0.002 m` -> CT (23), with theta from CT (24) or an explicitly supplied theta.
- Table 12 coefficient `M` is never invented or interpolated automatically; it must be supplied from an applicable table lookup/source.
- Missing CT (24) geometry is a REVIEW/missing-input condition, not a guessed value.
- Provenance remains TCVN 10304:2025 section 7.3.3.2, CT (22)–(24), Tables 11–14.

## PDA / HSDT safety boundary

PDA/HSDT is not silently treated as the residual-set CT (22)–(24) calculation merely because it is a dynamic test. P5.4 adds an isolation Golden guard: a query containing only PDA/HSDT must not be falsely routed through the CT22–24 residual-set workflow. Numeric PDA/HSDT results require the applicable test report / evaluated test output and its own provenance; HNL must not fabricate a closed-form substitute.

## Golden contract

Six additive tests cover the CT22 boundary, a representative CT22 result, mandatory Table 12 `M`, explicit-theta CT23, missing CT24 geometry, and PDA/HSDT isolation. Exact suite contract becomes 625 = 574 baseline + 18 P4 + 13 SPT + 8 CPT + 6 Static + 6 Dynamic/PDA.
