import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const excel=fs.readFileSync(new URL('../src/excel-export.js',import.meta.url),'utf8');
const main=fs.readFileSync(new URL('../src/main.js',import.meta.url),'utf8');

test('v1.25.1 AI and Calculation Engine use unified dispatch entry',()=>{
  assert.match(main,/exportUnifiedEngineeringWorkbook/);
  assert.match(excel,/LEAN EXPORT \+ FORMULA-ONLY/);
});

test('v1.25.1 lean dispatcher selects only exact workflow generator',()=>{
  assert.match(excel,/workflowId==='7888-material'[\s\S]*export7888WorkflowWorkbook/);
  assert.match(excel,/workflowId==='10304-driven'[\s\S]*exportDrivenPileWorkflowWorkbook/);
  assert.match(excel,/map10304\[workflowId\][\s\S]*export10304AdvancedWorkflowWorkbook/);
  assert.match(excel,/workflowId\.startsWith\('5574-'\)[\s\S]*export5574WorkflowWorkbook/);
});

test('v1.25.1 production dispatch no longer injects deterministic result values into master workbook',()=>{
  const fn=excel.match(/export async function exportUnifiedEngineeringWorkbook[\s\S]*?\n\}/)?.[0]||'';
  assert.doesNotMatch(fn,/loadUnifiedProductionTemplateV125/);
  assert.doesNotMatch(fn,/injectCurrentEngineeringRunV125/);
  assert.doesNotMatch(fn,/payload\.result/);
});

test('formula workbook generators contain real Excel formulas',()=>{
  assert.match(excel,/\{formula:/);
  assert.match(excel,/calcProperties=\{fullCalcOnLoad:true,forceFullCalc:true,calcMode:'auto'\}/);
});

test('REVIEW numeric export remains blocked in UI',()=>{
  assert.match(main,/startsWith\('VERIFIED'\)/);
});
