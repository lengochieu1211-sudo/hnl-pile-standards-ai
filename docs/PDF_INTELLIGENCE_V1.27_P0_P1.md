# HNL v1.27.0 — PDF Intelligence Engine — P0/P1 Shadow

## Safety boundary

This package is an **experimental shadow track**. It does not replace `src/pdf.js`, does not change `src/ingest.js`, does not import into `src/main.js`, and does not touch `src/search.js`.

Therefore:
- v1.26 production PDF behavior remains authoritative.
- Search Brain v1.9.23 remains locked.
- The exact 574 regression suite is not changed by this package.
- No OCR runtime/model is bundled in P0/P1.
- No Firecrawl source code is copied into HNL.

## Why Firecrawl pdf-inspector is being evaluated

The external MIT-licensed `firecrawl/pdf-inspector` project exposes PDF classification, position/layout-aware extraction, structured Markdown, per-page OCR routing, and (native Node) region extraction. HNL evaluates it as an optional ingestion adapter, not as a standards authority and not as a calculation engine.

Normative hierarchy remains:

`TCVN PDF → HNL deterministic Calculation Engine → Golden → reference evidence`

## Files

- `src/pdf-intelligence/contracts.js` — stable HNL-side result/provenance contract.
- `src/pdf-intelligence/firecrawl-adapter.js` — optional lazy adapter for Node/WASM packages.
- `src/pdf-intelligence/router.js` — OFF/SHADOW router; never mutates Production doc.
- `src/pdf-intelligence/hnl-pdfjs-baseline.js` — Node benchmark mirror of current PDF.js text-quality logic.
- `scripts/pdf-intelligence-selftest.mjs` — isolated selftest, deliberately outside `tests/*.test.mjs`.
- `scripts/pdf-intelligence-benchmark.mjs` — corpus benchmark/report generator.

## Mode

Default: `off`.

Only allowed experimental mode in P0/P1: `shadow`.

Any unknown value, including `production`, resolves back to `off`.

## Optional dependencies

P0/P1 does not change `package.json` or `package-lock.json`. The adapter reports `DEPENDENCY_NOT_INSTALLED` when the optional package is absent. This is intentional: current v1.26 release certification must not be destabilized by a new native dependency.

When a dedicated v1.27 branch is ready for dependency certification, install and lock the official packages there:

- Node/Desktop: `@firecrawl/pdf-inspector`
- Browser experiment: `@firecrawl/pdf-inspector-wasm`

Then regenerate the lock file and run Windows + Web build certification before promotion.

## Benchmark

Examples:

```bash
node scripts/pdf-intelligence-selftest.mjs
node scripts/pdf-intelligence-benchmark.mjs --dir ./benchmark-pdfs --probe "cọc chống" --probe "TCVN 10304:2025"
```

Report:

`artifacts/pdf-intelligence/p0-benchmark.json`

Per PDF it records:
- SHA-256 and byte size
- page count
- HNL-derived PDF type and pages needing OCR
- Firecrawl PDF type/confidence/pages needing OCR
- extraction size and elapsed time
- probe phrase coverage
- classification/page-count comparison

The report never claims Production PASS by itself.

## P0 promotion criteria

Do not promote Firecrawl to default until all are true:

1. Real HNL corpus has at least 6 PDFs and at least 2 PDF classes.
2. 100% page-count agreement for measured documents.
3. Golden phrase retrieval does not regress (`cọc chống` plus standards-specific probes).
4. Tables/formulas/clauses are manually reviewed on representative pages.
5. Mixed/scanned documents route only deficient pages/regions to OCR.
6. Web WASM build and Windows native build both pass.
7. Search Brain hash remains locked.
8. Existing Calculation/Excel Golden gates remain unchanged and green.

## Next passes after P0 evidence

- P2: structured page/text/bbox/table document model.
- P3: selective OCR page/region adapter.
- P4: Markdown → Điều/Bảng/Công thức chunks.
- P5: provenance `file → page → bbox → Điều/Bảng/Công thức`.
- P6: PDF Golden corpus: text/scan/mixed/font-broken/table/multi-column.
- P7: Web Worker WASM + Windows native certification.
- P8: controlled promotion only if benchmark and Golden prove superiority.

## DeepDoc/VietOCR parallel shadow track

P0/P2 also evaluates an external `deepdoc_vietocr` clone for Vietnamese OCR, layout and table structure. See `PDF_INTELLIGENCE_V1.27_DEEPDOC_VIETOCR.md`. It is Node/Desktop-only, optional, default OFF, and does not bundle third-party source/models.
