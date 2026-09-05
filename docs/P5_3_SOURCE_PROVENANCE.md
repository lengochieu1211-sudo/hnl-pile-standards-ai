# P5.3 Source Provenance

Normative workflow reference: TCVN 10304:2025, section 7.3.2.1–7.3.2.3, formulas (20) and (21), pages 49–50 in the project reference corpus.

Project corpus cross-check used during P5.3 records the static-test logic as:
- `Rk = gamma_c * Ru,k / gamma_c,g1`;
- for a load-settlement curve, take `Ru` at `s = zeta * su,mt`;
- use `zeta=0.2` for weak soil with `IL>0.5`, `zeta=0.35` otherwise;
- settlement criterion is limited to 40 mm.

Implementation safety decision: interpolate only inside the measured curve. No extrapolation is performed; insufficient/out-of-range input is returned as REVIEW.
