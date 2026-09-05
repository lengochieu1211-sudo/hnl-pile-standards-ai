# P5.3 Static Load Golden Cases

1. Direct CT20: `Ru,k=1200 kN`, `gamma_c=1`, `gamma_cg1=1` -> `Rk=1200 kN`.
2. Weak soil: `IL=0.7`, `su,mt=100 mm`; target settlement `20 mm`; measured point `1000 kN @ 20 mm` -> `Ru,k=1000 kN`.
3. Stiffer soil: `IL=0.2`, `su,mt=60 mm`; target settlement `21 mm`; interpolate between `1000 kN @ 20 mm` and `1200 kN @ 30 mm` -> `Ru,k=1020 kN`.
4. Settlement cap: `IL=0.2`, `su,mt=200 mm`; computed `70 mm`, capped to `40 mm`; measured `1500 kN @ 40 mm` -> `Ru,k=1500 kN`.
5. Out-of-range target -> REVIEW; no extrapolation.
6. Excel/export payload only opens after deterministic successful result.
