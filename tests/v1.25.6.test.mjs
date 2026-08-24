import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { normalizeEngineeringPaste, extractEngineeringNumber, inferPileGeometry } from '../src/engineering-text-normalizer.js';
import { solveEngineeringQuestion } from '../src/engineering-router.js';

const main=fs.readFileSync(new URL('../src/main.js',import.meta.url),'utf8');

test('v1.25.6 normalizes copied PDF/Word/LaTeX engineering symbols',()=>{
  const raw=String.raw`**$A=A_p=0,09\,\text{m}^2$**; $\gamma_{R,f}=1,0$; $R_{bt,ser}=1,75\,\text{MPa}$; $\sigma_{sp}=900\,\text{MPa}$; $N_{d,\max}\le262,73\,\text{kN}$ [cite: 59]`;
  const n=normalizeEngineeringPaste(raw);
  assert.match(n,/A=A_p=0,09 m2/);
  assert.match(n,/gamma_R,f=1,0/);
  assert.match(n,/R_bt,ser=1,75 MPa/);
  assert.match(n,/sigma_sp=900 MPa/);
  assert.match(n,/N_d,max≤262,73 kN/);
  assert.doesNotMatch(n,/\\text|\\gamma|\\sigma|\$|\[cite/);
});

test('v1.25.6 converts copied fractions without leaking frac commands',()=>{
  const raw=String.raw`$R_{aL}=(\frac{\sigma_{cu}}{3,5}-\frac{\sigma_{ce}}{4})\cdot A_0$`;
  const n=normalizeEngineeringPaste(raw);
  assert.match(n,/\(sigma_cu\)\/\(3,5\)/);
  assert.match(n,/\(sigma_ce\)\/\(4\)/);
  assert.match(n,/\* A_0|\*A_0/);
  assert.doesNotMatch(n,/\\frac|\\sigma|\\cdot/);
});

test('v1.25.6 extracts special engineering variable aliases after paste normalization',()=>{
  const raw=String.raw`$\gamma_{R,f}=1,0$; $R_{bt,ser}=1,75\,\text{MPa}$; $\sigma_{sp}=900\,\text{MPa}$; $q_b=1500\,\text{kPa}$; $f_i=20\,\text{kPa}$; $A_s'=804\,\text{mm}^2$.`;
  assert.equal(extractEngineeringNumber(raw,['gamma_R,f','gammaRf']),1);
  assert.equal(extractEngineeringNumber(raw,['R_bt,ser','Rbt,ser'],'MPa'),1.75);
  assert.equal(extractEngineeringNumber(raw,['sigma_sp','sigmasp'],'MPa'),900);
  assert.equal(extractEngineeringNumber(raw,['qb','q_b'],'kPa'),1500);
  assert.equal(extractEngineeringNumber(raw,['fi','f_i'],'kPa'),20);
  assert.equal(extractEngineeringNumber(raw,["As'","A_s'"],'mm2'),804);
});

test('v1.25.6 geometry golden: 300x300 plus A=Ap=0.09 never asks for pile-tip area again',()=>{
  const raw=`Cọc đóng vuông 300 × 300 mm, L=10 m. Diện tích tiết diện mũi & thân: A = A_p = 0,09 m². Chu vi u = 1,2 m. q_b = 1500 kPa.`;
  const g=inferPileGeometry(raw);
  assert.equal(g.shape,'square');
  assert.ok(Math.abs(g.areaM2-0.09)<1e-12);
  assert.ok(Math.abs(g.perimeterM-1.2)<1e-12);
  assert.equal(g.areaConflict,false);
  const solved=solveEngineeringQuestion(raw);
  assert.equal(solved.workflow?.id,'10304-driven');
  assert.ok(!String((solved.result?.missing||[]).join(' | ')).includes('diện tích mũi'));
  assert.ok(Math.abs(Number(solved.result?.geometry?.areaM2)-0.09)<1e-12);
});

test('v1.25.6 Q&A and Chat-to-Calculation textareas normalize clipboard text',()=>{
  assert.match(main,/\['chatQuestion','chatCalcQuestionEdit'\]\.includes\(target\?\.id\)/);
  assert.match(main,/normalizeEngineeringPaste\(pasted\)/);
  assert.match(main,/Đã chuẩn hóa ký hiệu\/công thức khi dán từ PDF, Word hoặc LaTeX/);
  assert.match(main,/const normalizedQuestion=normalizeEngineeringText\(question\)/);
  assert.match(main,/meta\.normalizedQuestion\|\|meta\.question/);
});
