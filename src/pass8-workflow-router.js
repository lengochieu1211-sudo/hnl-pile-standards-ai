/**
 * HNL Pile Standards AI v1.25.7
 * P1 Pass 8 — One-Click Calculation UI / Workflow Router
 *
 * Responsibility:
 *   user-friendly request -> strict workflow selection -> Pass 7 LOCKED orchestration
 *   -> Vietnamese step explanation -> Excel export contract.
 *
 * This module MUST NOT implement engineering formulas. All numerical work remains
 * in previously LOCKED child engines.
 */

import { runPass7FullCalculationWorkflow } from './pass7-full-calculation-workflow.js';

export const PASS8_WORKFLOW_ROUTER_STATUS = Object.freeze({
  id: 'p1-pass8-one-click-workflow-router',
  version: '1.25.7',
  status: 'CORE_LOCKED_ROUTER_UI',
  language: 'vi-VN',
  role: 'UI_INPUT_NORMALIZATION_AND_LOCKED_WORKFLOW_ROUTING',
  children: Object.freeze({
    pass7FullCalculation: 'CORE_LOCKED_PATCH_V18',
    pass5CoreImporter: 'LOCKED',
    pass4ImportedReaction: 'LOCKED'
  }),
  forbidden: Object.freeze([
    'REIMPLEMENT_SOIL_CAPACITY_FORMULAS',
    'REIMPLEMENT_MATERIAL_CAPACITY_FORMULAS',
    'RIGID_CAP_REACTION_DISTRIBUTION',
    'MANUAL_UNVERIFIED_RPILE',
    'SILENT_UNIT_OR_SIGN_GUESSING',
    'CLAIM_DYNAMIC_EXCEL_EXPORT_WITHOUT_EXPORTER_ACK'
  ])
});

const finite = (v, name, { min = null, max = null, allowZero = false } = {}) => {
  const n = Number(v);
  if (!Number.isFinite(n)) throw new Error(`${name} phải là số hợp lệ.`);
  if (min != null && (allowZero ? n < min : n <= min)) throw new Error(`${name} phải ${allowZero ? '≥' : '>'} ${min}.`);
  if (max != null && n > max) throw new Error(`${name} phải ≤ ${max}.`);
  return n;
};

const text = (v, name) => {
  const s = String(v ?? '').trim();
  if (!s) throw new Error(`${name} không được để trống.`);
  return s;
};

function routePileWorkflow(pile = {}) {
  const shape = String(pile.shape ?? 'square').toLowerCase();
  if (shape !== 'square') {
    throw new Error('Pass 8 Production hiện chỉ mở cho cọc vuông trong Multi-Borehole LOCKED; hình dạng khác phải qua gate riêng.');
  }
  const construction = String(pile.constructionMethod ?? pile.method ?? 'driven').toLowerCase();
  if (['driven', 'hammer', 'pressed', 'press', 'dong', 'ep'].includes(construction)) {
    return { mechanicalWorkflowId: '10304-driven', method: 'hammer', sptPileType: 'driven', labelVi: 'Cọc đóng/ép · TCVN 10304:2025 §7.2.2' };
  }
  if (['bored', 'drilled', 'khoan', 'nhồi', 'nhoi'].includes(construction)) {
    return { mechanicalWorkflowId: '10304-bored', method: 'bored', sptPileType: 'bored', labelVi: 'Cọc khoan/nhồi · TCVN 10304:2025 §7.2.3' };
  }
  throw new Error(`Loại thi công cọc chưa có workflow Production LOCKED: ${construction || '(trống)'}.`);
}

function normalizeBoreholes(boreholes) {
  if (!Array.isArray(boreholes) || boreholes.length < 2) throw new Error('Cần tối thiểu 2 lỗ khoan cho workflow Multi-Borehole đã LOCKED.');
  return boreholes.map((b, i) => ({
    ...b,
    id: text(b.id ?? b.name ?? `HK${i + 1}`, `Mã lỗ khoan ${i + 1}`),
    layers: Array.isArray(b.layers) ? b.layers : [],
    sptPoints: Array.isArray(b.sptPoints) ? b.sptPoints : []
  }));
}

