import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { solveEngineeringQuestion, engineeringExcelPayload, canExportEngineeringResult } from '../src/engineering-router.js';
import { latexReadableHtml, richTextHtml } from '../src/math-render.js';
import { extractEngineeringNumber } from '../src/engineering-text-normalizer.js';

const css=fs.readFileSync(new URL('../src/styles.css',import.meta.url),'utf8');

test('v1.25.7 recognizes sigma_cu copied from normalized PDF/Word text',()=>{
  const q='Cọc PHC D600-B, L=20 m; sigma_cu = 80 MPa.';
  const solved=solveEngineeringQuestion(q);
  assert.equal(solved.workflow?.id,'7888-material');
  assert.equal(solved.result?.inputs?.sigmaCu,80);
  assert.ok(!String((solved.result?.missing||[]).join('|')).includes('σcu'));
});

test('v1.25.7 recognizes unicode/latex concrete strength aliases',()=>{
  for(const q of [String.raw`Cọc PHC D600-B, L=20 m; $\sigma_{cu}=80\,\text{MPa}$.`,'Cọc PHC D600-B, L=20 m; cường độ nén bê tông = 80 MPa.']){
    const solved=solveEngineeringQuestion(q);
    assert.equal(solved.result?.inputs?.sigmaCu,80);
  }
});

test('v1.25.7 math renderer recovers stripped command tokens',()=>{
  const html=latexReadableHtml('RaL = left(fracsigma_cu3,5 - fracsigma_ce4) times A_0 approx 3003 kN');
  const visible=html.replace(/<[^>]+>/g,'');
  assert.doesNotMatch(visible,/\b(?:frac|sigma|left|right|times|approx)\b/i);
  assert.match(visible,/σ|≈|×/);
});

test('v1.25.7 narrow assistant uses responsive soil cards and hides assistant horizontal overflow',()=>{
  assert.match(css,/@container assistant \(max-width:520px\)/);
  assert.match(css,/grid-template-areas:\s*"idx from to"/);
  assert.match(css,/\.soil-layer-list\{[^}]*overflow-x:hidden!important/);
  assert.match(css,/\.panel-body \{ overflow-x:hidden; \}/);
  assert.match(css,/\.calc-detail-table thead\{display:none\}/);
  assert.match(css,/@container assistant \(max-width:380px\)/);
});


test('v1.25.7 TEST CASE 4 recognizes complete driven pile input and enables Excel',()=>{
  const q='Kiểm tra tính toán Cọc đóng ngàm vào đá. Cọc vuông 400 x 400 mm, dài 12 m, đóng bằng búa diesel; gamma_c=1; gamma_RR=1; gamma_Rf=1; gamma_n=1,15. Lớp 1: 0-3 m sét IL=0,7; lớp 2: 3-8 m sét IL=0,5; lớp 3: 8-15 m sét IL=0,3.';
  const payload=engineeringExcelPayload(q);
  assert.equal(payload.recognized,true);
  assert.equal(payload.workflow?.id,'10304-driven');
  assert.equal(payload.result?.ok,true);
  assert.equal(payload.canExport,true);
  assert.equal(canExportEngineeringResult(payload),true);
  assert.ok(Math.abs(Number(payload.input?.areaM2)-0.16)<1e-12 || Math.abs(Number(payload.result?.geometry?.areaM2)-0.16)<1e-12);
  assert.ok(!String((payload.result?.missing||[]).join('|')).trim());
});


test('v1.25.7 recognizes decorated aliases such as (q_b): value and does not ask again',()=>{
  assert.equal(extractEngineeringNumber('Kết quả đối chiếu từ phần mềm cũ: (q_b): 31468,0 kPa',['q_b','qb'],'kPa'),31468);
  const q='Kiểm tra tính toán Cọc chống ngàm vào đá. Cọc khoan nhồi đường kính D = 1000 mm, chiều sâu ngàm thực tế vào đá L_d = 1,5 m. Địa chất: Đá cát kết có cường độ nén một trục mẫu bão hòa R_c,n = 35 MPa, chỉ số chất lượng đá RQD = 82%. Kết quả đối chiếu từ phần mềm cũ: hệ số nứt nẻ K_s = 0,7867; Cường độ sức kháng mũi thiết kế (q_b): 31468,0 kPa; gamma_c = 1,4; gamma_n = 1,15.';
  const payload=engineeringExcelPayload(q);
  assert.equal(payload.recognized,true);
  assert.equal(payload.workflow?.id,'10304-end-bearing');
  assert.equal(payload.result?.ok,true);
  assert.equal(payload.canExport,false);
  // P0 Pass 2: the pasted old-software q_b is comparison-only. HNL independently
  // computes Bảng 1 + CT (7)/(8), then enforces the 20 000 kPa cap.
  assert.equal(payload.result?.inputs?.legacyComparisonIgnored,true);
  assert.ok(Math.abs(payload.result?.Ks-0.7866666666666666)<1e-12);
  assert.equal(payload.result?.qbKpa,20000);
  assert.equal(payload.result?.status,'VERIFIED_PRELIMINARY');
  assert.ok(!String((payload.result?.missing||[]).join('|')).includes('q_b'));
});


