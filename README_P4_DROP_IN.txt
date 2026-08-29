HNL P4 PDF/Ảnh → Excel Intelligence · FINAL REPAIR
Primary source basis: HNL_v1.27.0_P4_PDF_EXCEL_INTELLIGENCE_DROP_IN_UPDATE.zip
Original ZIP SHA-256: ae0cff3891336c3611ed6c6e58837ec277a8c19ce43940d9b1bfa0119b5edf1c
Frozen P3.2 baseline: a494ee4a710de3b8e4fbfc48815e3a0039ae577f
Backup before Final Repair: backup/p4-before-final-repair-20260829 @ cc7eb5096fa838a1c915d3327eea248912528bba

P4 stays SHADOW_ONLY. Do not merge PR #4 or main until P4 CI/runtime Golden passes.
UI entrypoints:
- Floating button “PDF → Excel”
- Ctrl+Shift+E
- ?pdfexcel=1
- “Xuất Excel thông minh” in PDF selection popup
- “⇩ Xuất Excel REVIEW” in Image Engineering review card

Safety:
- OCR/Vision readable != VERIFIED.
- P3.2 BENCHMARKED != numeric VERIFIED.
- No Search Brain/Calculation Engine mutation.
- Real Excel formulas require VERIFIED provenance + safe allowlist + resolved input mapping.
