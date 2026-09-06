# P5.6 Screw Pile Promotion Evidence

Baseline: `main@3a0efb2879be77013116399be0347a4be9fcfcc8`.

## Normative scope
- TCVN 10304:2025, 7.2.4, CT (17)–(19), printed pages 43–44.
- Table 9, printed page 43: pile working-condition coefficient `γc` by soil state and compression/tension/reversal load.
- Table 10, printed page 45: `α1`, `α2` versus design internal-friction angle `φ1`.
- Note 2, printed page 44: helix depth at least `5d` in clay and `6d` in sand.
- Formula scope on page 43: one helix, `d ≤ 1.2 m`, `L ≤ 10 m`; other geometries, lateral load or moment require test/calibrated soil-model evidence.

## P5.6 safety policy
- Production numeric is unlocked only when Table 9 and Table 10 are deterministically resolved and all applicability guards pass.
- No interpolation of Table 10 is enabled in P5.6 because an interpolation rule has not been independently certified here. Off-node `φ1` returns REVIEW.
- Manual `α1/α2/γc` remains available only as MIXED/MANUAL reference and is blocked from Production export.
- `γR,R = γR,f = 1.0` follows 7.2.4 for the general case; pilot-bore construction is blocked unless the Table 4 coefficients are provided/verified.
- Search Brain is unchanged.
