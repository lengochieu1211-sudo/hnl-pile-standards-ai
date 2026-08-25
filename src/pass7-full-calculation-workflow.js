/**
 * HNL Pile Standards AI v1.25.7
 * P1 Pass 7 — Full Calculation Report / Excel Production Integration
 *
 * One orchestration entrypoint:
 *   locked soil/material engines -> Rpile -> gammaN -> Pass5 import ->
 *   Pass4 imported-reaction checker -> governing pile -> Vietnamese report model.
 *
 * This module does NOT reimplement child formulas. It calls child engines that
 * were independently LOCKED in prior passes and only composes their verified results.
 */

import { calculateMultiBoreholePileCapacity } from './multi-borehole-engine.js';
import { runPass6StructuralWorkflow } from './pass6-structural-workflow.js';

export const PASS7_FULL_CALCULATION_STATUS = Object.freeze({
  id: 'p1-pass7-full-calculation-report',
  version: '1.25.7',
  status: 'REVIEW_GOLDEN_IN_PROGRESS',
  role: 'ORCHESTRATE_LOCKED_CAPACITY_PLUS_LOCKED_STRUCTURAL_CHECK',
  language: 'vi-VN',
  childContracts: Object.freeze({
    multiBoreholeCapacity: 'LOCKED',
    pass5CoreImporter: 'LOCKED',
    pass4ImportedReaction: 'LOCKED',
    pass6StructuralOrchestration: 'LOCKED'
  }),
  forbidden: Object.freeze([
    'REIMPLEMENT_TCVN_TABLES_IN_PASS7',
    'RIGID_CAP_REACTION_DERIVATION',
    'MANUAL_UNVERIFIED_CAPACITY',
    'SILENT_SIGN_OR_UNIT_GUESSING'
  ])
});

function assertOk(condition, message) {
  if (!condition) throw new Error(message);
}

function capacityProfileFromBatch(batch, sourceArtifact = 'PASS7_MULTI_BOREHOLE_RUNTIME') {
  assertOk(batch?.ok === true && batch?.productionNumeric === true && batch?.status === 'VERIFIED',
    'Multi-Borehole capacity must be VERIFIED Production before structural checking');
  assertOk(Number.isFinite(Number(batch.pileResistanceMinKn)) && Number(batch.pileResistanceMinKn) > 0,
    'Multi-Borehole result is missing Rpile,min');
  assertOk(Number.isFinite(Number(batch.gammaN)) && Number(batch.gammaN) > 0,
    'Multi-Borehole result is missing gammaN');
  assertOk(Number.isFinite(Number(batch.NdMaxBatchKn)) && Number(batch.NdMaxBatchKn) > 0,
    'Multi-Borehole result is missing Nd,max');

  const materialResult = batch.materialResult ?? {};
  const materialResistanceKn = Number(materialResult.materialResistanceKn ?? materialResult.NuKn);
  const soilResistanceKn = Number(batch.soilMinimum?.valueKn);
  const pileResistanceKn = Number(batch.pileResistanceMinKn);
  const gammaN = Number(batch.gammaN);
  const demandLimitKn = Number(batch.NdMaxBatchKn);

  return {
    status: 'LOCKED_PASS7_DERIVED_FROM_VERIFIED_CHILDREN',
    RpileKn: pileResistanceKn,
    gammaN,
    NdMaxPerPileKn: demandLimitKn,
    sourceModule: 'MultiBoreholePileEngine + PileCapacityEngine + PileMaterialEngine',
    sourceArtifact,
    governingBasis: 'Rpile=min(Rsoil,Rmaterial); Nd,max=Rpile/gammaN',
    sourceBorehole: batch.criticalBoreholeId ?? batch.soilMinimum?.boreholeId ?? null,
    materialGoverning: batch.materialTie === true || batch.criticalRows?.every?.((x) => x?.governing === 'MATERIAL') === true,
    soilResistanceKn,
    materialResistanceKn,
    pileResistanceKn,
    demandLimitKn,
    criticalMethodId: batch.criticalMethodId ?? null,
    criticalMethodLabel: batch.criticalMethodLabel ?? null
  };
}

function vietnameseConclusion(structural, capacity, batch) {
  if (!structural?.summary?.overallPass) {
    const blocked = structural?.summary?.blockedRows ?? 0;
    const failed = structural?.summary?.failRows ?? 0;
    return {
      code: blocked > 0 ? 'KHOA_TINH' : 'KHONG_DAT',
      text: blocked > 0
        ? `KHÓA TÍNH: có ${blocked} dòng chưa đủ điều kiện kiểm tra an toàn.`
        : `KHÔNG ĐẠT: có ${failed} dòng vượt sức chịu tải cho phép của cọc.`,
      statusVi: blocked > 0 ? 'KHÓA TÍNH' : 'KHÔNG ĐẠT'
    };
  }
  const g = structural.governing;
  return {
    code: 'DAT',
    statusVi: 'ĐẠT',
    text: `ĐẠT: cọc bất lợi ${g?.pileId ?? '-'} · tổ hợp ${g?.combinationId ?? '-'} · hệ số sử dụng ${(Number(g?.utilization ?? 0)).toFixed(4)} ≤ 1,0000. ` +
      `Sức chịu tải cọc Rpile=${capacity.pileResistanceKn.toFixed(3)} kN; giới hạn tác động Nd,max=${capacity.demandLimitKn.toFixed(3)} kN/cọc. ` +
      `Địa chất bất lợi: ${batch.criticalBoreholeId ?? batch.soilMinimum?.boreholeId ?? '-'} · ${batch.criticalMethodLabel ?? batch.criticalMethodId ?? '-'}; ` +
      `${batch.materialTie ? 'vật liệu khống chế chung' : (capacity.soilResistanceKn <= capacity.materialResistanceKn ? 'đất nền khống chế' : 'vật liệu khống chế')}.`
  };
}

