import test from 'node:test';
import assert from 'node:assert/strict';
import { solveEngineeringQuestion, engineeringExcelPayload } from '../src/engineering-router.js';
const close=(a,b,t=1e-9)=>assert.ok(Math.abs(a-b)<=t,`${a} != ${b}`);
const solve=q=>solveEngineeringQuestion(q).result;

test('P5.6 CT17-19 clay-hard compression Table9/Table10 independent Golden',()=>{
  const q='cọc vít một cánh nén đất sét cứng phi1=30deg c1=20kPa gamma1=18kN/m3 h1=6m A=0.5m2 u=0.314m fi=30kPa h=8m d=1m';
  const x=solve(q); assert.equal(x.ok,true); assert.equal(x.status,'VERIFIED'); assert.equal(x.inputs.a1,38); assert.equal(x.inputs.a2,22.5); assert.equal(x.inputs.gammaC,0.8); close(x.RkKn,1328.752); assert.equal(engineeringExcelPayload(q).canExport,true);
});
test('P5.6 CT17-19 sand wet tension Table9/Table10 independent Golden',()=>{
  const q='cọc vít một cánh kéo cát ẩm phi1=24deg c1=0kPa gamma1=18kN/m3 h1=6m A=0.4m2 u=0.314m fi=30kPa h=8m d=1m';
  const x=solve(q); assert.equal(x.ok,true); assert.equal(x.status,'VERIFIED'); assert.equal(x.inputs.a1,18); assert.equal(x.inputs.a2,9.2); assert.equal(x.inputs.gammaC,0.6); close(x.RkKn,278.028);
});
test('P5.6 Table10 does not invent interpolation',()=>{ const x=solve('cọc vít nén đất sét cứng phi1=29deg c1=20kPa gamma1=18kN/m3 h1=6m A=0.5m2 u=0.314m fi=30kPa h=8m d=1m'); assert.equal(x.ok,false); assert.match(x.missing.join(' '),/chưa được VERIFIED nội suy/); });
test('P5.6 clay blade depth guard h1>=5d',()=>{ const x=solve('cọc vít nén đất sét cứng phi1=30deg c1=20kPa gamma1=18kN/m3 h1=4m A=0.5m2 u=0.314m fi=30kPa h=8m d=1m'); assert.equal(x.ok,false); assert.match(x.missing.join(' '),/h1 ≥ 5d/); });
test('P5.6 sand blade depth guard h1>=6d',()=>{ const x=solve('cọc vít nén cát ẩm phi1=30deg c1=0kPa gamma1=18kN/m3 h1=5m A=0.5m2 u=0.314m fi=30kPa h=8m d=1m'); assert.equal(x.ok,false); assert.match(x.missing.join(' '),/h1 ≥ 6d/); });
test('P5.6 diameter applicability d<=1.2m',()=>{ const x=solve('cọc vít nén đất sét cứng phi1=30deg c1=20kPa gamma1=18kN/m3 h1=7m A=0.6m2 u=0.314m fi=30kPa h=8m d=1.3m'); assert.equal(x.ok,false); assert.match(x.missing.join(' '),/d ≤ 1,2/); });
test('P5.6 length applicability L<=10m',()=>{ const x=solve('cọc vít nén đất sét cứng phi1=30deg c1=20kPa gamma1=18kN/m3 h1=6m A=0.5m2 u=0.314m fi=30kPa h=11m d=1m'); assert.equal(x.ok,false); assert.match(x.missing.join(' '),/L ≤ 10/); });
test('P5.6 multiple helix is REVIEW not numeric',()=>{ const x=solve('cọc vít hai cánh nén đất sét cứng phi1=30deg c1=20kPa gamma1=18kN/m3 h1=6m A=0.5m2 u=0.314m fi=30kPa h=8m d=1m'); assert.equal(x.ok,false); assert.match(x.missing.join(' '),/một cánh/); });
test('P5.6 horizontal or moment load is REVIEW',()=>{ const x=solve('cọc vít một cánh lực ngang đất sét cứng phi1=30deg c1=20kPa gamma1=18kN/m3 h1=6m A=0.5m2 u=0.314m fi=30kPa h=8m d=1m'); assert.equal(x.ok,false); assert.match(x.missing.join(' '),/lực ngang/); });
test('P5.6 manual coefficients stay preliminary and cannot export',()=>{
  const q='cọc vít đất sét c1=20kPa gamma1=18kN/m3 h1=6m A=0.5m2 alpha1=38 alpha2=22.5 u=0.314m fi=30kPa h=8m d=1m gamma_c=0.8';
  const x=solve(q); assert.equal(x.ok,true); assert.equal(x.status,'MIXED/MANUAL'); assert.equal(x.designFinal,false); assert.equal(engineeringExcelPayload(q).canExport,false);
});
