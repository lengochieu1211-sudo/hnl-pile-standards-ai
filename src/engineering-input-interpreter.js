import { normalizeEngineeringText, extractEngineeringNumber } from './engineering-text-normalizer.js';

export const ENGINEERING_INPUT_INTERPRETER_STATUS = Object.freeze({
  id: 'v26-ai-input-interpreter',
  version: '1.25.7-v26',
  role: 'AI_ASSISTED_INPUT_EXTRACTION_ONLY',
  calculationOwner: 'DETERMINISTIC_LOCKED_ENGINES',
  rules: Object.freeze([
    'AI_MAY_EXTRACT_INPUTS_AND_SEMANTICS',
    'AI_MUST_NOT_SUPPLY_ENGINEERING_RESULTS',
    'RAW_TEXT_SCALARS_OVERRIDE_AI',
    'FORMULAS_ARE_NOT_SCALAR_VALUES',
    'UNSUPPORTED_OR_UNPROVEN_AI_VALUES_ARE_IGNORED'
  ])
});

const number = value => {
  const n = Number(String(value ?? '').replace(',', '.'));
  return Number.isFinite(n) ? n : null;
};
const deaccent = value => normalizeEngineeringText(value).toLocaleLowerCase('vi').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd');
const escRe = value => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function aliasPattern(alias = '') {
  const s = normalizeEngineeringText(alias).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return s.replace(/[_ ,-]+/g, '[\\s_,-]*');
}

function formulaContinuation(after = '') {
  const tail = String(after || '').replace(/^\s+/, '');
  if (!tail) return false;
  // Reject the classic false-positive forms observed in production:
  // qb = 300ηNbar, fs = 2Ns, x = 3 * y, x = 2(y+1).
  return /^(?:[*/×x·+^()]|η\b|eta\b|N(?:s|c|bar|tb|tip)?\b|N̄|N̅|[A-Za-z][A-Za-z0-9_]*\s*(?:[*/×x·+^()]))/i.test(tail);
}

/**
 * Scalar-only extractor. It deliberately refuses a numeric coefficient when the
 * right-hand side continues as a formula/expression. It does not replace the
 * legacy extractor globally; callers opt into the formula guard where needed.
 */
export function extractEngineeringScalarNumber(raw = '', aliases = [], unitPattern = '') {
  const text = normalizeEngineeringText(raw);
  const unit = unitPattern ? `\\s*(?:${unitPattern})?` : '';
  for (const alias of aliases) {
    const a = aliasPattern(alias);
    const assignment = '(?:=|:|≈|~)';
    const symbolic = `(?:[A-Za-z][A-Za-z0-9_,'-]*\\s*${assignment}\\s*)`;
    const re = new RegExp(`(?:^|[^A-Za-z0-9_])(?:${a})(?=$|\\s|[\\)\\]=:≈~])\\s*[\\)\\]]?\\s*${assignment}\\s*(?:${symbolic}){0,2}(-?\\d+(?:[.,]\\d+)?)${unit}`, 'i');
    const m = re.exec(text);
    if (m) {
      const after = text.slice(m.index + m[0].length);
      if (formulaContinuation(after)) continue;
      return number(m[1]);
    }
    const plain = normalizeEngineeringText(alias).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const direct = new RegExp(`(?:^|[^A-Za-z0-9_])(?:${plain})(?=\\s)\\s+(-?\\d+(?:[.,]\\d+)?)${unit}`, 'i').exec(text);
    if (direct) return number(direct[1]);
  }
  return null;
}

function captureSource(text, regex) {
  const m = regex.exec(text);
  return m ? String(m[0]).trim() : '';
}

function scalarWithSource(raw, aliases, unitPattern = '') {
  const value = extractEngineeringScalarNumber(raw, aliases, unitPattern);
  if (value == null) return null;
  const normalized = normalizeEngineeringText(raw);
  const aliasGroup = aliases.map(aliasPattern).join('|');
  const re = new RegExp(`(?:${aliasGroup})[\\s\\S]{0,32}?(?:=|:|≈|~)?\\s*-?\\d+(?:[.,]\\d+)?(?:\\s*(?:${unitPattern || '[A-Za-z0-9/²³._-]+'}))?`, 'i');
  return { value, sourceText: captureSource(normalized, re) };
}

function findNbarTip(raw = '') {
  const direct = scalarWithSource(raw, ['N̄', 'N̅', 'Nbar', 'N_bar', 'Ntb', 'N_tip']);
  if (direct) return direct;
  const text = normalizeEngineeringText(raw);
  const m = text.match(/(?:SPT\s+trung\s*bình\s+vùng\s*mũi|N\s+trung\s*bình\s+vùng\s*mũi)[^\n=:\d]{0,24}(?:N̄|N̅|Nbar|N)?\s*(?:=|:)?\s*(\d+(?:[.,]\d+)?)/i);
  return m ? { value: number(m[1]), sourceText: m[0].trim() } : null;
}

