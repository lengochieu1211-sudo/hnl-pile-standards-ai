// HNL v1.25.6 · Engineering Symbol & Formula Normalizer
// Normalize copied PDF/Word/LaTeX engineering text before deterministic parsing.
// Raw user text is never discarded; this module only creates a parser-friendly view.

const SUBSCRIPT_MAP = {
  '₀':'0','₁':'1','₂':'2','₃':'3','₄':'4','₅':'5','₆':'6','₇':'7','₈':'8','₉':'9',
  'ₐ':'a','ₑ':'e','ₕ':'h','ᵢ':'i','ⱼ':'j','ₖ':'k','ₗ':'l','ₘ':'m','ₙ':'n','ₒ':'o','ₚ':'p','ᵣ':'r','ₛ':'s','ₜ':'t','ᵤ':'u','ᵥ':'v','ₓ':'x'
};
const SUPERSCRIPT_MAP = {'⁰':'0','¹':'1','²':'2','³':'3','⁴':'4','⁵':'5','⁶':'6','⁷':'7','⁸':'8','⁹':'9'};
const GREEK = {
  'γ':'gamma','Γ':'Gamma','σ':'sigma','Σ':'sum','φ':'phi','ϕ':'phi','β':'beta','α':'alpha',
  'ν':'nu','ε':'epsilon','ξ':'xi','ζ':'zeta','θ':'theta','δ':'delta','Δ':'Delta','μ':'mu','π':'pi','ρ':'rho','τ':'tau'
};

function replaceChars(text,map){ return [...text].map(ch=>Object.prototype.hasOwnProperty.call(map,ch)?map[ch]:ch).join(''); }

