# TM SCT Coc Exact Cell Inventory & Golden v10

## Exact inventory
- Workbook SHA-256: ec38b68f753b08e50d9d1f9df988be5084cab1aedf391ba1aaecf112e9d88bd1
- Sheet: TM SCT Coc
- Formula cells: 6,082
- Shared formula groups: 104
- Shared followers expanded: 5,918
- Unique normalized fingerprints: 22

## Exact block population
- JOIN: 2079
- ACTION: 1
- CAPACITY: 38
- UTILIZATION: 19
- STATUS: 3945
Total: 6082

## Numeric semantics
- F = Nd Max input, positive compression demand in TM SCT Coc.
- G = Nd Min input; not used by K/L/M compression check.
- I = pile Rd lookup.
- H10 = gammaN = 1 / 1.15 / 1.2 by consequence class.
- K = I/H10 = design capacity.
- L = K/F = reserve factor / FS.
- utilization = F/K = 1/L.
- M = IF(L<1, "NOT OK", "OK").
- V:Y categorize utilization into 0-0.5, 0.5-0.8, 0.8-1.0, >1.
- N/O lookup Point Coordinates; Z/AA normalize coordinates from origin N17/O17.

## Golden
- 19 pile rows.
- XLSM cached vs independent formula reconstruction: 304/304 PASS.
- Engine exact-row tests: 19/19 PASS.
- Full Pass 4 Node tests: 70/70 PASS.
- Excel v10 contains live formula reconstruction for K/FS/util/status/coordinates.

## Remaining blocker
`NhomCoc` is a VBA UDF:
- 19 calls in TM SCT Coc;
- vbaProject.bin exists;
- observed workbook dataset only exercises group=1 and cached output `Đài 1 cọc`;
- behavior for unseen group values is not proven.

This UDF does not participate in K/L/M numeric capacity check for the observed 19 rows, but exact workbook equivalence for group-label generation remains REVIEW.

## Lock decision
P1 Pass 4 numeric imported-compression check is now strongly benchmarked, but **full TM SCT Coc exact equivalence is not yet LOCKED** until NhomCoc is reverse-engineered or explicitly isolated as non-numeric presentation-only behavior with a locked replacement contract.
