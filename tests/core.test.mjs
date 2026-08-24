import test from 'node:test';
import assert from 'node:assert/strict';
import { annulusAreaMm2, axialResistance } from '../src/calculators.js';
import { searchChunks, searchEveryPage, smartSearchChunks, deepSearchChunks, localAnswer, localSummary, corpusStats, tokenize, coreSearchPhrase, findTocPageTargets, findExactPhrasePages, compactNormalize } from '../src/search.js';
import { parsePageSpec } from '../src/scope.js';
import { lookup7888, lookupNph7888, lookupPileType7888, classesForDiameter7888, classesForPileType7888, diametersForPileType7888, isTcvn7888_2014Document } from '../src/tcvn7888.js';
import { extractFormulaCandidates, evaluateExpression, verifiedFormulaLibrary, aiFormulaCandidates } from '../src/formulas.js';

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



test('v1.10.1 NPH class logic excludes AB while PHC keeps valid Table 1 classes', () => {
  assert.deepEqual(classesForPileType7888(600, 'NPH'), ['A','B','C']);
  assert.deepEqual(classesForPileType7888(600, 'PHC'), ['A','AB','B','C']);
  assert.deepEqual(classesForPileType7888(350, 'PHC'), ['A','B','C']);
});

test('v1.10.2 NPH Table 2 is explicit and never borrowed from Table 1', () => {
  const row = lookupNph7888(600, 'B');
  assert.equal(row.designation, '800-600');
  assert.equal(row.noduleDiameterMax, 800);
  assert.equal(row.thickness, 90);
  assert.equal(row.effectiveStress, 8);
  assert.equal(row.shearResistance, 392.4);
  assert.equal(row.table, 'Bảng 2');
  assert.equal(row.page, 12);
  assert.equal(lookupNph7888(600, 'AB'), null);
  assert.equal(lookupNph7888(350, 'B'), null);
  assert.deepEqual(diametersForPileType7888('NPH'), [300,400,450,500,600,700,800,900,1000]);
  assert.equal(lookupPileType7888(900, 'B', 'NPH')?.designation, '1100-900');
});

test('v1.10.2 verified TCVN 7888 tools require the 2014 edition identity', () => {
  assert.equal(isTcvn7888_2014Document({name:'TCVN 7888:2014.pdf'}), true);
  assert.equal(isTcvn7888_2014Document({name:'TCVN 7888:2008.pdf'}), false);
  assert.equal(isTcvn7888_2014Document({name:'notes-7888.pdf'}), false);
  assert.equal(isTcvn7888_2014Document({name:'renamed.pdf',pages:[{page:1,text:'TCVN 7888:2014 Cọc bê tông ly tâm ứng lực trước'}]}), true);
  assert.equal(verifiedFormulaLibrary([{id:'old',name:'TCVN 7888:2008.pdf'}]).length, 0);
  assert.equal(verifiedFormulaLibrary([{id:'notes',name:'my-7888-notes.pdf'}]).length, 0);
  assert.ok(verifiedFormulaLibrary([{id:'ok',name:'renamed.pdf',pages:[{page:1,text:'TCVN 7888:2014'}]}]).length > 0);
});

