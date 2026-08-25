import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const router=fs.readFileSync('src/pass8-workflow-router.js','utf8');
const exporter=fs.readFileSync('src/pass8-excel-export-client.js','utf8');
test('Pass8 router imports only Pass7 calculation entrypoint',()=>{
  const imports=[...router.matchAll(/from\s+['"]([^'"]+)['"]/g)].map(m=>m[1]);
  assert.deepEqual(imports,['./pass7-full-calculation-workflow.js']);
});
test('Pass8 router does not call lower engineering engines directly',()=>{
  assert.doesNotMatch(router,/calculateMultiBoreholePileCapacity|calculateDrivenPile10304|calculateSptPile10304|checkImportedNodalPileReactionEnvelope/);
});
test('Pass8 Excel client is transport-only',()=>{
  assert.doesNotMatch(exporter,/Rsoil|Rmaterial|Rpile|min\(|utilization|capacityKn/);
  assert.match(exporter,/fetchImpl/);
});
