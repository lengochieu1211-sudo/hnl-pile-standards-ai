# HNL Pile Standards AI v1.9.25

## Unified Smart Scope · Formula/Lookup Target Scan · Professional UI

- Tra cứu: Smart / region / current page / page range / current document / selected documents / whole library.
- Formula scan: region / current page (default) / page range / current document / selected documents / whole library.
- OCR/Vision is bounded by the chosen scope and never silently widens it.
- Smart lookup uses exact/RAG first, fresh PDF.js rescue second, then targeted local OCR only when necessary.
- Sidebar wording is now “Nguồn mặc định AI / RAG”; per-tab scope controls are separate and explicit.
- Keeps v1.9.24 single AI status surface, compact Native PDF settings, UI State Guard, Offline AI and archive hardening.