function findNsShaft(raw = '') {
  const direct = scalarWithSource(raw, ['Ns', 'N_s', 'Nshaft', 'N_shaft']);
  if (direct) return direct;
  const text = normalizeEngineeringText(raw);
  const m = text.match(/(?:giá\s*trị\s*)?Ns\s+(?:trên\s+)?(?:toàn\s+)?thân\s+cọc\s*(?:=|:)?\s*(\d+(?:[.,]\d+)?)/i);
  return m ? { value: number(m[1]), sourceText: m[0].trim() } : null;
}

function getAiScalar(ai, key) {
  const field = ai?.scalars?.[key];
  const value = number(field?.value);
  return value == null ? null : { value, sourceText: String(field?.sourceText || '').trim(), confidence: number(field?.confidence) };
}

function sourceSupported(raw, item) {
  if (!item?.sourceText) return false;
  const hay = deaccent(raw).replace(/\s+/g, ' ');
  const needle = deaccent(item.sourceText).replace(/\s+/g, ' ').trim();
  return Boolean(needle) && hay.includes(needle);
}

function deterministicOrAi(raw, deterministic, ai, key) {
  if (deterministic?.value != null) return { ...deterministic, origin: 'RAW_TEXT' };
  const candidate = getAiScalar(ai, key);
  if (candidate && sourceSupported(raw, candidate)) return { ...candidate, origin: 'AI_EXTRACTED_VERBATIM' };
  return null;
}

export function buildEngineeringInputInterpreterPrompt(question = '') {
  return `Bạn là HNL Engineering Input Interpreter V26. Nhiệm vụ DUY NHẤT: trích dữ liệu đầu vào từ đề bài; KHÔNG tính kết quả kỹ thuật.\n\nQUY TẮC BẮT BUỘC:\n1) Phân biệt GIÁ TRỊ VÔ HƯỚNG/SỐ với CÔNG THỨC. Ví dụ \"qb = 300ηN̄\" là FORMULA, tuyệt đối không ghi qb=300. \"fs = 2Ns ≤ 100\" là FORMULA+LIMIT, tuyệt đối không ghi fs=2.\n2) Chỉ trích số có trong đề; không tự sáng tác. Mỗi scalar phải có sourceText trích nguyên văn ngắn từ đề.\n3) Không trả qb, fs, Rb, Rs, Rk, Rd, Nd,max dưới dạng kết quả tính. Các đại lượng đó thuộc Calculation Engine deterministic.\n4) Có thể nhận diện ngữ nghĩa: loại cọc, đất cát/đất dính, mũi kín/hở, Ns áp dụng toàn thân.\n5) Chỉ trả JSON thuần, không markdown.\n\nSCHEMA:\n{"schema":"HNL-V26-AI-INPUT","workflowHint":"10304-spt","scalars":{"lengthM":{"value":null,"unit":"m","sourceText":"","confidence":0},"eta":{"value":null,"unit":"-","sourceText":"","confidence":0},"nBarTip":{"value":null,"unit":"blows","sourceText":"","confidence":0},"nsShaft":{"value":null,"unit":"blows","sourceText":"","confidence":0},"gammaK":{"value":null,"unit":"-","sourceText":"","confidence":0},"gammaN":{"value":null,"unit":"-","sourceText":"","confidence":0}},"semantics":{"pileType":"driven|bored|screw|unknown","closedTip":true,"soilGroup":"sand|clay|unknown","shaftCoverage":"full|partial|unknown"},"formulas":[{"target":"qb|fs","expression":"","limit":null,"unit":"kPa","sourceText":""}]}\n\nĐỀ BÀI:\n${String(question || '')}`;
}

export function parseEngineeringInputInterpreterResponse(raw = '') {
  let text = String(raw || '').trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
  const first = text.indexOf('{'), last = text.lastIndexOf('}');
  if (first < 0 || last <= first) throw new Error('AI Input Interpreter không trả JSON hợp lệ.');
  const obj = JSON.parse(text.slice(first, last + 1));
  const forbidden = ['qb', 'fs', 'Rb', 'Rs', 'Rk', 'Rc,k', 'Rd', 'NdMax', 'Nd,max', 'qbKpa', 'fsKpa', 'RkKn', 'RdKn', 'NdMaxKn'];
  const flat = JSON.stringify(obj);
  for (const key of forbidden) {
    const re = new RegExp(`"${escRe(key)}"\\s*:`, 'i');
    if (re.test(flat)) throw new Error(`AI Input Interpreter vi phạm: chứa kết quả kỹ thuật ${key}.`);
  }
  return {
    schema: 'HNL-V26-AI-INPUT',
    workflowHint: String(obj.workflowHint || ''),
    scalars: obj.scalars && typeof obj.scalars === 'object' ? obj.scalars : {},
    semantics: obj.semantics && typeof obj.semantics === 'object' ? obj.semantics : {},
    formulas: Array.isArray(obj.formulas) ? obj.formulas : [],
    raw: obj
  };
}

