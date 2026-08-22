# HNL Pile Standards AI v1.2 — Button / Interaction Audit

## Video review
The supplied screen recording shows the PDF and some calculation/checklist actions rendering, but several controls can look like they did nothing because the old UI had weak or no feedback for blank input, unchanged results, or results rendered outside the visible area.

## Structural fix
v1.2 replaces per-render element listeners with event delegation on the stable `#app` root. The application rebuilds large parts of the DOM with `innerHTML`; delegated events are safer for buttons/citations/results created after each render.

## Controls audited
- Upload one/multiple PDF
- Open / select / delete PDF
- Select all / clear source selection
- Previous/next/page number
- Zoom in/out/fit
- Tabs and mobile navigation
- Create summary
- Suggested questions
- Chat Send
- Search PDF
- TCVN 7888 quick table
- Load calculator values from Table 1
- Calculate material axial resistance
- Compare selected PDFs
- Checklist check/uncheck
- Copy / reset checklist
- Extract checklist from PDF / AI
- Source citations / open source / jump to page
- Provider selection
- Direct / Bridge connection selection
- Save settings
- Test connection
- Diagnostics

## UX fixes
- `Enter` sends chat; `Shift+Enter` inserts a new line.
- Suggested question buttons now execute the question instead of only filling the textbox.
- Blank Chat/Search/Compare actions show an explicit warning instead of silently doing nothing.
- Quick table shows a success status after lookup.
- Calculator shows completion feedback and scrolls the result into view.
- Compare shows success/error feedback.
- Checklist copy has a fallback when Clipboard API is unavailable.
- Draft chat/search/compare text survives UI re-rendering.
- Settings form drafts survive Direct/Bridge UI switching.
- Buttons have visible pressed/focus/hover states.

## Verification
- `node --check` passed for application JavaScript.
- 11/11 Node tests passed, including delegated button wiring, dynamic source navigation, checklist controls, chat Enter-to-send, citations, TCVN 7888 table logic, calculator logic, local search, and service-worker cache version.
- Local Vite production build was not run in the sandbox because npm dependencies could not be downloaded in this environment. The previous GitHub Actions run already proved the project dependency/build pipeline works; GitHub Actions should run `npm install` and `npm run build` after this source is pushed.
