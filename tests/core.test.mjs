import test from 'node:test';
import assert from 'node:assert/strict';
import { annulusAreaMm2, axialResistance } from '../src/calculators.js';
import { searchChunks, searchEveryPage, smartSearchChunks, localAnswer, localSummary, corpusStats } from '../src/search.js';
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


test('v1.4 scans late pages instead of stopping at early pages', () => {
  const pages = Array.from({length: 120}, (_, i) => ({ page: i + 1, text: i === 113 ? 'Điều kiện đặc biệt: tải trọng thử cọc ở trang rất muộn là 1234 kN.' : `Nội dung chung trang ${i + 1}.` }));
  const docs = [{ id:'late', name:'late.pdf', standard:'TCVN TEST', pageCount:120, textChars: pages.reduce((n,p)=>n+p.text.length,0), pages }];
  const hits = searchEveryPage('tải trọng thử cọc 1234 kN', docs, 20);
  assert.ok(hits.some(h => h.page === 114), 'must find relevant content on page 114');
  const stats = corpusStats(docs);
  assert.equal(stats.pages, 120);
  assert.equal(stats.textPages, 120);
});

test('v1.4 balanced RAG keeps evidence from multiple matching PDFs', () => {
  const docs = [1,2,3].map(n => ({
    id:`d${n}`, name:`d${n}.pdf`, standard:`TCVN ${n}`, pageCount:3, textChars:100,
    pages:[
      {page:1,text:`Tài liệu ${n} quy định nghiệm thu cọc và hồ sơ chất lượng.`},
      {page:2,text:`Tài liệu ${n} yêu cầu thí nghiệm cọc trước nghiệm thu.`},
      {page:3,text:'Nội dung khác.'}
    ]
  }));
  const hits = smartSearchChunks('nghiệm thu cọc thí nghiệm', docs, 9, {perDoc:2});
  const ids = new Set(hits.map(h=>h.docId));
  assert.deepEqual([...ids].sort(), ['d1','d2','d3']);
});
