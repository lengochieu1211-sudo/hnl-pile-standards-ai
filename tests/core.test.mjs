import test from 'node:test';
import assert from 'node:assert/strict';
import { annulusAreaMm2, axialResistance } from '../src/calculators.js';
import { searchChunks, localAnswer, localSummary } from '../src/search.js';
import { lookup7888, classesForDiameter7888 } from '../src/tcvn7888.js';

test('annulus area is computed from D and t', () => {
  const area = annulusAreaMm2({ diameterMm: 600, thicknessMm: 90 });
  const expected = Math.PI / 4 * (600 ** 2 - 420 ** 2);
  assert.ok(Math.abs(area - expected) < 1e-9);
});

test('axial resistance returns long, short and 80% short term', () => {
  const result = axialResistance({ areaMm2: 100000, sigmaCu: 80, sigmaCe: 8, alpha: 3.5 });
  assert.ok(result.longTermKn > 0);
  assert.equal(result.shortTermKn, result.longTermKn * 2);
  assert.equal(result.recommendedMaxKn, result.shortTermKn * 0.8);
});

test('TCVN 7888 quick table has PHC D600-B data', () => {
  const row = lookup7888(600, 'B');
  assert.equal(row.thickness, 90);
  assert.equal(row.crackMoment, 245.2);
  assert.equal(row.effectiveStress, 8);
  assert.equal(row.shearResistance, 392.4);
  assert.equal(row.lengthRange, '6–24');
});

test('TCVN 7888 skips unavailable AB classes', () => {
  assert.deepEqual(classesForDiameter7888(350), ['A', 'B', 'C']);
  assert.equal(lookup7888(350, 'AB'), null);
});

test('search finds relevant page and local answer cites it', () => {
  const docs = [{
    id: 'd1', name: 'tcvn.pdf', standard: 'TCVN 7888:2014',
    pages: [
      { page: 10, text: 'Cọc PHC đường kính 600 cấp B có mômen uốn nứt 245,2 kN.m và ứng suất hữu hiệu 8 MPa.' },
      { page: 14, text: 'Bề rộng vết rạn hoặc vết nứt bề mặt cọc không lớn hơn 0,05 mm.' }
    ]
  }];
  const hits = searchChunks('PHC D600 cấp B mômen uốn nứt', docs, 5);
  assert.ok(hits.length >= 1);
  assert.equal(hits[0].page, 10);
  const answer = localAnswer('mômen uốn nứt', hits);
  assert.match(answer, /Trang 10/);
});

test('local summary extracts headings and quantitative requirements', () => {
  const doc = { pages: [{ page: 1, text: '6 Yêu cầu kỹ thuật\n6.2 Yêu cầu về bê tông\nCường độ không nhỏ hơn 80 MPa.' }] };
  const summary = localSummary(doc);
  assert.ok(summary.headings.length >= 1);
  assert.ok(summary.important.length >= 1);
});
