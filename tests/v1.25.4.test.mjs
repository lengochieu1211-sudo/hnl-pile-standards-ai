import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { buildFullTableGoldenCases, summarizeFullTableGolden } from '../scripts/full-table-golden.mjs';
import { lookupTable8Qb10304 } from '../src/tcvn10304-table-engine.js';

const close=(a,b,tol=1e-9)=>assert.ok(Math.abs(a-b)<=tol*Math.max(1,Math.abs(a),Math.abs(b)),`${a} != ${b}`);

test('v1.25.4 full table Golden Benchmark is exhaustive enough and all cases pass',()=>{
  const cases=buildFullTableGoldenCases(); const s=summarizeFullTableGolden(cases);
  assert.ok(s.total>=1100,`only ${s.total} cases`);
  assert.equal(s.fail,0);
  for(const t of ['Bảng 2','Bảng 3','Bảng 4','Bảng 6','Bảng 7','Bảng 8','Bảng 12','Bảng 15','Bảng 16','Bảng 17']){
    assert.ok(s.byTable[t]?.cases>0,`${t} missing`); assert.equal(s.byTable[t]?.fail,0,`${t} failed`);
  }
});

test('v1.25.4 Bảng 8 sparse grid no longer rejects valid IL columns because unrelated columns are blank',()=>{
  close(lookupTable8Qb10304({depthM:30,IL:.3}).value,2300);
  close(lookupTable8Qb10304({depthM:35,IL:.35}).value,2450);
  close(lookupTable8Qb10304({depthM:45,IL:.3}).value,3000);
  assert.throws(()=>lookupTable8Qb10304({depthM:35,IL:.55}),/trống|ô|nội suy|bảng/i);
});

test('v1.25.4 golden matrix includes exact midpoint boundary and outside classes',()=>{
  const cases=buildFullTableGoldenCases(); const cats=new Set(cases.map(x=>x.category));
  for(const c of ['EXACT','MID','MID-2D','OUTSIDE']) assert.ok([...cats].some(x=>String(x).includes(c)),`${c} missing`);
});

test('v1.25.4 keeps proven search brain unchanged',()=>{
  const buf=fs.readFileSync(new URL('../src/search.js',import.meta.url));
  const normalized=Buffer.from(buf.toString('utf8').replace(/\r\n/g,'\n'));
  const hash=crypto.createHash('sha256').update(normalized).digest('hex');
  assert.equal(hash,'f9b65e5e6fb61dcca233a4fe43950e3174c73536f2fa83452da3041fbd0021d2');
});
