#!/usr/bin/env node
// Legacy filename retained only so repositories that already received an earlier
// overwrite do not keep a stale parallel gate. Current gate is release-sync-gate.mjs.
await import('./release-sync-gate.mjs');
