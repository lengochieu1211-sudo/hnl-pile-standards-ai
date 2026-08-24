import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import { searchChunks, searchEveryPage, findExactPhrasePages, findTocPageTargets } from '../src/search.js';

const doc = {
  id:'golden-tcvn-10304', name:'TCVN 10304-2025.pdf', standard:'TCVN 10304:2025', pageCount:80,
  pages:Array.from({length:80},(_,i)=>({page:i+1,text:''}))
};
doc.pages[2].text='MỤC LỤC\n6.2 Phân loại cọc ........ 21\n7.2.1 Cọc chống ........ 28\n7.2.2 Cọc ma sát ........ 31\nPhụ lục A ........ 70';
doc.pages[20].text='6.2 Theo điều kiện tương tác với đất, cọc được chia thành cọc chống và cọc ma sát. Cọc chống bao gồm các loại cọc được chôn trong đá hoặc truyền tải chủ yếu qua mũi.';
doc.pages[27].text='7.2.1 Cọc chống\nSức chịu tải của cọc chống được xác định theo các quy định của điều này.';
doc.pages[30].text='7.2.2 Cọc ma sát\nSức chịu tải của cọc ma sát gồm sức kháng mũi và ma sát thành.';
doc.pages[69].text='PHỤ LỤC A\nCác hệ số và bảng tra phục vụ tính toán móng cọc.';
doc.textChars=doc.pages.reduce((n,p)=>n+p.text.length,0);

test('golden: cọc chống definition remains discoverable', () => {
  const hits=findExactPhrasePages('cọc chống là gì',[doc],10);
  assert.ok(hits.some(h=>h.page===21));
  assert.ok(hits.some(h=>h.page===28));
});

test('golden: TOC cọc chống points to printed page 28', () => {
  const targets=findTocPageTargets('cọc chống là gì',[doc],8);
  assert.equal(targets[0].printedPage,28);
});

test('golden: cọc ma sát is independently retrievable', () => {
  const hits=searchChunks('cọc ma sát',[doc],8);
  assert.ok(hits.some(h=>h.page===31 || h.page===21));
});

test('golden: appendix query can reach late pages', () => {
  const hits=searchEveryPage('Phụ lục A hệ số',[doc],12,{candidateLimit:50});
  assert.ok(hits.some(h=>h.page===70));
});

test('golden: proven search brain hash is immutable', () => {
  const source=fs.readFileSync(new URL('../src/search.js', import.meta.url),'utf8').replace(/\r\n/g,'\n').replace(/\r/g,'\n');
  assert.equal(crypto.createHash('sha256').update(source,'utf8').digest('hex'),'f9b65e5e6fb61dcca233a4fe43950e3174c73536f2fa83452da3041fbd0021d2');
});
