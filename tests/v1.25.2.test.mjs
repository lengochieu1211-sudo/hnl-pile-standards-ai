import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const excel=fs.readFileSync(new URL('../src/excel-export.js',import.meta.url),'utf8');

test('v1.25.2 7888 table outputs are dynamic Excel lookups',()=>{
  const fn=excel.match(/export async function export7888WorkflowWorkbook[\s\S]*?\n\}/)?.[0]||'';
  assert.match(fn,/SUMIFS\('02_BANG_TRA'/);
  assert.match(fn,/Tra t',\{formula:/);
  assert.match(fn,/Tra σce',\{formula:/);
  assert.match(fn,/Tra Mcr',\{formula:/);
  assert.match(fn,/Tra bền cắt',\{formula:/);
  assert.doesNotMatch(fn,/Tra t',\{formula:`\$\{t\}`/);
  assert.doesNotMatch(fn,/Mômen nứt',row\.crackMoment/);
});

test('v1.25.2 user Annex DLM workbooks contain no QA benchmark sheet',()=>{
  const fn=excel.match(/async function export5574AnnexDLMWorkbook[\s\S]*?\n\}/)?.[0]||'';
  assert.doesNotMatch(fn,/addWorksheet\('05_BENCHMARK'\)/);
  assert.doesNotMatch(fn,/bench\.add/);
});

test('v1.25.2 generic 5574 result link is a live formula object',()=>{
  assert.match(excel,/\['Hệ số sử dụng',\{formula:`='03_TINH_TOAN'!D\$\{calc\.rowCount\}`\}/);
});

test('v1.25.2 lean dispatcher still isolates standards',()=>{
  const fn=excel.match(/export async function exportUnifiedEngineeringWorkbook[\s\S]*?\n\}/)?.[0]||'';
  assert.match(fn,/export7888WorkflowWorkbook/);
  assert.match(fn,/exportDrivenPileWorkflowWorkbook/);
  assert.match(fn,/export10304AdvancedWorkflowWorkbook/);
  assert.match(fn,/export5574WorkflowWorkbook/);
  assert.doesNotMatch(fn,/loadUnifiedProductionTemplateV125/);
});
