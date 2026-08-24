// HNL UI operation-scope helpers. Kept outside search.js so the proven
// v1.9.23 search brain can remain byte-for-byte unchanged.
export function parsePageSpec(value = '', maxPage = 0) {
  const max = Math.max(1, Number(maxPage) || 1);
  const out = new Set();
  const src = String(value || '').replace(/[–—]/g, '-').trim();
  if (!src) return [];
  for (const token of src.split(/[;,\s]+/).filter(Boolean)) {
    const range = token.match(/^(\d+)\s*-\s*(\d+)$/);
    if (range) {
      let a = Math.max(1, Math.min(max, Number(range[1])));
      let b = Math.max(1, Math.min(max, Number(range[2])));
      if (a > b) [a, b] = [b, a];
      for (let n = a; n <= b; n++) out.add(n);
      continue;
    }
    const n = Number(token);
    if (Number.isInteger(n) && n >= 1 && n <= max) out.add(n);
  }
  return [...out].sort((a,b)=>a-b);
}