test('v1.25.7 exact pasted TEST CASE 4 routes, parses prose layers, and derives Nd,max',()=>{
  const q='TEST CASE 4: Cọc vuông 400x400 - Nội suy chi tiết phân tầng ma sát hông Đất Sét. Cọc vuông BTCT 400 x 400 mm, dài L = 12 m đóng bằng búa diesel. Tiết diện mũi: A_p = 0,16 m2, chu vi u = 1,6 m. Lớp 1: Từ 0 m đến 3 m (dày 3m), đất Sét có I_L = 0,7. Lớp 2: Từ 3 m đến 8 m (dày 5m), đất Sét có I_L = 0,5. Lớp 3: Từ 8 m đến 15 m (dày 7m), đất Sét có I_L = 0,3. Hệ số an toàn: gamma_k = 1,4 và gamma_n = 1,15.';
  const payload=engineeringExcelPayload(q);
  assert.equal(payload.recognized,true);
  assert.equal(payload.workflow?.id,'10304-driven');
  assert.equal(payload.input?.method,'hammer');
  assert.equal(payload.input?.lengthM,12);
  assert.equal(payload.input?.tipDepthM,12);
  assert.equal(payload.input?.layers?.length,3);
  assert.deepEqual(payload.input.layers.map(x=>[x.top,x.bottom,x.IL]),[[0,3,.7],[3,8,.5],[8,15,.3]]);
  assert.ok(Math.abs(payload.input.areaM2-.16)<1e-12);
  assert.ok(Math.abs(payload.input.perimeterM-1.6)<1e-12);
  assert.equal(payload.input.gammaK,1.4);
  assert.equal(payload.input.gammaN,1.15);
  assert.equal(payload.result?.ok,true);
  assert.equal(payload.result?.segmentResults?.length,7);
  assert.ok(payload.result.segmentResults.every(x=>x.hM<=2+1e-12));
  assert.equal(payload.canExport,true);
  assert.ok(Number.isFinite(payload.result?.RdKn));
  assert.ok(Number.isFinite(payload.result?.NdMaxKn));
  assert.ok(Math.abs(payload.result.NdMaxKn-(payload.result.RdKn/1.15))<1e-9);
});

test('v1.25.7 driven Excel includes gamma_n and formula-only Nd,max output',()=>{
  const excel=fs.readFileSync(new URL('../src/excel-export.js',import.meta.url),'utf8');
  assert.match(excel,/\['gamma_n'.*Nd,max=Rd\/γn/);
  assert.match(excel,/\['N_d,max',\{formula:`IF\(ISNUMBER\('01_INPUT'!B13\),B10\/'01_INPUT'!B13/);
  assert.match(excel,/\['Nd,max',\{formula:`'05_CALC_10304'!B11`\}/);
});

test('v1.25.7 bare pasted LaTeX formulas render without command-word leakage',()=>{
  const cases=[
    String.raw`\frac{R_k}{\gamma_k}`,
    String.raw`\gamma_n N_d \le R_d`,
    String.raw`\sigma_{cu}=80\ \text{MPa}`,
    String.raw`\sum f_i h_i`,
    String.raw`\boxed{R_d=R_k/\gamma_k}`,
    'RaL = left(fracsigmacu3,5) times A_0 approx 3003 kN'
  ];
  for(const raw of cases){
    const html=richTextHtml(raw);
    const visible=html.replace(/<[^>]+>/g,' ');
    assert.doesNotMatch(visible,/\\(?:frac|sigma|gamma|left|right|times|approx|boxed)|\b(?:frac|left|right|times|approx|boxed)\b/i,raw);
  }
  assert.match(richTextHtml(String.raw`\gamma_n N_d \le R_d`),/γ<sub>n<\/sub> N<sub>d<\/sub> ≤ R<sub>d<\/sub>/);
  assert.match(richTextHtml(String.raw`\frac{R_k}{\gamma_k}`),/math-frac/);
  assert.match(richTextHtml(String.raw`\sigma_{cu}=80\ \text{MPa}`),/σ<sub>cu<\/sub>=80 MPa/);
});

test('v1.25.7 methodOnly flag never bypasses missing-input export gate',()=>{
  const incomplete=engineeringExcelPayload('móng bè-cọc IL=0.4');
  assert.equal(incomplete.workflow?.id,'10304-piled-raft');
  assert.equal(incomplete.result?.ok,false);
  assert.equal(incomplete.result?.methodOnly,true);
  assert.equal(incomplete.canExport,false);
  const complete=engineeringExcelPayload('móng bè-cọc IL=0.4 E=10 MPa loose_sand=0.5 m');
  assert.equal(complete.result?.ok,true);
  assert.equal(complete.result?.methodOnly,true);
  assert.equal(complete.canExport,true);
});

test('v1.25.7 visible textarea keeps raw LaTeX while parser uses normalizedQuestion',()=>{
  const main=fs.readFileSync(new URL('../src/main.js',import.meta.url),'utf8');
  assert.match(main,/setRangeText\(pasted,start,end,'end'\)/);
  assert.match(main,/const normalized=normalizeEngineeringPaste\(pasted\)/);
  assert.match(main,/const normalizedQuestion=normalizeEngineeringText\(question\)/);
  assert.doesNotMatch(main,/setRangeText\(normalized,start,end,'end'\)/);
});