function buildVietnameseReportModel(batch, capacity, structural, conclusion) {
  return {
    tieuDe: 'BÁO CÁO TÍNH TOÁN SỨC CHỊU TẢI VÀ KIỂM TRA PHẢN LỰC CỌC',
    phienBan: '1.25.7',
    trangThai: conclusion.statusVi,
    ketLuan: conclusion.text,
    tongHop: {
      RsoilKn: capacity.soilResistanceKn,
      RmaterialKn: capacity.materialResistanceKn,
      RpileKn: capacity.pileResistanceKn,
      gammaN: capacity.gammaN,
      NdMaxMoiCocKn: capacity.demandLimitKn,
      loKhoanBatLoi: batch.criticalBoreholeId ?? batch.soilMinimum?.boreholeId ?? null,
      phuongPhapBatLoi: batch.criticalMethodLabel ?? batch.criticalMethodId ?? null,
      cocBatLoi: structural.governing?.pileId ?? null,
      toHopBatLoi: structural.governing?.combinationId ?? null,
      phanLucBatLoiKn: structural.governing?.demandKn ?? null,
      heSoSuDungBatLoi: structural.governing?.utilization ?? null
    },
    diaChat: batch.rows.map((r) => ({
      loKhoan: r.boreholeId,
      phuongPhap: r.methodLabel,
      QbKn: r.QbKn,
      QsKn: r.QsKn,
      RkKn: r.RkKn,
      RdKn: r.RdKn,
      RmaterialKn: r.RmaterialKn,
      RpileKn: r.RpileKn,
      NdMaxKn: r.NdMaxFinalKn,
      khongChe: r.governing === 'SOIL' ? 'ĐẤT NỀN' : r.governing === 'MATERIAL' ? 'VẬT LIỆU' : r.governing,
      lopDatMui: r.soilAtTip
    })),
    vatLieu: {
      status: batch.materialResult?.status,
      NuKn: capacity.materialResistanceKn,
      dauVao: batch.materialResult?.inputs ?? null,
      provenance: batch.materialResult?.provenance ?? null
    },
    kiemTraCoc: structural.rows.map((r) => ({
      coc: r.pileId,
      diem: r.pointId,
      toHop: r.combinationId,
      nhuCauKn: r.demandKn,
      sucChiuTaiChoPhepKn: r.capacityKn,
      heSoSuDung: r.utilization,
      trangThai: r.blockReason ? 'KHÓA TÍNH' : r.pass ? 'ĐẠT' : 'KHÔNG ĐẠT',
      lyDoKhoa: r.blockReason ?? null,
      x: r.x,
      y: r.y,
      loaiKiemTra: r.checkType
    })),
    provenance: {
      batch: batch.provenance,
      structural: structural.provenance,
      claimBoundary: 'Pass 7 chỉ ghép các engine đã khóa; không thay công thức TCVN hoặc phân phối phản lực.'
    }
  };
}

export function runPass7FullCalculationWorkflow({
  capacityInput,
  structuralSource,
  combinationIds = null,
  tensionPolicy = 'BLOCK_IF_NO_TENSION_CAPACITY',
  sourceArtifact = 'P1_PASS7_RUNTIME'
} = {}) {
  assertOk(capacityInput && typeof capacityInput === 'object', 'capacityInput is required');
  assertOk(structuralSource && typeof structuralSource === 'object', 'structuralSource is required');

  const batch = calculateMultiBoreholePileCapacity(capacityInput);
  assertOk(batch?.ok === true, `Capacity branch blocked: ${(batch?.issues ?? []).join(' | ') || batch?.status || 'UNKNOWN'}`);

  const capacity = capacityProfileFromBatch(batch, sourceArtifact);
  const structural = runPass6StructuralWorkflow({
    source: structuralSource,
    lockedCapacity: capacity,
    combinationIds,
    tensionPolicy
  });
  const conclusion = vietnameseConclusion(structural, capacity, batch);
  const report = buildVietnameseReportModel(batch, capacity, structural, conclusion);

  return {
    schema: 'HNL-P1-PASS7-FULL-CALCULATION-RESULT',
    version: '1.25.7',
    status: structural.summary.overallPass ? 'VERIFIED_PASS' : 'VERIFIED_FAIL_OR_BLOCK',
    productionNumeric: true,
    capacityBatch: batch,
    capacity,
    structural,
    governing: structural.governing,
    conclusion,
    report,
    summary: {
      RsoilKn: capacity.soilResistanceKn,
      RmaterialKn: capacity.materialResistanceKn,
      RpileKn: capacity.pileResistanceKn,
      gammaN: capacity.gammaN,
      NdMaxPerPileKn: capacity.demandLimitKn,
      boreholeBranches: batch.rows.length,
      pileChecks: structural.rows.length,
      governingPileId: structural.governing?.pileId ?? null,
      governingCombinationId: structural.governing?.combinationId ?? null,
      governingUtilization: structural.governing?.utilization ?? null,
      overallPass: structural.summary.overallPass
    },
    provenance: {
      soilMaterialCapacity: 'P1 Pass 2 LOCKED child engines',
      structuralImporter: 'P1 Pass 5 Core LOCKED',
      importedReactionCheck: 'P1 Pass 4 numeric core LOCKED',
      structuralOrchestration: 'P1 Pass 6 Core LOCKED',
      reportIntegration: 'P1 Pass 7 orchestration only'
    }
  };
}
