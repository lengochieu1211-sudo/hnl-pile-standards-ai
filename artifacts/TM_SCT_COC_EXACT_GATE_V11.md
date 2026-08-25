# TM SCT Coc Exact Inventory / Fingerprinting / Golden — v11

Exact inventory and shared-formula expansion are complete.

- Formula cells: 6,082
- Shared formula groups: 104
- Shared followers expanded: 5,918
- Unique normalized fingerprints: 22
- All 6,082 formula cells mapped:
  - JOIN: 2078
  - ACTION: 1
  - CAPACITY: 39
  - UTILIZATION: 19
  - STATUS: 3945

Exact numeric semantics:
- F = Nd Max, positive compression demand already prepared before this sheet.
- G = Nd Min, carried but not used by K/L/M compression check.
- I = Rd lookup.
- H10 = gammaN from consequence class.
- K = I/H10 = design capacity.
- L = K/F = reserve factor (not utilization).
- utilization = F/K = 1/L.
- M = IF(L<1,"NOT OK","OK").
- V:Y = utilization bands.
- N/O = point-coordinate lookup; Z/AA = normalized coordinates.

Golden:
- XLSM cached vs independent reconstruction: 304/304 PASS.
- Engine exact-row benchmark: 19/19 PASS.
- Full Pass 4 Node tests: 70/70 PASS.
- Excel v11 formula-error scan: PASS.

Important correction to prior audit:
`NhomCoc` is a VBA UDF. There are 19 calls in TM SCT Coc.
Observed dataset only covers group=1 -> "Đài 1 cọc".
It does not affect the observed K/L/M numeric capacity check.

Decision:
- Numeric imported-compression core: LOCK CANDIDATE.
- Full TM SCT Coc exact equivalence: remains REVIEW until NhomCoc unseen-group behavior is reverse-engineered or formally isolated/replaced as non-numeric presentation logic.