export function extractSptSummaryInputV26(question = '', aiExtraction = null) {
  const raw = String(question || '');
  const text = normalizeEngineeringText(raw);
  const norm = deaccent(raw);
  const length = deterministicOrAi(raw, scalarWithSource(raw, ['L', 'chiều dài', 'chieu dai'], '(?:m)?'), aiExtraction, 'lengthM');
  const eta = deterministicOrAi(raw, scalarWithSource(raw, ['η', 'eta']), aiExtraction, 'eta');
  const nBarTip = deterministicOrAi(raw, findNbarTip(raw), aiExtraction, 'nBarTip');
  const nsShaft = deterministicOrAi(raw, findNsShaft(raw), aiExtraction, 'nsShaft');
  const gammaK = deterministicOrAi(raw, scalarWithSource(raw, ['gamma_k', 'γk', 'gammak']), aiExtraction, 'gammaK');
  const gammaN = deterministicOrAi(raw, scalarWithSource(raw, ['gamma_n', 'γn', 'gamman']), aiExtraction, 'gammaN');

  const rawPileType = /coc\s*(?:dong|ep)|\b(?:dong|ep)\b/.test(norm) ? 'driven' : (/coc\s*(?:khoan|nhoi)/.test(norm) ? 'bored' : (/coc\s*vit/.test(norm) ? 'screw' : 'unknown'));
  const aiPileType = String(aiExtraction?.semantics?.pileType || '').toLowerCase();
  const pileType = rawPileType !== 'unknown' ? rawPileType : (['driven', 'bored', 'screw'].includes(aiPileType) ? aiPileType : 'unknown');
  const rawSoil = /dat\s*cat|\bcat\b|sand/.test(norm) ? 'sand' : (/dat\s*dinh|\bset\b|clay/.test(norm) ? 'clay' : 'unknown');
  const aiSoil = String(aiExtraction?.semantics?.soilGroup || '').toLowerCase();
  const soilGroup = rawSoil !== 'unknown' ? rawSoil : (['sand', 'clay'].includes(aiSoil) ? aiSoil : 'unknown');
  const fullShaftRaw = /(?:tren\s+)?toan\s+than\s+coc|toan\s+bo\s+than\s+coc|whole\s+shaft/.test(norm);
  const fullShaft = fullShaftRaw || aiExtraction?.semantics?.shaftCoverage === 'full';
  const closedTip = !/(?:ho\s+mui|mui\s+ho|open\s+tip)/.test(norm) && (/(?:mui\s+kin|closed\s+tip)/.test(norm) || aiExtraction?.semantics?.closedTip === true);

  const qbLegacy = extractEngineeringNumber(raw, ['qb', 'q_b'], '(?:kPa|kN/m2|kN/m²)?');
  const qbScalar = extractEngineeringScalarNumber(raw, ['qb', 'q_b'], '(?:kPa|kN/m2|kN/m²)?');
  const fsLegacy = extractEngineeringNumber(raw, ['fs', 'f_s'], '(?:kPa|kN/m2|kN/m²)?');
  const fsScalar = extractEngineeringScalarNumber(raw, ['fs', 'f_s'], '(?:kPa|kN/m2|kN/m²)?');

  return {
    schema: 'HNL-V26-SPT-SUMMARY-INPUT',
    lengthM: length?.value ?? null,
    eta: eta?.value ?? null,
    nBarTip: nBarTip?.value ?? null,
    nsShaft: nsShaft?.value ?? null,
    gammaK: gammaK?.value ?? null,
    gammaN: gammaN?.value ?? null,
    pileType,
    soilGroup,
    fullShaft,
    closedTip,
    shaftLengthM: fullShaft && length?.value != null ? length.value : null,
    origins: { length, eta, nBarTip, nsShaft, gammaK, gammaN },
    formulaGuard: {
      qb: { legacyCandidate: qbLegacy, scalarCandidate: qbScalar, rejectedCoefficient: qbLegacy != null && qbScalar == null },
      fs: { legacyCandidate: fsLegacy, scalarCandidate: fsScalar, rejectedCoefficient: fsLegacy != null && fsScalar == null }
    },
    aiUsed: Boolean(aiExtraction),
    normalized: text
  };
}

export function shouldUseAiInputInterpreter(question = '') {
  const norm = deaccent(question);
  return /\bspt\b/.test(norm) && /\bcoc\b/.test(norm) && /\d/.test(norm);
}
