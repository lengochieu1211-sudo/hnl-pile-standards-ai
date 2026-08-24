import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { richTextHtml, latexReadableHtml } from '../src/math-render.js';

const main=fs.readFileSync(new URL('../src/main.js',import.meta.url),'utf8');
const excel=fs.readFileSync(new URL('../src/excel-export.js',import.meta.url),'utf8');

test('v1.25.5 renders screenshot-style single-dollar engineering math',()=>{
  const html=richTextHtml('Kết luận:\n- Sức chịu tải: **$P_v \\approx 1234,79 \\text{kN}$**.\n- Đất nền: $R_d \\approx 302,14 \\text{kN}$.\n- Tải max: $N_{d,\\max} \\approx 262,73 \\text{kN}$.');
  assert.match(html,/P<sub>v<\/sub>/);
  assert.match(html,/≈ 1234,79 kN/);
  assert.match(html,/R<sub>d<\/sub>/);
  assert.match(html,/N<sub>d,max<\/sub>/);
  assert.doesNotMatch(html,/\\approx|\\text|\$P_v|\$R_d/);
});

test('v1.25.5 renderer also handles escaped latex slashes',()=>{
  const html=latexReadableHtml('R\\\\_k \\\\approx 1250 \\\\text{kN}');
  assert.match(html,/R<sub>k<\/sub>/);
  assert.match(html,/≈ 1250 kN/);
  assert.doesNotMatch(html,/\\approx|\\text/);
});

test('v1.25.5 chat always exposes engineering actions instead of hiding Excel path',()=>{
  assert.match(main,/engineeringActionsHtml/);
  assert.match(main,/Xuất Excel tính toán/);
  assert.match(main,/Bổ sung dữ liệu để xuất Excel/);
  assert.match(main,/Mở trong Tính/);
  assert.match(main,/Xem nguồn tính/);
  assert.match(main,/data-engineering-open-calc/);
});

test('v1.25.5 Chat-to-Calculation transfer recalculates deterministic payload',()=>{
  assert.match(main,/openEngineeringInCalculator/);
  assert.match(main,/chatCalcTransferHtml/);
  assert.match(main,/recalculateChatTransfer/);
  assert.match(main,/engineeringExcelPayload\(question\)/);
  assert.match(main,/Calculation Engine đã đủ dữ liệu/);
});

test('v1.25.5 chat Excel continues to use lean deterministic exporter',()=>{
  assert.match(main,/exportUnifiedEngineeringWorkbook\(\{\.\.\.payload,imageProvenance\}/);
  assert.match(excel,/exportUnifiedEngineeringWorkbook/);
  assert.match(excel,/export7888WorkflowWorkbook/);
  assert.match(excel,/export10304AdvancedWorkflowWorkbook/);
  assert.match(excel,/export5574WorkflowWorkbook/);
});

test('v1.25.5 REVIEW and missing-input safety gates remain visible',()=>{
  assert.match(main,/startsWith\('VERIFIED'\)/);
  assert.match(main,/Workflow chưa VERIFIED nên không được xuất Excel số học/);
  assert.match(main,/Đề bài chưa đủ dữ liệu để xuất Excel/);
});
