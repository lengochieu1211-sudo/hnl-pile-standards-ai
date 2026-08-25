# P1 Pass 2 — Multi-Borehole Summary v1.25.7

Implemented `HK1/HK2/HK3… × {Mechanical, SPT} × common Rmaterial` as a deterministic LOCKED batch workflow.

Key behavior:

- one common square pile and one common material branch;
- each borehole independently runs the locked mechanical workflow and locked SPT Appendix D workflow;
- `Rpile(row)=min(Rd(row),Rmaterial)`;
- batch selects `Rpile,min`, adverse borehole, adverse method, `Rd,min`, `Qb,min`, `Qs,min`, and tip soil;
- common material ties do not fabricate an adverse borehole;
- any invalid HK×method row blocks the whole Production batch;
- Formula-Only Excel uses one shared `BATCH_INPUT` for material/gamma_n and live formulas for every branch.

Golden base fixture: 3 boreholes × 2 methods = 6 rows; HK2 mechanical governs at `843.4285714285716 kN`.

Pure-Node gates at implementation close:

- focused Multi-Borehole: 8/8 PASS;
- full regression: 378/378 PASS;
- Full Table Golden: 1242/1242 PASS;
- P0 Workflow: 35/35 intermediate PASS;
- P1 Material: 42/42 Engine ↔ Excel model PASS;
- P1 Material E2E: 20/20 intermediate PASS;
- DCE Behavioral: 213/213 acceptable;
- SPT PDF Decision: 26/26 PASS;
- Multi-Borehole Golden: 42/42 row metrics + 5/5 summary + 5/5 boundary + 3/3 benchmark PASS.

Local dependency gates remain environment-blocked until a valid repository `package-lock.json` and dependencies are available: `npm ci`, ExcelJS runtime smoke, Vite web build. Microsoft Excel COM and Windows packaging require Windows/CI.