export function normalizeEngineeringText(raw='') {
  let s=String(raw??'').normalize('NFKC');
  s=s.replace(/[\u00A0\u2007\u202F]/g,' ')
    .replace(/[−–—]/g,'-')
    .replace(/[×✕✖]/g,'x')
    .replace(/[÷]/g,'/')
    .replace(/[′’‘`]/g,"'")
    .replace(/[″“”]/g,'"');

  // Common LaTeX wrappers / commands from copied AI, PDF and Word content.
  // Clipboard sources often double-escape backslashes (\\sigma, \\frac). Collapse
  // only command-style duplicates so normal Windows paths are not touched.
  s=s.replace(/\\\\(?=[A-Za-z_()[\]{}])/g,'\\');

  // Flatten command subscripts before fraction parsing: \sigma_{cu} -> \sigma_cu.
  // This removes nested braces so \frac{\sigma_{cu}}{3,5} can be normalized safely.
  s=s.replace(/\\([A-Za-z]+)_\s*\{\s*([^{}]+?)\s*\}/g,(_,cmd,sub)=>`\\${cmd}_${String(sub).replace(/\\max\b/g,'max').replace(/\s+/g,'')}`);

  // Resolve simple/nested LaTeX fractions before removing wrappers. This keeps copied
  // formulas parser-friendly instead of leaving `\frac{...}{...}` or dropping braces.
  for(let i=0;i<6;i++) {
    const prev=s;
    s=s.replace(/\\frac\s*\{([^{}]+)\}\s*\{([^{}]+)\}/g,'($1)/($2)')
      .replace(/\\sqrt\s*\{([^{}]+)\}/g,'sqrt($1)');
    if(s===prev) break;
  }

  s=s.replace(/\\(?:text|mathrm|mathbf|operatorname)\s*\{([^{}]*)\}/g,'$1')
    .replace(/\\(?:left|right)\b/g,'')
    .replace(/\\(?:,|;|!|quad|qquad)\b/g,' ')
    .replace(/\\times\b/g,'x')
    .replace(/\\cdot\b/g,'*')
    .replace(/\\approx(?=[^A-Za-z]|$)/g,'≈')
    .replace(/\\leq?(?=[^A-Za-z]|$)/g,'≤')
    .replace(/\\geq?(?=[^A-Za-z]|$)/g,'≥')
    .replace(/\\pm\b/g,'±')
    .replace(/\\gamma(?=[_\s{(]|$)/g,'gamma')
    .replace(/\\sigma(?=[_\s{(]|$)/g,'sigma')
    .replace(/\\phi(?=[_\s{(]|$)/g,'phi')
    .replace(/\\beta(?=[_\s{(]|$)/g,'beta')
    .replace(/\\alpha(?=[_\s{(]|$)/g,'alpha')
    .replace(/\\nu(?=[_\s{(]|$)/g,'nu')
    .replace(/\\epsilon(?=[_\s{(]|$)/g,'epsilon')
    .replace(/\\xi(?=[_\s{(]|$)/g,'xi')
    .replace(/\\zeta(?=[_\s{(]|$)/g,'zeta')
    .replace(/\\theta(?=[_\s{(]|$)/g,'theta')
    .replace(/\\delta(?=[_\s{(]|$)/g,'delta')
    .replace(/\\sum(?=[_\s{(]|$)/g,'sum')
    .replace(/\\pi(?=[_\s{(]|$)/g,'pi');

  // LaTeX sub/superscript braces: A_{p} -> A_p; N_{d,\\max} -> N_d,max; m^{2} -> m2.
  s=s.replace(/_\s*\{\s*([^{}]+?)\s*\}/g,(_,v)=>`_${String(v).replace(/\\max\b/g,'max').replace(/\s+/g,'')}`)
    .replace(/\^\s*\{\s*([0-9]+)\s*\}/g,'$1')
    .replace(/\^\s*([0-9]+)/g,'$1')
    .replace(/\\_/g,'_')
    .replace(/\\max\b/g,'max')
    .replace(/[\$]/g,'')
    .replace(/\\\(|\\\)|\\\[|\\\]/g,'');

  s=replaceChars(s,SUBSCRIPT_MAP);
  s=replaceChars(s,SUPERSCRIPT_MAP);
  for(const [g,name] of Object.entries(GREEK)) s=s.split(g).join(name);

  // Add a subscript separator for common unicode-subscript forms lost by NFKC only when obvious.
  s=s.replace(/\bA\s*p\b(?=\s*[=:≈])/gi,'Ap')
    .replace(/\bq\s*b\b(?=\s*[=:≈])/gi,'qb')
    .replace(/\bf\s*i\b(?=\s*[=:≈])/gi,'fi');

  // Units copied in multiple forms.
  s=s.replace(/\bm\s*\^?\s*2\b/gi,'m2')
    .replace(/\bmm\s*\^?\s*2\b/gi,'mm2')
    .replace(/\bm\s*\^?\s*3\b/gi,'m3')
    .replace(/\bmm\s*\^?\s*4\b/gi,'mm4')
    .replace(/kN\s*[·.]?\s*m\b/gi,'kN.m')
    .replace(/kN\s*\/\s*m\s*2\b/gi,'kN/m2');

  // Clipboard noise that commonly breaks engineering parsers. Keep the technical
  // content while removing citation/markdown wrappers that carry no numeric meaning.
  s=s.replace(/\[cite\s*:\s*[^\]]+\]/gi,' ')
    .replace(/\*\*(.*?)\*\*/g,'$1')
    .replace(/__(.*?)__/g,'$1')
    .replace(/[{}]/g,'')
    .replace(/[\u200B-\u200D\u2060\uFEFF]/g,'');

  // Recover a few frequent PDF/AI clipboard forms after slashes/braces were lost, e.g.
  // `fracσcu3,5` -> after Greek normalization `fracsigmacu3,5`.
  s=s.replace(/\bfrac\s*(sigma(?:cu|ce|sp|sc|s|b|bt|ser))\s*(\d+(?:[.,]\d+)?)/gi,'($1)/($2)')
    .replace(/\bfrac\s*([A-Za-z][A-Za-z0-9_,'-]{0,12})\s+(\d+(?:[.,]\d+)?)/gi,'($1)/($2)');

  // Normalize spacing but preserve new lines because geological layer parser uses them.
  s=s.replace(/[ \t]+/g,' ').replace(/ *\n */g,'\n').trim();
  return s;
}

/**
 * Clipboard-specific normalizer used by the Q&A and Calculation textareas.
 * It intentionally keeps line breaks and readable operators, while converting
 * Word/PDF/LaTeX variants to the same deterministic syntax consumed by the router.
 */
export function normalizeEngineeringPaste(raw='') {
  return normalizeEngineeringText(raw)
    .replace(/\r\n?/g,'\n')
    .replace(/\n{3,}/g,'\n\n')
    .trim();
}

export function canonicalEngineeringKey(raw='') {
  let s=normalizeEngineeringText(raw).toLocaleLowerCase('vi').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/đ/g,'d');
  return s.replace(/gamma/g,'g').replace(/sigma/g,'s').replace(/phi/g,'f').replace(/beta/g,'b').replace(/alpha/g,'a')
    .replace(/[^a-z0-9]/g,'');
}

function aliasPattern(alias='') {
  const s=normalizeEngineeringText(alias).replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
  // Formatting separators are optional: A_p, Ap, A p; R_bt,ser / Rbt,ser.
  return s.replace(/[_ ,-]+/g,"[\\s_,-]*");
}

/**
 * Extract a scalar written as `alias = value`, including equality chains such as
 * `A = A_p = 0,09 m²`. Alias matching is formatting-tolerant after normalization.
 */
export function extractEngineeringNumber(raw='', aliases=[], unitPattern='') {
  const text=normalizeEngineeringText(raw);
  const unit=unitPattern?`\\s*(?:${unitPattern})?`:'';
  for(const alias of aliases){
    const a=aliasPattern(alias);
    const assignment=`(?:=|:|≈|~)`;
    // Permit up to two intermediate symbolic aliases in a copied equality chain.
    const symbolic=`(?:[A-Za-z][A-Za-z0-9_,'-]*\\s*${assignment}\\s*)`;
    const re=new RegExp(`(?:^|[^A-Za-z0-9_])(?:${a})(?=$|\\s|[\\)\\]=:≈~])\\s*[\\)\\]]?\\s*${assignment}\\s*(?:${symbolic}){0,2}(-?\\d+(?:[.,]\\d+)?)${unit}`,'i');
    const m=text.match(re);
    if(m) return Number(String(m[1]).replace(',','.'));
    const plain=normalizeEngineeringText(alias).replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
    const direct=new RegExp(`(?:^|[^A-Za-z0-9_])(?:${plain})(?=\\s)\\s+(-?\\d+(?:[.,]\\d+)?)${unit}`,'i').exec(text);
    if(direct) return Number(String(direct[1]).replace(',','.'));
  }
  return null;
}

function convertLengthToM(value,unit){ return /mm/i.test(unit)?value/1000:value; }

export function inferPileGeometry(raw='') {
  const text=normalizeEngineeringText(raw);
  const explicitArea=extractEngineeringNumber(text,['Ap','A_p','A','diện tích mũi','dien tich mui','diện tích tiết diện mũi','dien tich tiet dien mui'],'(?:m2|mm2)');
  let areaM2=explicitArea;
  // If explicit area is clearly written in mm2, convert it.
  if(explicitArea!=null){
    const m=text.match(/(?:Ap|A_p|\bA\b|diện tích[^=:\n]*)\s*(?:=|:|≈)\s*(?:[A-Za-z][A-Za-z0-9_,'-]*\s*(?:=|:|≈)\s*){0,2}-?\d+(?:[.,]\d+)?\s*(mm2|m2)/i);
    if(m && /mm2/i.test(m[1])) areaM2=explicitArea/1e6;
  }
  const explicitU=extractEngineeringNumber(text,['u','chu vi','chu vi thân cọc','chu vi than coc'],'(?:m|mm)');
  let perimeterM=explicitU;
  if(explicitU!=null){
    const um=text.match(/(?:\bu\b|chu vi[^=:\n]*)\s*(?:=|:|≈)\s*-?\d+(?:[.,]\d+)?\s*(mm|m)\b/i);
    if(um && /mm/i.test(um[1])) perimeterM=explicitU/1000;
  }

  let shape=null,sideM=null,diameterM=null,derivedAreaM2=null,derivedPerimeterM=null;
  const square=text.match(/(?:vu[oô]ng|square|ti[eế]t di[eệ]n)?\s*(\d+(?:[.,]\d+)?)\s*x\s*(\d+(?:[.,]\d+)?)\s*(mm|m)\b/i);
  if(square){
    const a=convertLengthToM(Number(square[1].replace(',','.')),square[3]);
    const b=convertLengthToM(Number(square[2].replace(',','.')),square[3]);
    if(Math.abs(a-b)<=Math.max(a,b)*0.01){ shape='square'; sideM=(a+b)/2; derivedAreaM2=a*b; derivedPerimeterM=2*(a+b); }
  }
  if(!shape){
    const side=extractEngineeringNumber(text,['cạnh','canh','a'],'(?:m|mm)');
    if(side!=null){
      const sm=text.match(/(?:cạnh|canh|(?:^|[^A-Za-z0-9_])a)\s*(?:=|:|≈)?\s*\d+(?:[.,]\d+)?\s*(mm|m)\b/i);
      sideM=sm&&/mm/i.test(sm[1])?side/1000:side; shape='square'; derivedAreaM2=sideM*sideM; derivedPerimeterM=4*sideM;
    }
  }
  if(!shape){
    const d=extractEngineeringNumber(text,['D','d','đường kính','duong kinh'],'(?:m|mm)');
    if(d!=null){
      const dm=text.match(/(?:đường kính|duong kinh|(?:^|[^A-Za-z0-9_])[dD])\s*(?:=|:|≈)?\s*\d+(?:[.,]\d+)?\s*(mm|m)\b/i);
      diameterM=dm&&/mm/i.test(dm[1])?d/1000:d; shape='circle'; derivedAreaM2=Math.PI*diameterM*diameterM/4; derivedPerimeterM=Math.PI*diameterM;
    }
  }

  if(areaM2==null && derivedAreaM2!=null) areaM2=derivedAreaM2;
  if(perimeterM==null && derivedPerimeterM!=null) perimeterM=derivedPerimeterM;
  const areaConflict=explicitArea!=null&&derivedAreaM2!=null&&Math.abs(areaM2-derivedAreaM2)>Math.max(1e-9,Math.abs(derivedAreaM2)*0.01);
  const perimeterConflict=explicitU!=null&&derivedPerimeterM!=null&&Math.abs(perimeterM-derivedPerimeterM)>Math.max(1e-9,Math.abs(derivedPerimeterM)*0.01);
  return {shape,sideM,diameterM,areaM2,perimeterM,derivedAreaM2,derivedPerimeterM,areaConflict,perimeterConflict,normalizedText:text};
}
