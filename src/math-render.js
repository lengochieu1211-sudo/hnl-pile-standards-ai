// HNL v1.25.6 — Offline-safe math renderer for AI engineering answers.
// Supports \(...\), $$...$$ and provider-style single-dollar inline math $...$.
// It deliberately renders only a conservative LaTeX subset so raw tokens such as
// \approx, \text{kN}, R_d or N_{d,max} never leak into the visible answer.

function esc(value = '') {
  return String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[c]));
}

export function normalizeMathDelimiters(value = '') {
  return String(value || '')
    .replace(/\\\[/g, '$$$$')
    .replace(/\\\]/g, '$$$$');
}


function recoverStrippedLatexCommands(value='') {
  // Some AI providers/JSON layers occasionally strip the leading backslash but leave
  // command names (frac, sigma, left, right, times, approx...). Recover only in
  // math-looking fragments to avoid rewriting ordinary Vietnamese prose.
  let s=String(value||'');
  if(!/(?:frac|sigma|gamma|left|right|times|cdot|approx|boxed|sqrt|sum|alpha|beta|phi|nu|epsilon|xi|zeta|theta|delta)/i.test(s)) return s;
  // Recover compact fractions first so embedded command words become standalone tokens:
  // fracsigma_cu3,5 -> \frac{sigma_cu}{3,5}.
  s=s.replace(/\bfrac\s*([A-Za-z][A-Za-z_,'-]{1,20})\s*(\d+(?:[.,]\d+)?)/gi,'\\frac{$1}{$2}')
     .replace(/\bfrac\s*(\d+(?:[.,]\d+)?)\s+(\d+(?:[.,]\d+)?)/gi,'\\frac{$1}{$2}');
  // Safe symbol/operator commands. Run after fraction recovery so sigma/gamma inside
  // recovered braces receive their leading slash too.
  s=s.replace(/\b(approx|leq?|geq?|times|cdot|pm)(?=[^A-Za-z]|$)/g,'\\$1')
     .replace(/\b(sigma|gamma|alpha|beta|phi|nu|epsilon|xi|zeta|theta|delta|sum|pi)(?=[_\s{(]|$)/g,'\\$1');
  s=s.replace(/\b(left|right)\b/g,'\\$1');
  // boxed is cosmetic; if braces were lost just drop the token instead of leaking it.
  s=s.replace(/\bboxed(?=[A-Za-z0-9])/g,'');
  // Recover compact symbol names left by providers that dropped both the slash and
  // subscript braces: sigmacu -> \sigma_{cu}, gammak -> \gamma_{k}.
  s=s.replace(/(?<!\\)\bsigma[_\s]*(cu|ce|sp)\b/gi,'\\sigma_$1')
     .replace(/(?<!\\)\bgamma[_\s]*(k|n)\b/gi,'\\gamma_$1');
  return s;
}

function normalizeLatexSlashes(value='') {
  // Some providers return JSON-escaped LaTeX as two literal backslashes.
  // Collapse only before known LaTeX-ish tokens, never arbitrary paths.
  return String(value || '').replace(/\\\\(?=[A-Za-z_[\]{}^])/g, '\\');
}

export function latexReadableHtml(value = '') {
  let out = esc(normalizeLatexSlashes(recoverStrippedLatexCommands(String(value || '').trim())))
    .replace(/\\left\b/g, '')
    .replace(/\\right\b/g, '')
    .replace(/\\boxed\b/g, '')
    .replace(/\\(?=\s)/g, '')
    .replace(/\\,/g, ' ')
    .replace(/\\;/g, ' ')
    .replace(/\\!/g, '');
  const symbols = {
    gamma:'γ', Gamma:'Γ', alpha:'α', beta:'β', delta:'δ', Delta:'Δ', epsilon:'ε',
    theta:'θ', lambda:'λ', mu:'μ', nu:'ν', rho:'ρ', sigma:'σ', Sigma:'Σ', tau:'τ',
    phi:'φ', psi:'ψ', omega:'ω', Omega:'Ω', pi:'π', sum:'∑', prod:'∏', int:'∫',
    cdot:'·', times:'×', pm:'±', le:'≤', leq:'≤', ge:'≥', geq:'≥', neq:'≠', approx:'≈', infty:'∞'
  };
  out = out.replace(/\\(?:text|textrm|textsf|mathrm|mathbf|operatorname)\{([^{}]*)\}/g, '$1');
  for (let i = 0; i < 5; i++) {
    const next = out.replace(/\\frac\{([^{}]+)\}\{([^{}]+)\}/g, '<span class="math-frac"><span>$1</span><span>$2</span></span>');
    if (next === out) break;
    out = next;
  }
  out = out.replace(/\\sqrt\{([^{}]+)\}/g, '√<span class="math-radicand">$1</span>');
  out = out.replace(/\\([A-Za-z]+)/g, (m, name) => symbols[name] || name);
  out = out.replace(/\\_/g, '_').replace(/\\\^/g, '^');
  out = out.replace(/_\{([^{}]+)\}/g, '<sub>$1</sub>');
  out = out.replace(/\^\{([^{}]+)\}/g, '<sup>$1</sup>');
  out = out.replace(/_([A-Za-z0-9]+)/g, '<sub>$1</sub>');
  out = out.replace(/\^([A-Za-z0-9+\-]+)/g, '<sup>$1</sup>');
  out = out.replace(/[{}]/g, '');
  return out;
}

function likelyInlineMath(tex='') {
  const s=String(tex||'').trim();
  if(!s) return false;
  return /\\[A-Za-z]+|[_^=≈≤≥×÷]|\b(?:R|N|P|M|Q|V|A|E|I|L|D|As|Rd|Rk)\s*[_=]/i.test(s);
}

function normalizeLooseLatex(value='') {
  // Last-resort cleanup for providers that omit math delimiters around tiny units/tokens.
  // Keep this narrow: no generic backslash removal.
  return String(value||'')
    .replace(/\\approx\b/g,'≈')
    .replace(/\\(?:leq|le)\b/g,'≤')
    .replace(/\\(?:geq|ge)\b/g,'≥')
    .replace(/\\times\b/g,'×')
    .replace(/\\cdot\b/g,'·')
    .replace(/\\(?:text|textrm|mathrm)\{([^{}]*)\}/g,'$1');
}

function likelyBareLatexLine(value='') {
  const s=String(value||'').trim();
  if(!s) return false;
  const hasLatex=/\\(?:frac|sqrt|sum|sigma|gamma|alpha|beta|phi|nu|epsilon|xi|zeta|theta|delta|boxed|left|right|times|cdot|approx|leq?|geq?|text)(?=[_\s{(]|$)/i.test(s);
  if(!hasLatex) return false;
  // Auto-render only formula-looking standalone lines. Mixed prose stays prose so we do
  // not unexpectedly style an entire Vietnamese sentence as mathematics.
  return /^(?:\\(?:frac|sqrt|sum|sigma|gamma|boxed|left)(?=[_\s{(]|$)|[A-Za-z][A-Za-z0-9_,'{}\\]*\s*(?:=|≈|<=|>=|\\(?:leq?|geq?|approx)(?=[_\s{(]|$)))/i.test(s)
    || (/^[\\A-Za-z0-9_,'{}().+\-*/=≤≥≈\s]+$/.test(s) && /[=≤≥≈]|\\(?:frac|sum)\b/.test(s));
}

export function inlineMarkup(value = '') {
  let raw = normalizeLatexSlashes(recoverStrippedLatexCommands(String(value || '')));
  if(likelyBareLatexLine(raw)) return `<span class="math-inline">${latexReadableHtml(raw)}</span>`;
  const inlineMath = [];
  raw = raw.replace(/\\\((.+?)\\\)/g, (_, tex) => `@@HNL_INLINE_MATH_${inlineMath.push(tex)-1}@@`);
  // By this stage display $$...$$ blocks have already been extracted by richTextHtml.
  raw = raw.replace(/\$([^$\n]+?)\$/g, (whole, tex) => {
    if(!likelyInlineMath(tex)) return whole;
    return `@@HNL_INLINE_MATH_${inlineMath.push(tex)-1}@@`;
  });
  raw = normalizeLooseLatex(raw);
  let out = esc(raw);
  out = out.replace(/`([^`]+)`/g, '<code>$1</code>');
  out = out.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  out = out.replace(/__([^_]+)__/g, '<strong>$1</strong>');
  out = out.replace(/@@HNL_INLINE_MATH_(\d+)@@/g, (_, i) => `<span class="math-inline">${latexReadableHtml(inlineMath[Number(i)] || '')}</span>`);
  return out;
}

export function richTextHtml(value = '') {
  let normalized = normalizeMathDelimiters(value).replace(/\r/g, '');
  const displayMath = [];
  normalized = normalized.replace(/\$\$([\s\S]*?)\$\$/g, (_, tex) => `\n@@HNL_DISPLAY_MATH_${displayMath.push(tex)-1}@@\n`);
  const lines = normalized.split('\n');
  const out = [];
  let list = [];
  const flush = () => { if (list.length) { out.push(`<ul>${list.map(x => `<li>${inlineMarkup(x)}</li>`).join('')}</ul>`); list = []; } };
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) { flush(); continue; }
    const math = line.match(/^@@HNL_DISPLAY_MATH_(\d+)@@$/);
    if (math) { flush(); out.push(`<div class="math-display" role="math">${latexReadableHtml(displayMath[Number(math[1])] || '')}</div>`); continue; }
    if (/^---+$/.test(line)) { flush(); out.push('<hr>'); continue; }
    const h = line.match(/^(#{1,4})\s+(.+)$/);
    if (h) { flush(); const n = Math.min(4, h[1].length); out.push(`<h${n}>${inlineMarkup(h[2])}</h${n}>`); continue; }
    const bullet = line.match(/^(?:[-*•]|\d+[.)])\s+(.+)$/);
    if (bullet) { list.push(bullet[1]); continue; }
    flush(); out.push(`<p>${inlineMarkup(line)}</p>`);
  }
  flush();
  return out.join('');
}
