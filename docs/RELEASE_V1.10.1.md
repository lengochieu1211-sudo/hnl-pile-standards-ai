# HNL Pile Standards AI v1.10.1 — Calculation Integrity · Unit-safe Formula · NPH Logic Audit

- Unit-safe verified formulas: B.1–B.5 convert N → kN when variables are MPa/mm².
- PC / PHC / NPH are separated; NPH is restricted to A/B/C and Bảng 1 autofill is blocked for NPH.
- Calculation history stores document/source page/formula/table metadata.
- Stable v1.9.23 search brain remains unchanged.
- Version/service-worker checks and direct dependency pinning are hardened.
- AI/Vision formula calculation is hard-gated by `verified=true`; legacy/imported `allowCompute` cannot bypass source verification.