export function buildPass8CapacityInput(request = {}) {
  const pile = request.pile ?? {};
  const soil = request.soil ?? {};
  const material = request.material ?? {};
  const design = request.design ?? {};
  const route = routePileWorkflow(pile);

  const sideMm = finite(pile.sideMm, 'Cạnh cọc', { min: 0 });
  const lengthM = finite(pile.lengthM, 'Chiều dài cọc', { min: 0 });
  const tipDepthM = pile.tipDepthM == null ? lengthM : finite(pile.tipDepthM, 'Độ sâu mũi cọc', { min: 0 });
  const shaftStartDepthM = pile.shaftStartDepthM == null ? 0 : finite(pile.shaftStartDepthM, 'Độ sâu bắt đầu ma sát thân', { min: 0, allowZero: true });
  const gammaN = finite(design.gammaN ?? pile.gammaN ?? 1.15, 'γn', { min: 0 });

  return {
    mechanicalWorkflowId: route.mechanicalWorkflowId,
    pileInput: {
      shape: 'square',
      sideM: sideMm / 1000,
      lengthM,
      tipDepthM,
      shaftStartDepthM,
      maxSegmentM: finite(pile.maxSegmentM ?? 2, 'Chiều dài phân đoạn lớn nhất', { min: 0 }),
      gammaN
    },
    mechanicalInput: {
      ...(soil.mechanicalInput ?? {}),
      method: soil.mechanicalInput?.method ?? route.method,
      gammaK: finite(soil.mechanicalGammaK ?? soil.mechanicalInput?.gammaK ?? 1.4, 'γk cơ lý', { min: 0 })
    },
    sptInput: {
      ...(soil.sptInput ?? {}),
      gammaK: finite(soil.sptGammaK ?? soil.sptInput?.gammaK ?? 1.5, 'γk SPT', { min: 0 }),
      pileType: soil.sptInput?.pileType ?? route.sptPileType
    },
    materialInput: {
      grade: text(material.grade, 'Cấp bê tông'),
      steel: text(material.steel, 'Cấp thép'),
      shape: 'square',
      sideMm,
      widthMm: sideMm,
      heightMm: sideMm,
      AsTotMm2: finite(material.AsTotMm2, 'As,tot', { min: 0 }),
      L0Mm: finite(material.L0Mm, 'L0', { min: 0 }),
      e0Mm: finite(material.e0Mm, 'e0', { min: 0, allowZero: true }),
      e0IncludesRandom: material.e0IncludesRandom !== false,
      reinforcementOppositeSides: material.reinforcementOppositeSides !== false,
      loadDuration: material.loadDuration ?? 'long'
    },
    gammaN,
    boreholes: normalizeBoreholes(soil.boreholes)
  };
}

export function normalizePass8StructuralSource(structural = {}) {
  if (!structural || typeof structural !== 'object') throw new Error('Thiếu dữ liệu kết cấu.');
  const kind = String(structural.kind ?? '').trim().toUpperCase();
  if (kind === 'DCE_TABLES') {
    const tables = structural.tables ?? structural;
    return {
      kind: 'DCE_TABLES',
      tables,
      sourceId: structural.sourceId ?? 'PASS8_DCE_TABLES',
      nodalReactionCompressionSign: structural.nodalReactionCompressionSign ?? 'compression-positive',
      pierForceCompressionSign: structural.pierForceCompressionSign ?? 'compression-negative'
    };
  }
  if (kind === 'CSV') {
    if (structural.unitsProfile !== 'kN_m_C') throw new Error('CSV phải xác nhận profile đơn vị kN_m_C; Pass 8 không tự đoán đơn vị.');
    return {
      ...structural,
      kind: 'CSV',
      sourceId: structural.sourceId ?? 'PASS8_CSV'
    };
  }
  throw new Error('File kết cấu phải được Pass 5 chuẩn hóa thành DCE_TABLES hoặc CSV bundle. XLSM/ETABS raw phải đi qua adapter Pass 5 trước.');
}

export function buildPass8StepExplanation(result, routeLabel) {
  const s = result.summary;
  const rows = result.capacityBatch?.rows ?? [];
  const critical = result.capacityBatch?.criticalBoreholeId ?? result.capacityBatch?.soilMinimum?.boreholeId ?? '-';
  const criticalMethod = result.capacityBatch?.criticalMethodLabel ?? result.capacityBatch?.criticalMethodId ?? '-';
  return [
    { id: 'ROUTE', title: '1. Chọn workflow', status: 'ĐẠT', detail: routeLabel },
    { id: 'SOIL', title: '2. Tính sức chịu tải đất nền', status: 'ĐẠT', detail: `${rows.length} nhánh lỗ khoan × phương pháp; Rsoil,min=${s.RsoilKn.toFixed(3)} kN; bất lợi ${critical} · ${criticalMethod}.` },
    { id: 'MATERIAL', title: '3. Tính sức chịu tải vật liệu', status: 'ĐẠT', detail: `Rmaterial=${s.RmaterialKn.toFixed(3)} kN theo TCVN 5574:2018.` },
    { id: 'PILE', title: '4. Tổng hợp sức chịu tải cọc', status: 'ĐẠT', detail: `Rpile=min(Rsoil,Rmaterial)=${s.RpileKn.toFixed(3)} kN; γn=${s.gammaN}; Nd,max=${s.NdMaxPerPileKn.toFixed(3)} kN/cọc.` },
    { id: 'IMPORT', title: '5. Nhập dữ liệu kết cấu', status: 'ĐẠT', detail: `${result.structural.sourceKind}; ${result.structural.summary.pileCount} cọc, ${result.structural.summary.combinationCount} tổ hợp; Pass 5 chỉ parse/normalize/map/validate.` },
    { id: 'CHECK', title: '6. Kiểm phản lực từng cọc', status: result.structural.summary.overallPass ? 'ĐẠT' : 'KHÔNG ĐẠT/KHÓA', detail: `${result.structural.summary.passRows}/${result.structural.summary.checkRows} dòng ĐẠT; ${result.structural.summary.blockedRows} dòng KHÓA.` },
    { id: 'GOVERN', title: '7. Xác định cọc bất lợi', status: 'ĐẠT', detail: `Cọc ${s.governingPileId ?? '-'} · tổ hợp ${s.governingCombinationId ?? '-'} · hệ số sử dụng ${(s.governingUtilization ?? 0).toFixed(4)}.` },
    { id: 'CONCLUSION', title: '8. Kết luận', status: result.conclusion.statusVi, detail: result.conclusion.text }
  ];
}

