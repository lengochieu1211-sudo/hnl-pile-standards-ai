export const P32_PROMOTION_STATE = 'SHADOW_ONLY';
export const P32_REPORT_SCHEMA = 'HNL_P32_REAL_PDF_EVIDENCE_V1';

export function foldText(value = '') {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd').replace(/Đ/g, 'D')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

export function matchDocumentToCorpus(doc = {}, corpusDocument = {}) {
  const hay = foldText([doc.name, doc.standard, doc.sourcePath].filter(Boolean).join(' '));
  const groups = Array.isArray(corpusDocument.matchAny) ? corpusDocument.matchAny : [];
  if (!groups.length) return false;
  return groups.some(group => Array.isArray(group) && group.every(token => hay.includes(foldText(token))));
}

export function findCorpusDocument(doc = {}, documents = []) {
  return documents.find(item => matchDocumentToCorpus(doc, item)) || null;
}

export function normalizeBbox(value) {
  if (!Array.isArray(value) || value.length !== 4) return null;
  const box = value.map(Number);
  if (!box.every(Number.isFinite)) return null;
  const [x0, y0, x1, y1] = box;
  if (x0 < 0 || y0 < 0 || x1 > 1 || y1 > 1 || x1 <= x0 || y1 <= y0) return null;
  return box;
}

export function bboxIou(a, b) {
  const A = normalizeBbox(a), B = normalizeBbox(b);
  if (!A || !B) return 0;
  const ix0 = Math.max(A[0], B[0]), iy0 = Math.max(A[1], B[1]);
  const ix1 = Math.min(A[2], B[2]), iy1 = Math.min(A[3], B[3]);
  const iw = Math.max(0, ix1 - ix0), ih = Math.max(0, iy1 - iy0);
  const inter = iw * ih;
  const areaA = (A[2]-A[0]) * (A[3]-A[1]);
  const areaB = (B[2]-B[0]) * (B[3]-B[1]);
  const union = areaA + areaB - inter;
  return union > 0 ? inter / union : 0;
}

export function anchorCoverage(text = '', anchors = []) {
  const hay = foldText(text);
  const values = (anchors || []).map(String).filter(Boolean);
  if (!values.length) return { matched: [], total: 0, ratio: null };
  const matched = values.filter(anchor => hay.includes(foldText(anchor)));
  return { matched, total: values.length, ratio: matched.length / values.length };
}

function tokens(text = '') {
  return new Set(foldText(text).split(/[^0-9a-z]+/).filter(token => token.length >= 2));
}

export function tokenJaccard(a = '', b = '') {
  const A = tokens(a), B = tokens(b);
  if (!A.size && !B.size) return 1;
  const intersection = [...A].filter(x => B.has(x)).length;
  const union = new Set([...A, ...B]).size;
  return union ? intersection / union : 0;
}

export function normalizeCandidate(candidate = {}, anchors = []) {
  const text = String(candidate.text || '').trim();
  const available = candidate.available !== false && Boolean(text || candidate.available === true);
  const coverage = anchorCoverage(text, anchors);
  return {
    engine: String(candidate.engine || 'unknown'),
    available,
    code: candidate.code || null,
    text,
    chars: text.length,
    quality: candidate.quality || null,
    anchorCoverage: coverage,
    confidence: candidate.confidence ?? null,
    confidenceUsable: Boolean(candidate.confidenceUsable),
    reusedExistingVision: Boolean(candidate.reusedExistingVision),
    elapsedMs: Number.isFinite(Number(candidate.elapsedMs)) ? Number(candidate.elapsedMs) : null
  };
}

export function compareCandidateMatrix(candidates = []) {
  const usable = candidates.filter(x => x?.available && String(x?.text || '').trim());
  const pairs = [];
  for (let i = 0; i < usable.length; i++) {
    for (let j = i + 1; j < usable.length; j++) {
      pairs.push({
        a: usable[i].engine,
        b: usable[j].engine,
        similarity: Number(tokenJaccard(usable[i].text, usable[j].text).toFixed(6))
      });
    }
  }
  return pairs;
}

export function pageMatchesCase(page, caseDef = {}) {
  const hints = Array.isArray(caseDef.pageHints) ? caseDef.pageHints.map(Number).filter(Number.isFinite) : [];
  return !hints.length || hints.includes(Number(page));
}

export function evaluateCase(caseDef = {}, runs = []) {
  const list = Array.isArray(runs) ? runs : [];
  const required = Math.max(1, Number(caseDef.requiredRuns) || 1);
  const pageSet = new Set(list.map(run => Number(run?.page)).filter(Boolean));
  const viewportSet = new Set(list.map(run => {
    const s = run?.provenance?.pageSizeCss || {};
    return `${Math.round(Number(s.width)||0)}x${Math.round(Number(s.height)||0)}`;
  }).filter(x => x !== '0x0'));

  const provenancePass = list.every(run =>
    run?.promotionState === P32_PROMOTION_STATE &&
    run?.productionMutationAllowed === false &&
    Boolean(run?.fingerprint) &&
    Boolean(Number(run?.page)) &&
    Boolean(normalizeBbox(run?.provenance?.normalizedBbox))
  );

  const pagesPass = list.every(run => pageMatchesCase(run?.page, caseDef));
  const distinctPagesPass = !caseDef.requireDistinctPages || pageSet.size >= Math.min(required, (caseDef.pageHints || []).length || required);
  const distinctViewportsPass = !caseDef.requireDistinctViewports || viewportSet.size >= 2;

  let zoomIou = null;
  let zoomPass = true;
  if (caseDef.requireDistinctViewports && list.length >= 2) {
    zoomIou = bboxIou(list[0]?.provenance?.normalizedBbox, list[1]?.provenance?.normalizedBbox);
    zoomPass = zoomIou >= Number(caseDef.bboxIouThreshold || 0.70);
  }

  const anchorRatios = list
    .map(run => run?.bestAnchorRatio)
    .filter(value => Number.isFinite(Number(value)))
    .map(Number);
  const anchorPass = !anchorRatios.length || Math.max(...anchorRatios) > 0;

  const deepDocPolicyPass = list.every(run => {
    const deep = (run?.candidates || []).find(x => String(x?.engine || '').includes('deepdoc'));
    return !deep || deep.confidenceUsable === false;
  });
  const noDuplicateVisionPass = list.every(run => {
    const vision = (run?.candidates || []).find(x => String(x?.engine || '').includes('vision'));
    return !vision?.available || vision.reusedExistingVision === true;
  });

  const enoughRuns = list.length >= required;
  const passed = enoughRuns && provenancePass && pagesPass && distinctPagesPass &&
    distinctViewportsPass && zoomPass && anchorPass && deepDocPolicyPass && noDuplicateVisionPass;

  return {
    caseId: caseDef.id,
    title: caseDef.title,
    requiredRuns: required,
    capturedRuns: list.length,
    enoughRuns,
    provenancePass,
    pagesPass,
    distinctPagesPass,
    distinctViewportsPass,
    zoomIou: zoomIou == null ? null : Number(zoomIou.toFixed(6)),
    zoomPass,
    anchorPass,
    deepDocPolicyPass,
    noDuplicateVisionPass,
    state: passed ? 'BENCHMARKED' : list.length ? 'REVIEW' : 'PENDING'
  };
}

export function buildEvidenceReport({ corpus, runsByCase = {}, environment = {} } = {}) {
  const cases = (corpus?.cases || []).map(caseDef => evaluateCase(caseDef, runsByCase[caseDef.id] || []));
  const allBenchmarked = cases.length > 0 && cases.every(item => item.state === 'BENCHMARKED');
  return {
    schema: P32_REPORT_SCHEMA,
    researchVersion: corpus?.researchVersion || 'v1.27.0-P3.2',
    promotionState: P32_PROMOTION_STATE,
    productionMutationAllowed: false,
    certificationMeaning: 'Real-PDF evidence only; never numeric VERIFIED and never Production promotion by itself.',
    corpusSchema: corpus?.schema || null,
    containsPdfBytes: false,
    generatedAt: new Date().toISOString(),
    environment,
    caseResults: cases,
    overallState: allBenchmarked ? 'BENCHMARKED' : 'PARTIAL_REVIEW',
    runsByCase
  };
}
