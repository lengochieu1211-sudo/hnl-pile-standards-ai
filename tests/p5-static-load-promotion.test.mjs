import test from 'node:test';
import assert from 'node:assert/strict';
import { solveEngineeringQuestion, engineeringExcelPayload } from '../src/engineering-router.js';
const close=(a,b,t=1e-6)=>assert.ok(Math.abs(a-b)<=t,`${a} != ${b}`);

test('P5.3 keeps direct CT20 Ru input unchanged',()=>{ const x=solveEngineeringQuestion('Thử tải tĩnh Ru,k=1200 kN gamma_cg1=1 gamma_c=1'); assert.equal(x.result.ok,true); assert.equal(x.result.staticMode,'DIRECT_RU_CT20'); close(x.result.RkKn,1200); });
test('P5.3 CT21 weak soil IL>0.5 selects zeta 0.2 exact point',()=>{ const x=solveEngineeringQuestion('Thử tải tĩnh IL=0.7 su,mt=100 mm curve 0kN@0mm; 500kN@10mm; 1000kN@20mm; 1300kN@30mm'); assert.equal(x.result.ok,true); assert.equal(x.result.staticMode,'CURVE_CT21'); close(x.result.inputs.zeta,0.2); close(x.result.inputs.targetSettlementMm,20); close(x.result.RkKn,1000); });
test('P5.3 CT21 stiff soil uses zeta 0.35 and linear interpolation',()=>{ const x=solveEngineeringQuestion('Thử tải tĩnh IL=0.2 su,mt=60 mm 0kN@0mm; 1000kN@20mm; 1200kN@30mm'); assert.equal(x.result.ok,true); close(x.result.inputs.targetSettlementMm,21); close(x.result.RkKn,1020); assert.equal(x.result.inputs.interpolation,'LINEAR_INTERPOLATION'); });
test('P5.3 CT21 caps target settlement at 40 mm',()=>{ const x=solveEngineeringQuestion('Thử tải tĩnh IL=0.2 su,mt=200 mm 0kN@0mm; 1000kN@20mm; 1500kN@40mm; 1700kN@50mm'); assert.equal(x.result.ok,true); close(x.result.inputs.targetSettlementMm,40); close(x.result.RkKn,1500); });
test('P5.3 CT21 refuses extrapolation beyond measured curve',()=>{ const x=solveEngineeringQuestion('Thử tải tĩnh IL=0.2 su,mt=100 mm 0kN@0mm; 800kN@20mm; 1000kN@30mm'); assert.equal(x.result.ok,false); assert.equal(x.result.status,'REVIEW'); assert.ok(x.result.missing.some(v=>v.includes('không được ngoại suy'))); });
test('P5.3 static export gate opens only for successful deterministic result',()=>{ const good=engineeringExcelPayload('Thử tải tĩnh IL=0.7 su,mt=100 mm 0kN@0mm; 500kN@10mm; 1000kN@20mm'); assert.equal(good.canExport,true); const bad=engineeringExcelPayload('Thử tải tĩnh IL=0.2 su,mt=100 mm 0kN@0mm; 800kN@20mm'); assert.equal(bad.canExport,false); });