test('v1.10.1 verified Appendix B dynamic formula converts MPa·mm² from N to kN', () => {
  const area = annulusAreaMm2({ diameterMm:600, thicknessMm:90 });
  const dedicated = axialResistance({ areaMm2:area, sigmaCu:80, sigmaCe:8, alpha:3.5 });
  const lib = verifiedFormulaLibrary([{id:'t',name:'TCVN 7888:2014.pdf',standard:'TCVN 7888:2014'}]);
  const b4 = lib.find(x => x.label === '(B.4)');
  assert.equal(b4.outputUnit, 'kN');
  assert.equal(b4.resultScale, 0.001);
  assert.equal(b4.variableUnits.A0, 'mm²');
  const rawN = evaluateExpression(b4.rhs, { sigmaCu:80, sigmaCe:8, A0:area });
  const resultKn = rawN * b4.resultScale;
  assert.ok(Math.abs(resultKn - dedicated.longTermKn) < 1e-9);
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


test('v1.6 deep RAG covers engineering sections across late pages', () => {
  const pages = Array.from({length: 22}, (_, i) => ({ page:i+1, text:`Nội dung chung trang ${i+1}.` }));
  pages[4].text = '1 Phạm vi áp dụng Tiêu chuẩn này áp dụng cho thiết kế móng cọc.';
  pages[8].text = '6 Yêu cầu kỹ thuật Cọc phải thỏa mãn các giới hạn thiết kế.';
  pages[11].text = 'Công thức tính toán sức chịu tải: P = 2Q (6).';
  pages[14].text = '7 Phương pháp thử Thí nghiệm kiểm tra tải trọng cọc.';
  pages[17].text = '8 Nghiệm thu Hồ sơ nghiệm thu và điều kiện chấp nhận.';
  pages[20].text = '9 Bảo quản và vận chuyển Nâng chuyển và xếp cọc.';
  const docs=[{id:'deep',name:'deep.pdf',standard:'TCVN TEST',pageCount:22,textChars:1000,pages}];
  const hits=deepSearchChunks('Tổng hợp phạm vi, yêu cầu kỹ thuật, công thức, phương pháp thử, nghiệm thu, bảo quản vận chuyển', docs, 60);
  const pageSet=new Set(hits.map(h=>h.page));
  for (const p of [5,9,12,15,18,21]) assert.ok(pageSet.has(p), `missing engineering section page ${p}`);
});

test('v1.6 formula scanner recognizes Symbol-font equals and calculates safe formula', () => {
  const doc={id:'f1',name:'formula.pdf',standard:'TCVN TEST',pageCount:2,textChars:100,pages:[
    {page:1,text:'7.6 Khả năng bền cắt\nP \uf03d 2Q (6)'},
    {page:2,text:'n = L/1000'}
  ]};
  const formulas=extractFormulaCandidates(doc);
  const p=formulas.find(x=>x.lhs==='P');
  assert.ok(p?.computable);
  assert.equal(evaluateExpression(p.rhs,{Q:25}),50);
});

test('v1.7.1 formula library includes AI/Vision formulas stored on uploaded documents', async () => {
  const { extractFormulaLibrary } = await import('../src/formulas.js');
  const doc={id:'ai1',name:'scan.pdf',standard:'TCVN SCAN',viewerKind:'pdf',pageCount:3,textChars:0,pages:[{page:1,text:''},{page:2,text:''},{page:3,text:''}],aiFormulaItems:[
    {id:'af1',page:2,label:'(10)',title:'Sức chịu tải',raw:'R = 2 Q',expression:'R=2*Q',variables:['R','Q'],confidence:0.99,verified:false,allowCompute:false}
  ]};
  const formulas=extractFormulaLibrary([doc]);
  assert.ok(formulas.some(x=>x.aiDetected && x.page===2 && x.label==='(10)'));
  assert.equal(formulas.find(x=>x.id==='af1')?.computable, false);
});


test('v1.9.19 Vietnamese technical query strips normalized question stop-words', () => {
  assert.deepEqual(tokenize('cọc chống là gì'), ['coc', 'chong']);
  assert.equal(coreSearchPhrase('Cọc chống là gì?'), 'coc chong');
});

test('v1.9.19 Vietnamese tokenizer preserves accent-colliding engineering terms', () => {
  const tokens = tokenize('Bảng 1 tải trọng co ngót độ lún');
  for (const term of ['bang','1','tai','trong','co','ngot','do','lun']) assert.ok(tokens.includes(term), `missing ${term}`);
  assert.equal(coreSearchPhrase('Định nghĩa cọc chống là gì'), 'coc chong');
});

test('v1.9.19 TOC resolver finds cọc chống target page from searchable contents', () => {
  const pages = Array.from({length:40}, (_, i) => ({ page:i+1, text:'' }));
  pages[2].text = 'MỤC LỤC\n7.2 Các phương pháp tính toán ........ 28\n7.2.1 Cọc chống ........................ 28\n7.2.2 Cọc ma sát ....................... 31\n7.3 Thí nghiệm ........................ 35';
  pages[27].text = '7.2.1 Cọc chống\nCọc chống truyền tải trọng xuống lớp đất hoặc đá có sức chịu tải lớn.';
  const doc = { id:'toc1', name:'TCVN 10304.pdf', standard:'TCVN 10304:2025', pageCount:40, textChars:pages.reduce((n,p)=>n+p.text.length,0), pages };
  const targets = findTocPageTargets('cọc chống là gì', [doc], 8);
  assert.ok(targets.length >= 1);
  assert.equal(targets[0].sourcePage, 3);
  assert.equal(targets[0].printedPage, 28);
  assert.equal(targets[0].targetPage, 28);
  assert.match(targets[0].heading, /Cọc chống/i);
});

test('v1.9.19 TOC resolver infers printed-page to PDF-page offset before visual OCR', () => {
  const pages = Array.from({length:80}, (_, i) => ({ page:i+1, text:'' }));
  pages[2].text = 'MỤC LỤC\n1 Phạm vi ........ 5\n2 Tài liệu viện dẫn ........ 7\n7.2.1 Cọc chống ........ 28\n7.2.2 Cọc ma sát ........ 31\n8 Thí nghiệm ........ 49';
  pages[6].text = '1 Phạm vi\nTiêu chuẩn áp dụng cho thiết kế móng cọc.'; // printed 5 -> PDF 7
  pages[8].text = '2 Tài liệu viện dẫn\nCác tài liệu viện dẫn sau là cần thiết.'; // printed 7 -> PDF 9
  // Page containing cọc chống intentionally has no text: it represents a scan.
  const doc = { id:'toc2', name:'mixed.pdf', standard:'TCVN MIXED', pageCount:80, textChars:pages.reduce((n,p)=>n+p.text.length,0), pages };
  const targets = findTocPageTargets('cọc chống là gì', [doc], 8);
  assert.equal(targets[0].offset, 2);
  assert.ok(targets[0].offsetVotes >= 2);
  assert.equal(targets[0].targetPage, 30);
  assert.deepEqual(targets[0].candidatePages, [30,29,31]);
});


test('v1.9.20 compact exact search recovers character-spaced PDF glyph text', () => {
  assert.equal(compactNormalize('C ọ c   c h ố n g'), 'cocchong');
  const doc = { id:'glyph', name:'scan.pdf', standard:'TCVN TEST', pages:[
    {page:19, text:'6.2 Theo điều kiện tương tác với đất, c ọ c   c h ố n g bao gồm các loại cọc được chôn trong đá.'}
  ]};
  const hits = searchChunks('cọc chống là gì', [doc], 5);
  assert.ok(hits.some(h => h.page === 19), 'compact exact phrase must rescue split-glyph text');
});

test('v1.9.20 exact phrase pass prioritizes body definition over TOC occurrence', () => {
  const doc = { id:'exact', name:'TCVN 10304.pdf', standard:'TCVN 10304:2025', pages:[
    {page:3, text:'MỤC LỤC\n7.2.1 Cọc chống ........................ 28\n7.2.2 Cọc ma sát ....................... 31\n7.3 Thí nghiệm ........................ 35\n8 Yêu cầu .............................. 40\n9 Phụ lục .............................. 50'},
    {page:21, text:'6.2 Theo điều kiện tương tác với đất, cọc được chia thành cọc chống và cọc ma sát. Cọc chống bao gồm các loại cọc được chôn trong đá.'},
    {page:30, text:'7.2.1 Cọc chống\nSức chịu tải của cọc chống được xác định theo các quy định sau.'}
  ]};
  const hits = findExactPhrasePages('cọc chống là gì', [doc], 10);
  assert.ok(hits.length >= 3);
  assert.equal(hits[0].tocAnchor, false);
  assert.ok([21,30].includes(hits[0].page));
  assert.ok(hits.some(h => h.page === 3 && h.tocAnchor));
});


test('v1.10.1 AI formula cannot bypass verification with legacy allowCompute metadata', () => {
  const doc = {
    id:'doc-ai-gate', name:'scan.pdf', standard:'TCVN TEST',
    aiFormulaItems:[{ id:'legacy', page:5, raw:'R = 2 Q', expression:'R=2*Q', variables:['Q'], verified:false, allowCompute:true }]
  };
  const item = aiFormulaCandidates(doc)[0];
  assert.equal(item.aiDetected, true);
  assert.equal(item.verified, false);
  assert.equal(item.computable, false);
  assert.equal(item.reviewRequired, true);
});

test('v1.9.26 page range parser handles ranges, lists, reversed ranges and bounds', () => {
  assert.deepEqual(parsePageSpec('28-31, 35; 40', 124), [28,29,30,31,35,40]);
  assert.deepEqual(parsePageSpec('5-3', 10), [3,4,5]);
  assert.deepEqual(parsePageSpec('0,1,999', 20), [1]);
  assert.deepEqual(parsePageSpec('', 20), []);
});

test('v1.10.2 Appendix B verified formulas carry minimum concrete strength guards', () => {
  const lib = verifiedFormulaLibrary([{ id:'d', name:'TCVN 7888:2014.pdf', standard:'TCVN 7888:2014', pages:[] }]);
  const b2 = lib.find(x => x.label === '(B.2)');
  const b4 = lib.find(x => x.label === '(B.4)');
  assert.equal(b2.inputMinimums.sigmaCu, 60);
  assert.equal(b4.inputMinimums.sigmaCu, 80);
});

test('v1.11.0 deep Code Packs cover all three user standards without auto-verifying lossy formulas', async () => {
  const { CODEPACK_7888, CODEPACK_10304, CODEPACK_5574, codePackSearch, codePackStats } = await import('../src/codepacks.js');
  assert.equal(CODEPACK_7888.formulas.length, 18);
  assert.equal(CODEPACK_10304.formulas.length, 48);
  assert.ok(CODEPACK_5574.formulas.length >= 300);
  assert.equal(CODEPACK_7888.tables.length, 6);
  assert.equal(CODEPACK_10304.tables.length, 18);
  assert.equal(CODEPACK_5574.tables.length, 19);
  assert.deepEqual(CODEPACK_7888.formulas.filter(f=>f.status==='Verified').map(f=>f.label), ['(B.1)','(B.2)','(B.3)','(B.4)','(B.5)']);
  assert.equal(CODEPACK_5574.formulas.some(f=>f.computable), false);
  const docs=[{id:'a',name:'6. TCVN 10304 2025_THIET KE MONG COC.pdf'},{id:'b',name:'10.TCVN 5574-2018_THIET KE BE TONG.pdf'},{id:'c',name:'tcvn-7888-2014-coc-be-tong-ly-tam-ust.pdf'}];
  const st=codePackStats(docs); assert.equal(st.packs,3); assert.ok(st.formulas>=398); assert.equal(st.tables,43);
  assert.equal(codePackSearch('cọc chống là gì',[docs[0]],3)[0].page,28);
  assert.equal(codePackSearch('chọc thủng',[docs[1]],3)[0].page,82);
  assert.ok(codePackSearch('ứng suất hữu hiệu Phụ lục A',[docs[2]],5).some(h=>h.page===30 || h.page===31));
  assert.equal(codePackSearch('CB400-V Bảng 13',[docs[1]],3)[0].page,45);
});

test('v1.11.0 structured lookup tables return verified material values', async () => {
  const { lookup5574Concrete, lookup5574Steel, TCVN10304_TABLE_10, TCVN10304_TABLE_17 } = await import('../src/codepack-tables.js');
  const b30=lookup5574Concrete('B30'); assert.equal(b30.Rb,17); assert.equal(b30.Rbt,1.15); assert.equal(b30.Eb,32500);
  const cb400=lookup5574Steel('CB400-V'); assert.equal(cb400.Rs,350); assert.equal(cb400.Rsc,350); assert.equal(cb400.Rsw,280);
  assert.deepEqual(TCVN10304_TABLE_10.find(r=>r.phi===24), {phi:24,alpha1:18,alpha2:9.2,standard:'TCVN 10304:2025',table:'Bảng 10',page:45,status:'Verified'});
  assert.equal(TCVN10304_TABLE_17.find(r=>r.nu===0.3).eta,1.607);
});
