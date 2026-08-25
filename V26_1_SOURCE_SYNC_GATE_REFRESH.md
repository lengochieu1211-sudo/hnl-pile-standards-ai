# V26.1 – Source Sync Gate Refresh

PR #2 failed only at `Pass 8.3 Source sync gate` because Pass 8.3 still pinned SHA-256 values from the pre-V26 release for three files intentionally modified by V26:

- `src/pile-workflows.js`
- `src/excel-export.js`
- `src/main.js`

The dedicated V26 workflow already certified the V26 changes on Linux and Windows. This patch updates only those three expected hashes. It does **not** change Calculation Engine logic, Search Brain, PDF, AI, normative table sources, or the 574-test baseline.

Keep the following locks unchanged:

- `src/search.js` = `f9b65e5e6fb61dcca233a4fe43950e3174c73536f2fa83452da3041fbd0021d2`
- `src/pdf.js` = `5f9dd85f1c932b49f82def27d0c8c4002825a917c490ff11b3922ff5555b11a3`
- `src/ai.js` = `711f9dbe5e2c2e4255a980b8b59fa3fc4b801fad78e5e5dd1b7cd223538a7f11`

Apply this file on the existing branch `p1/v26-ai-input-interpreter`, commit and push. PR #2 checks will rerun automatically.