export function buildPass8ExcelExportContract(result, request = {}) {
  const blocked = result.conclusion?.statusVi === 'KHÓA TÍNH' || (result.structural?.summary?.blockedRows ?? 0) > 0;
  return {
    schema: 'HNL-P1-PASS8-EXCEL-EXPORT-CONTRACT',
    version: '1.25.7',
    language: 'vi-VN',
    enabled: !blocked,
    template: 'HNL_P1_Pass7_Bao_Cao_Tinh_Toan_Coc_San_Xuat_v18.xlsx',
    endpoint: '/api/hnl/pile/export-excel',
    fileNameSuggestion: `HNL_Tinh_Toan_Coc_${result.summary.governingPileId ?? 'KetQua'}_v1.25.7.xlsx`,
    payload: {
      schema: 'HNL-P1-PASS8.1-EXCEL-EXPORT-REQUEST',
      version: '1.25.7',
      request,
      clientSummary: {
        RsoilKn: result.summary.RsoilKn,
        RmaterialKn: result.summary.RmaterialKn,
        RpileKn: result.summary.RpileKn,
        gammaN: result.summary.gammaN,
        NdMaxPerPileKn: result.summary.NdMaxPerPileKn,
        boreholeBranches: result.summary.boreholeBranches,
        pileChecks: result.summary.pileChecks,
        governingPileId: result.summary.governingPileId,
        governingCombinationId: result.summary.governingCombinationId,
        governingUtilization: result.summary.governingUtilization,
        conclusion: result.conclusion.statusVi
      },
      templateVersion: 'v18',
      exporterVersion: 'Pass8.1-v20'
    },
    blockedReason: blocked ? 'Kết quả có dòng KHÓA TÍNH; không cho xuất Excel Production.' : null,
    invariant: 'Exporter phải ghi kết quả Pass 8 vào template tiếng Việt v18; không tính lại công thức kỹ thuật trong UI.'
  };
}

export function runPass8OneClickCalculation(request = {}) {
  const route = routePileWorkflow(request.pile ?? {});
  const capacityInput = buildPass8CapacityInput(request);
  const structuralSource = normalizePass8StructuralSource(request.structural);
  const result = runPass7FullCalculationWorkflow({
    capacityInput,
    structuralSource,
    combinationIds: request.combinationIds ?? null,
    tensionPolicy: request.tensionPolicy ?? 'BLOCK_IF_NO_TENSION_CAPACITY',
    sourceArtifact: request.sourceArtifact ?? 'P1_PASS8_ONE_CLICK_RUNTIME'
  });
  const steps = buildPass8StepExplanation(result, route.labelVi);
  const excelExport = buildPass8ExcelExportContract(result, request);
  return {
    schema: 'HNL-P1-PASS8-ONE-CLICK-RESULT',
    version: '1.25.7',
    status: result.status,
    route: {
      mechanicalWorkflowId: route.mechanicalWorkflowId,
      labelVi: route.labelVi,
      structuralSourceKind: structuralSource.kind
    },
    result,
    steps,
    excelExport,
    ui: {
      language: 'vi-VN',
      primaryAction: 'TÍNH',
      exportAction: 'XUẤT EXCEL TIẾNG VIỆT',
      conclusion: result.conclusion.statusVi
    },
    provenance: {
      router: 'P1 Pass 8 orchestration only',
      calculation: 'P1 Pass 7 Core Locked v18',
      excelTemplate: 'Pass 7 Vietnamese Production Excel v18'
    }
  };
}
