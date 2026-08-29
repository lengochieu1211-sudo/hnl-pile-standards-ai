# HNL Pile Standards AI — P4 Pass 0+1+2 Source Audit + Gap Matrix

Frozen baseline: `a494ee4a710de3b8e4fbfc48815e3a0039ae577f`

## Existing foundation kept intact

- `src/excel-export.js`: Production Excel foundation already supports formula cells, workbook recalculation, provenance sheets, dropdowns, source/status columns and safe formula concepts.
- `src/image-engineering.js`: Vision/OCR extracts candidate facts only; user confirmation is required before engineering calculation use.
- `src/main.js`: real PDF region selection already exposes text/page/bbox/method/source image via the selection popup; Pass 1 reuses that public DOM surface without modifying `main.js`.
- P3.2 final evidence: 9/9 BENCHMARKED, 11 runs, real PDF page/bbox/engine provenance and frozen `sourceSha` available.
- Search Brain `src/search.js` v1.9.23 and Calculation Engine are intentionally untouched.

## P4 gaps and actions

| Gap | Frozen baseline | P4 Pass 0+1 action |
|---|---|---|
| Unified PDF/Image extraction contract | Separate PDF/image flows | Add `P4 ExtractionPacket` with file → page → bbox → engine → state/confidence |
| OCR-readable vs VERIFIED barrier | Image flow has confirmation rule, not unified for PDF→Excel | Add explicit `calculationEligible` barrier; BENCHMARKED/OCR remain REVIEW unless the required verification/confirmation exists |
| PDF text/region → Excel UI | Region popup had copy/AI/search/formula actions but no Excel intelligence action | Add isolated `p4-pdf-excel-ui.js`, button `XL` and `Xuất Excel thông minh`; reuse exact `_hnlSource` provenance |
| Ảnh extraction → Excel REVIEW | Existing Image Engineering had Vision/OCR → review → confirm → calculation, but no P4 extraction workbook before calculation | Pass 2 adds `⇩ Xuất Excel REVIEW` directly in the existing review card, preserving extracted fields, confidence, source image and REVIEW state; it does not confirm or calculate |
| Table → Excel cells | Existing exporters know standard tables, not arbitrary selected PDF/image tables | Add structured table model + conservative delimited-text detector |
| Formula → real Excel formula | Existing formula export foundation exists | Add strict safe compiler: VERIFIED source + allowlist + all variable mappings; otherwise preview/REVIEW only |
| Repeated symbols a,b by context | No unified P4 context model | Add `contextId` and clarification questions when the same symbol is genuinely ambiguous |
| PDF plain text → Excel | No general selected-PDF text export | Add `07_VAN_BAN_NGUON` sheet |
| Figures/source image | Image provenance exists | Add figure metadata and optional embedded source image support |
| Self-contained provenance | P3.2 final JSON has sourceSha | Carry `sourceSha`, fingerprint, page, bbox and engine into `01_NGUON` |
| Low confidence | Separate behaviors | Centralize REVIEW/BLOCK status; no fabricated confidence |
| Calculation Engine mutation | Risk if extraction is treated as input | P4 modules import no Search Brain/Calculation Engine and expose an explicit assertion barrier |

## Current certification boundary

**Implemented:** P4 Pass 0 contract/safety/compiler/Excel plan + Pass 1 real PDF text/region UI adapter + Pass 2 Image Engineering review → P4 Excel adapter.

**Not yet certified:** repository ExcelJS runtime of `exportP4ExcelWorkbook()`, full Vite build/full existing regression suite after applying this drop-in, full repository runtime/Vite certification and post-confirmation Image Engineering → P4 workbook handoff after the deterministic engineering answer. Therefore this package is **SHADOW_ONLY / IMPLEMENTED, NOT VERIFIED/PROMOTED**.
