# P1 Pass 8.3 – GitHub CI / Production Runtime Certification v22

Target branch: `p1/pass8.3-runtime-cert-v21`
Base main observed: `0e956d36cbb63c45c24978993bf50da68d43d883` (2026-08-24).

## Required certification chain

1. `npm ci`
2. `npm test` (expected full v21/v22 suite: 574 tests before CI-only additions)
3. Golden gates: Full Table / Workflow / Material / DCE UDF / SPT / Material E2E / Multi-Borehole
4. Pass 8.2 production UI E2E
5. `npm run build:web` (Vite)
6. Windows runner: `npm ci` → tests → `npm run build:desktop` → electron-builder NSIS + Portable
7. Verify at least 2 EXEs and upload artifacts
8. Merge to `main` only when both Linux and Windows jobs are green.

## Safety invariants

- Do not alter `src/search.js`, `src/pdf.js`, or `src/ai.js` during Pass 8.3.
- Do not bypass `npm ci` or replace the lock file with `npm install` in certification.
- Do not merge if Linux or Windows job is red/cancelled.
- Live ETABS/SAP CSi certification remains a separate deferred gate.

## Current connector limitation

The GitHub App returned HTTP 403 `Resource not accessible by integration` when asked to create the certification branch. Therefore this package is CI-ready but has not been pushed by ChatGPT. Push it through GitHub Desktop/CLI after creating the branch, or reconnect GitHub with repository Contents/refs write permission.
