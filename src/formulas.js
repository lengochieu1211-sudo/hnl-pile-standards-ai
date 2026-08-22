const FORMULA_CACHE = new Map();

function normSpace(s='') { return String(s).replace(/\u00a0/g, ' ').replace(/[ \t]+/g, ' ').trim(); }
function asciiMath(s='') {
  return normSpace(s)
    // Common Symbol-font private-use characters emitted by older Vietnamese PDFs.
    .replace(//g, '=')
    .replace(//g, '-')
    .replace(//g, '+')
    .replace(//g, '*')
    .replace(//g, '(')
    .replace(//g, ')')
    .replace(//g, 'pi')
    .replace(//g, 'alpha')
    .replace(//g, 'beta')
    .replace(//g, 'gamma')
    .replace(//g, 'sigma')
    .replace(//g, 'delta')
    .replace(//g, 'psi')
    .replace(//g, 'epsilon')
    .replace(/[−–—]/g, '-')
    .replace(/[×·⋅]/g, '*')
    .replace(/[÷]/g, '/')
    .replace(/≤/g, '<=')
    .replace(/≥/g, '>=')
    .replace(/≈/g, '~=')
    .replace(/π/g, 'pi')
    .replace(/α/g, 'alpha')
    .replace(/β/g, 'beta')
    .replace(/γ/g, 'gamma')
    .replace(/σ/g, 'sigma')
    .replace(/Δ/g, 'delta')
    .replace(/δ/g, 'delta')
    .replace(/Ψ|ψ/g, 'psi')
    .replace(/ε/g, 'epsilon')
    .replace(/²/g, '^2')
    .replace(/³/g, '^3');
}

function pageSignature(doc) {
  return `${doc?.pageCount || doc?.pages?.length || 0}:${doc?.textChars || (doc?.pages || []).reduce((n,p)=>n+String(p.text||'').length,0)}`;
}

function formulaish(line='') {
  const s = normSpace(line);
  if (!s || s.length > 420) return false;
  if (/\b(?:https?:|www\.)/i.test(s)) return false;
  const hasEq = /[=≤≥≈]/.test(s);
  const mathDensity = (s.match(/[+\-*/^()=≤≥≈×÷πασΔΨε]/g) || []).length;
  const numbered = /\((?:[A-Z]\.)?\d+(?:\.\d+)?\)\s*$/i.test(s);
  const variableEq = /(?:^|\s)[A-Za-zΑ-ω][A-Za-z0-9_Α-ω'′]*(?:\s*)=/.test(s);
  return (hasEq && (mathDensity >= 2 || variableEq)) || (numbered && mathDensity >= 1);
}

function nearestHeading(lines, index) {
  for (let i = index; i >= Math.max(0, index - 14); i--) {
    const s = normSpace(lines[i]);
    if (!s || s.length > 180) continue;
    if (/^(?:\d+(?:\.\d+)*\s+|phụ lục\s+[A-Z]|appendix\s+[A-Z]|[A-Z]\.?\d+(?:\.\d+)*\s+)/i.test(s)) return s;
  }
  return '';
}

function labelFrom(text='') {
  return text.match(/\((?:[A-Z]\.)?\d+(?:\.\d+)?\)/i)?.[0] || '';
}

function cleanupEquation(raw='') {
  let s = asciiMath(raw)
    .replace(/\((?:[A-Z]\.)?\d+(?:\.\d+)?\)\s*$/i, '')
    .replace(/\b(?:MPa|kN\.?m|kN|mm2|mm²|mm|m\/s2|m\/s²|tấn|tan)\b/gi, '')
    .replace(/(?<=\d),(?=\d)/g, '.')
    .replace(/\s+[xX]\s+/g, ' * ')
    .replace(/;+\s*$/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  s = s.replace(/\s*\*\s*/g, '*').replace(/\s*\/\s*/g, '/').replace(/\s*\^\s*/g, '^');
  return s;
}

export function guessExpression(raw='') {
  const s = cleanupEquation(raw);
  const eq = s.indexOf('=');
  if (eq < 1) return { expression: '', lhs: '', rhs: '', variables: [], computable: false };
  let lhsText = s.slice(0, eq).trim();
  let rhs = s.slice(eq + 1).trim();
  const lhsMatch = lhsText.match(/([A-Za-z][A-Za-z0-9_']*)\s*$/);
  const lhs = lhsMatch?.[1] || '';
  if (!lhs || lhs.length > 24 || !rhs) return { expression: '', lhs, rhs, variables: [], computable: false };

  // If the RHS still contains obvious prose, a second equality, empty brackets,
  // or an equation label embedded in the middle, treat it as review-only.
  const noisy = /[;:]|\b(?:trang|dieu|bang|coc|he|so|gia|tri|mpa|kn)\b/i.test(normalizeAscii(rhs))
    || rhs.includes('=')
    || /\(\s*[+\-*/]?\s*\)/.test(rhs)
    || /\((?:[A-Z]\.)?\d+(?:\.\d+)?\).*\S/i.test(rhs);

  rhs = rhs
    .replace(/\bpi\s*([A-Za-z])/g, 'pi*$1')
    .replace(/(\d)\s*([A-Za-z])/g, '$1*$2')
    .replace(/([A-Za-z0-9_)])\s*\(/g, '$1*(')
    .replace(/\)\s*([A-Za-z0-9_(])/g, ')*$1')
    .replace(/\s+/g, '');
  const expression = `${lhs}=${rhs}`;
  const variables = variablesFromExpression(rhs);
  const knownMulti = new Set(['fc','fy','fck','fcu','Ec','Ep','Ecp','Ac','Ap','AO','Ra','RaL','sigmaCu','sigmaCe','sigmaPt','sigmaPe','sigmaPi','alpha','beta','gamma','delta','epsilon','psi']);
  const suspiciousJoined = variables.some(v => ((/^[a-z]{2}$/.test(v) || /^[a-z][A-Z]$/.test(v)) && !knownMulti.has(v)));
  let computable = !noisy && !suspiciousJoined && isSafeExpression(rhs) && variables.length <= 16;
  if (computable) {
    try {
      const dummy = Object.fromEntries(variables.map(v => [v, 1.2345]));
      evaluateExpression(rhs, dummy);
    } catch { computable = false; }
  }
  return { expression, lhs, rhs, variables, computable };
}

function normalizeAscii(s='') {
  return String(s).toLocaleLowerCase('vi').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/đ/g,'d');
}

export function extractFormulaCandidates(doc) {
  if (!doc || doc.viewerKind === 'image') return [];
  const sig = pageSignature(doc);
  const cached = FORMULA_CACHE.get(doc.id);
  if (cached?.signature === sig) return cached.items;
  const items = [];
  const seen = new Set();
  for (const page of doc.pages || []) {
    const lines = String(page.text || '').replace(/\r/g, '').split('\n');
    for (let i = 0; i < lines.length; i++) {
      const line = normSpace(lines[i]);
      if (!line) continue;
      let start = i, end = i;
      let raw = line;
      if (!formulaish(line) && /(?:công thức|cong thuc|được tính|duoc tinh|xác định theo|xac dinh theo)/i.test(line)) {
        // Equations are frequently extracted onto one or more following lines.
        const look = lines.slice(i + 1, i + 6).map(normSpace).filter(Boolean);
        const formulaIndex = look.findIndex(formulaish);
        if (formulaIndex < 0) continue;
        end = i + 1 + formulaIndex;
        raw = normSpace(lines[end]);
      } else if (!formulaish(line)) continue;

      // Join immediate continuation lines when the formula is visibly split.
      while (end + 1 < lines.length && end - start < 3) {
        const next = normSpace(lines[end + 1]);
        if (!next || next.length > 260) break;
        if (/^(?:trong đó|trong do|where|với|voi|CHÚ|CHU|[-+•])/i.test(next)) break;
        if (formulaish(next) || /^[A-Za-zΑ-ω0-9_()\/.*+\-^=≤≥≈ ]{3,160}$/.test(next)) {
          raw = `${raw} ${next}`; end++;
        } else break;
      }
      raw = normSpace(raw);
      const key = `${page.page}:${asciiMath(raw).toLowerCase()}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const context = lines.slice(Math.max(0, i - 2), Math.min(lines.length, end + 4)).map(normSpace).filter(Boolean).join('\n');
      const guessed = guessExpression(raw);
      items.push({
        id: `${doc.id}:${page.page}:${items.length}`,
        docId: doc.id,
        docName: doc.name,
        standard: doc.standard || doc.name,
        page: page.page,
        label: labelFrom(raw) || labelFrom(context),
        title: nearestHeading(lines, i),
        raw,
        context,
        ...guessed
      });
    }
  }
  FORMULA_CACHE.set(doc.id, { signature: sig, items });
  return items;
}

export function extractFormulaLibrary(docs=[]) {
  const all = (docs || []).flatMap(extractFormulaCandidates);
  return all.sort((a,b) => String(a.standard).localeCompare(String(b.standard)) || a.page - b.page || String(a.label).localeCompare(String(b.label)));
}

export function formulaStats(docs=[]) {
  const items = extractFormulaLibrary(docs);
  return {
    total: items.length,
    computable: items.filter(x => x.computable).length,
    needsReview: items.filter(x => !x.computable).length,
    byDoc: (docs || []).map(d => {
      const formulas = extractFormulaCandidates(d);
      return { docId:d.id, name:d.name, standard:d.standard, total:formulas.length, computable:formulas.filter(x=>x.computable).length };
    })
  };
}

export function clearFormulaCache(docId=null) { if (docId) FORMULA_CACHE.delete(docId); else FORMULA_CACHE.clear(); }

export function variablesFromExpression(expr='') {
  const reserved = new Set(['sqrt','abs','min','max','pow','pi','e']);
  return [...new Set((String(expr).match(/[A-Za-z][A-Za-z0-9_]*/g) || []).filter(x => !reserved.has(x.toLowerCase())))];
}

export function isSafeExpression(expr='') {
  const s = String(expr).trim();
  if (!s || s.length > 1000) return false;
  if (/[^0-9A-Za-z_+\-*/^()., \t]/.test(s)) return false;
  const words = s.match(/[A-Za-z][A-Za-z0-9_]*/g) || [];
  const allowedFns = new Set(['sqrt','abs','min','max','pow','pi','e']);
  return words.every(w => allowedFns.has(w.toLowerCase()) || /^[A-Za-z][A-Za-z0-9_]*$/.test(w));
}

function tokenizeExpr(expr='') {
  const s = String(expr).replace(/,/g,'.');
  const tokens = [];
  let i = 0;
  while (i < s.length) {
    const c = s[i];
    if (/\s/.test(c)) { i++; continue; }
    if (/[0-9.]/.test(c)) {
      let j = i + 1; while (j < s.length && /[0-9.eE+-]/.test(s[j])) {
        if ((s[j] === '+' || s[j] === '-') && !/[eE]/.test(s[j-1])) break;
        j++;
      }
      const raw = s.slice(i,j); const n = Number(raw);
      if (!Number.isFinite(n)) throw new Error(`Số không hợp lệ: ${raw}`);
      tokens.push({t:'num',v:n}); i=j; continue;
    }
    if (/[A-Za-z_]/.test(c)) {
      let j=i+1; while (j<s.length && /[A-Za-z0-9_]/.test(s[j])) j++;
      tokens.push({t:'id',v:s.slice(i,j)}); i=j; continue;
    }
    if ('+-*/^(),'.includes(c)) { tokens.push({t:c,v:c}); i++; continue; }
    throw new Error(`Ký tự không hỗ trợ trong biểu thức: ${c}`);
  }
  tokens.push({t:'eof',v:''});
  return tokens;
}

export function evaluateExpression(expr, values={}) {
  if (!isSafeExpression(expr)) throw new Error('Biểu thức chưa đủ an toàn/chuẩn để tính tự động.');
  const tokens = tokenizeExpr(expr);
  let p = 0;
  const peek = () => tokens[p];
  const take = t => { if (peek().t !== t) throw new Error(`Thiếu “${t}” trong biểu thức.`); return tokens[p++]; };
  function primary() {
    const tok = peek();
    if (tok.t === 'num') { p++; return tok.v; }
    if (tok.t === '-') { p++; return -primary(); }
    if (tok.t === '+') { p++; return primary(); }
    if (tok.t === '(') { p++; const v = addSub(); take(')'); return v; }
    if (tok.t === 'id') {
      p++; const name = tok.v;
      const low = name.toLowerCase();
      if (low === 'pi') return Math.PI;
      if (low === 'e') return Math.E;
      if (peek().t === '(') {
        p++; const args=[];
        if (peek().t !== ')') { args.push(addSub()); while (peek().t === ',') { p++; args.push(addSub()); } }
        take(')');
        if (low === 'sqrt') return Math.sqrt(args[0]);
        if (low === 'abs') return Math.abs(args[0]);
        if (low === 'min') return Math.min(...args);
        if (low === 'max') return Math.max(...args);
        if (low === 'pow') return Math.pow(args[0], args[1]);
        throw new Error(`Hàm không hỗ trợ: ${name}`);
      }
      const v = Number(values[name]);
      if (!Number.isFinite(v)) throw new Error(`Chưa nhập giá trị hợp lệ cho ${name}.`);
      return v;
    }
    throw new Error(`Không đọc được biểu thức tại “${tok.v}”.`);
  }
  function power() { let v=primary(); while (peek().t === '^') { p++; v = Math.pow(v, power()); } return v; }
  function mulDiv() { let v=power(); while (peek().t === '*' || peek().t === '/') { const op=peek().t; p++; const r=power(); v = op==='*' ? v*r : v/r; } return v; }
  function addSub() { let v=mulDiv(); while (peek().t === '+' || peek().t === '-') { const op=peek().t; p++; const r=mulDiv(); v = op==='+' ? v+r : v-r; } return v; }
  const result = addSub();
  if (peek().t !== 'eof') throw new Error(`Biểu thức còn phần chưa đọc: ${peek().v}`);
  if (!Number.isFinite(result)) throw new Error('Kết quả không hữu hạn. Kiểm tra mẫu số và dữ liệu đầu vào.');
  return result;
}

const VERIFIED_7888 = [
  { key:'7.4-mass', page:18, label:'m', title:'Khối lượng cọc PC/PHC', lhs:'m', rhs:'2.6*pi*L*t*(D-t)', variables:['L','t','D'] },
  { key:'7.4-1', page:18, label:'(1)', title:'Tải trọng uốn gây nứt tính toán', lhs:'P', rhs:'(40*M-g*m*L)/(2*(3*L-5))', variables:['M','g','m','L'] },
  { key:'7.4-2', page:19, label:'(2)', title:'Mômen uốn nứt thực tế', lhs:'M', rhs:'g*m*L/40+P*(3*L-5)/20', variables:['g','m','L','P'] },
  { key:'7.5-3', page:20, label:'(3)', title:'Tải trọng uốn từ trên xuống P(+)', lhs:'Pplus', rhs:'4/(L1-1)*(M-g*m*(2*L1-L)/8-n*N)', variables:['L1','M','g','m','L','n','N'] },
  { key:'7.5-4', page:20, label:'(4)', title:'Tải trọng uốn từ dưới lên P(-)', lhs:'Pminus', rhs:'4/(L1-1)*(M+g*m*(2*L1-L)/8-n*N)+m*g', variables:['L1','M','g','m','L','n','N'] },
  { key:'7.5-5', page:23, label:'(5)', title:'Mômen uốn nứt lớn nhất thực tế', lhs:'M', rhs:'g*m*(2*L1-L)/8+P*(L1-1)/4+n*N3', variables:['g','m','L1','L','P','n','N3'] },
  { key:'7.6-6', page:24, label:'(6)', title:'Tải trọng cắt tính toán', lhs:'P', rhs:'2*Q', variables:['Q'] },
  { key:'7.6-7', page:24, label:'(7)', title:'Tải trọng cắt theo sơ đồ Hình 7', lhs:'P', rhs:'Q*(2*a+b)/b', variables:['Q','a','b'] },
  { key:'7.6-a', page:25, label:'a', title:'Khẩu độ cắt', lhs:'a', rhs:'D-t/2', variables:['D','t'] },
  { key:'A-nprime', page:30, label:"n'", title:'Tỷ lệ môđun đàn hồi tại truyền ứng suất', lhs:'nPrime', rhs:'Ep/Ecp', variables:['Ep','Ecp'] },
  { key:'A1', page:30, label:'(A.1)', title:'Ứng suất căng tính toán của thép', lhs:'sigmaPt', rhs:'((1-k/2)*sigmaPi)/(1+nPrime*(Ap/Ac))', variables:['k','sigmaPi','nPrime','Ap','Ac'] },
  { key:'A2', page:30, label:'(A.2)', title:'Ứng suất nén ban đầu của bê tông', lhs:'sigmaCpt', rhs:'sigmaPt*Ap/Ac', variables:['sigmaPt','Ap','Ac'] },
  { key:'A-n', page:31, label:'n', title:'Tỷ lệ môđun đàn hồi thép/bê tông', lhs:'n', rhs:'Ep/Ec', variables:['Ep','Ec'] },
  { key:'A3', page:31, label:'(A.3)', title:'Tổn thất ứng suất do từ biến và co ngót', lhs:'deltaSigmaPsi', rhs:'(n*psi*sigmaCpt+Ep*epsilonS)/(1+(n*sigmaCpt/sigmaPt)*(1+psi/2))', variables:['n','psi','sigmaCpt','Ep','epsilonS','sigmaPt'] },
  { key:'A4', page:31, label:'(A.4)', title:'Tổn thất ứng suất do chùng ứng suất', lhs:'deltaSigmaR', rhs:'0.5*k*sigmaPt', variables:['k','sigmaPt'] },
  { key:'A5', page:31, label:'(A.5)', title:'Ứng suất hữu hiệu trong thép chủ', lhs:'sigmaPe', rhs:'sigmaPt-(deltaSigmaPsi+deltaSigmaR)', variables:['sigmaPt','deltaSigmaPsi','deltaSigmaR'] },
  { key:'A6', page:31, label:'(A.6)', title:'Ứng suất hữu hiệu trong bê tông', lhs:'sigmaCe', rhs:'sigmaPe*Ap/Ac', variables:['sigmaPe','Ap','Ac'] },
  { key:'B1', page:32, label:'(B.1)', title:'Sức kháng nén dọc trục tính toán', lhs:'Ra', rhs:'(sigmaCu/alpha-sigmaCe/4)*A0', variables:['sigmaCu','alpha','sigmaCe','A0'] },
  { key:'B2', page:32, label:'(B.2)', title:'Sức chịu tải dài hạn PC', lhs:'RaL', rhs:'0.25*(sigmaCu-sigmaCe)*A0', variables:['sigmaCu','sigmaCe','A0'] },
  { key:'B3', page:32, label:'(B.3)', title:'Sức chịu tải ngắn hạn PC', lhs:'RaShort', rhs:'0.5*(sigmaCu-sigmaCe)*A0', variables:['sigmaCu','sigmaCe','A0'] },
  { key:'B4', page:33, label:'(B.4)', title:'Sức chịu tải dài hạn PHC/NPH', lhs:'RaL', rhs:'(sigmaCu/3.5-sigmaCe/4)*A0', variables:['sigmaCu','sigmaCe','A0'] },
  { key:'B5', page:33, label:'(B.5)', title:'Sức chịu tải ngắn hạn PHC/NPH', lhs:'RaShort', rhs:'2*(sigmaCu/3.5-sigmaCe/4)*A0', variables:['sigmaCu','sigmaCe','A0'] },
  { key:'B-Pmax', page:33, label:'Pmax', title:'Giới hạn tải làm việc thực tế tối đa', lhs:'Pmax', rhs:'0.8*RaShort', variables:['RaShort'] }
];

export function verifiedFormulaLibrary(docs=[]) {
  const doc = (docs || []).find(d => /TCVN\s*7888\s*:?\s*2014/i.test(`${d.standard || ''} ${d.name || ''}`) || /7888/.test(d.name || ''));
  if (!doc) return [];
  return VERIFIED_7888.map((f, i) => ({
    id:`verified7888:${f.key}`,
    docId:doc.id,
    docName:doc.name,
    standard:doc.standard || 'TCVN 7888:2014',
    page:f.page,
    label:f.label,
    title:f.title,
    raw:`${f.lhs} = ${f.rhs}`,
    context:'Công thức đã được đối chiếu trực tiếp với hình PDF TCVN 7888:2014.',
    expression:`${f.lhs}=${f.rhs}`,
    lhs:f.lhs,
    rhs:f.rhs,
    variables:f.variables,
    computable:true,
    verified:true
  }));
}
