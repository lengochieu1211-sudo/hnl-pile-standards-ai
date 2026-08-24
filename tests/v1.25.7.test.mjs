import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { solveEngineeringQuestion } from '../src/engineering-router.js';
import { latexReadableHtml } from '../src/math-render.js';

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
