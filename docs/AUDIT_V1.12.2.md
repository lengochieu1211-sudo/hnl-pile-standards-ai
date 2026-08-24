# HNL Pile Standards AI v1.12.2 — Math Renderer Audit

## Root cause
AI providers can return mixed LaTeX delimiters such as `\[ ... $$` or `$$ ... \]`. The previous rich-text renderer only handled headings/lists/code and therefore displayed raw LaTeX markers and escaped subscripts such as `R\_k`, `\gamma\_c`.

## Fix
- Normalize `\[` and `\]` to the same display-math delimiter before parsing.
- Parse display math before normal paragraph rendering.
- Add offline-safe engineering math rendering for Greek symbols, subscripts/superscripts, sum/product, multiply/dot, inequalities, fractions and square roots.
- Add inline math support for `\( ... \)`.
- Add prompt guardrail requiring `$$ ... $$` for display math and `\( ... \)` for inline math; explicitly forbid mixed delimiters.
- No CDN dependency, so rendering works in Web and Windows Offline mode.
- `src/search.js` was not changed.

## Verification
- `npm test`: 155/155 PASS.
- Version Gate: PASS v1.12.2.
- Search Brain Guard: PASS, normalized SHA-256 `f9b65e5e6fb61dcca233a4fe43950e3174c73536f2fa83452da3041fbd0021d2`.
- `node --check src/main.js`: PASS.
- `npm run build:web`: NOT RUN TO COMPLETION in this sandbox because the Vite executable is not installed (`vite: not found`). Do not report build PASS.

## Target regression example
Input from provider:
`\[ R\_k = \gamma\_c \left( \gamma\_{R,R} \cdot q\_b \cdot A + u \cdot \sum \gamma\_{R,f} \cdot f\_i \cdot h\_i \right)$$`

Expected UI:
`Rₖ = γc (γR,R · qb · A + u · ∑ γR,f · fi · hi)` with formatted subscripts and no raw `\[`, `$$`, `\gamma`, or `\_` markers.
