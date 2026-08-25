/**
 * HNL Pile Standards AI v1.25.7
 * P1 Pass 4 — TM SCT Coc Formula Pattern Reconstruction
 *
 * STATUS: REVIEW / logical pattern reconstruction.
 *
 * Evidence available from prior workbook audit:
 * - TM SCT Coc = 6,082 Excel formulas, 0 UDF/XLL.
 * - Inputs: Point Coordinates + Nodal Reactions + Point Spring Assignments + Rd.
 * - Intermediate: match pile/point/load + utilization.
 * - Output: per-pile check.
 *
 * Exact XLSM cell/range inventory is NOT available in the current artifact set.
 * Therefore this module reconstructs and traces the deterministic dependency
 * blocks without inventing per-block XLSM formula counts or cell addresses.
 */

const EPS = 1e-10;

export const TM_SCT_COC_PATTERN_STATUS = Object.freeze({
  id: "tm-sct-coc-formula-pattern",
  status: "REVIEW",
  productionNumeric: false,
  workbookFormulaCount: 6082,
  workbookUdfCount: 0,
  exactCellInventory: false
});

export const TM_SCT_COC_BLOCKS = Object.freeze([
  {
    id: "JOIN",
    order: 1,
    role: "Resolve point -> coordinate -> spring/pile -> selected nodal reaction.",
    evidence: "Point Coordinates + Point Spring Assignments + Nodal Reactions",
    xlsmCells: "PENDING_CELL_INVENTORY",
    formulaCount: "PENDING_CELL_INVENTORY",
    status: "RECONSTRUCTED_LOGIC_REVIEW"
  },
  {
    id: "ACTION",
    order: 2,
    role: "Normalize imported axial reaction sign and retain imported action metadata.",
    evidence: "Nodal Reactions outputs Fx,Fy,Fz,Mx,My,Mz",
    xlsmCells: "PENDING_CELL_INVENTORY",
    formulaCount: "PENDING_CELL_INVENTORY",
    status: "RECONSTRUCTED_LOGIC_REVIEW"
  },
  {
    id: "CAPACITY",
    order: 3,
    role: "Resolve verified pile compression capacity; require separate verified tension capacity.",
    evidence: "TM SCT Coc input includes Rd; HNL uses upstream VERIFIED capacity provenance.",
    xlsmCells: "PENDING_CELL_INVENTORY",
    formulaCount: "PENDING_CELL_INVENTORY",
    status: "HNL_POLICY_VERIFIED_UPSTREAM_XLSM_MAPPING_REVIEW"
  },
  {
    id: "UTILIZATION",
    order: 4,
    role: "Compute demand/capacity utilization with compression/tension separation.",
    evidence: "Workbook audit explicitly identifies utilization intermediate.",
    xlsmCells: "PENDING_CELL_INVENTORY",
    formulaCount: "PENDING_CELL_INVENTORY",
    status: "RECONSTRUCTED_LOGIC_REVIEW"
  },
  {
    id: "STATUS",
    order: 5,
    role: "Classify PASS/FAIL/BLOCK and determine governing pile/combination.",
    evidence: "Workbook audit identifies per-pile check output.",
    xlsmCells: "PENDING_CELL_INVENTORY",
    formulaCount: "PENDING_CELL_INVENTORY",
    status: "RECONSTRUCTED_LOGIC_REVIEW"
  }
]);

function s(v, name) {
  const x = String(v ?? "").trim();
  if (!x) throw new Error(`${name} is required`);
  return x;
}
function n(v, name) {
  const x = Number(v);
  if (!Number.isFinite(x)) throw new Error(`${name} must be finite`);
  return x;
}
function uniqueMap(rows, keyFn, label) {
  const m = new Map();
  for (const row of rows ?? []) {
    const key = keyFn(row);
    if (m.has(key)) throw new Error(`Duplicate ${label}: ${key}`);
    m.set(key, row);
  }
  return m;
}
function normalizeFz(fz, sign) {
  const raw = n(fz, "Fz");
  if (sign === "compression-negative") return -raw;
  if (sign === "compression-positive") return raw;
  throw new Error(`Unsupported reaction sign convention: ${sign}`);
}

/**
 * One-row traced reconstruction of:
 * JOIN -> ACTION -> CAPACITY -> UTILIZATION -> STATUS
 */
export function traceTmSctCocRow({
  pointId,
  combinationId,
  pointCoordinates,
  pointSpringAssignments,
  nodalReactions,
  pileCapacities,
  reactionCompressionSign = "compression-negative"
}) {
  const pid = s(pointId, "pointId");
  const combo = s(combinationId, "combinationId");

  const coords = uniqueMap(
    pointCoordinates, r => s(r.pointId ?? r.point ?? r.nodeId, "coordinate.pointId"), "coordinate pointId"
  );
  const springs = uniqueMap(
    pointSpringAssignments, r => s(r.pointId ?? r.point ?? r.nodeId, "spring.pointId"), "spring pointId"
  );
  const caps = uniqueMap(
    pileCapacities, r => s(r.pileId, "capacity.pileId"), "capacity pileId"
  );
  const selected = (nodalReactions ?? []).filter(
    r => String(r.combinationId ?? r.caseCombo ?? r.combo ?? "").trim() === combo
  );
  const reactions = uniqueMap(
    selected, r => s(r.pointId ?? r.point ?? r.nodeId, "reaction.pointId"), `reaction pointId @ ${combo}`
  );

  // JOIN
  const coordinate = coords.get(pid) ?? null;
  const spring = springs.get(pid) ?? null;
  const reaction = reactions.get(pid) ?? null;
  const pileId = spring ? s(spring.pileId ?? spring.springId ?? spring.springName, `${pid}.pileId`) : null;
  const capacity = pileId ? (caps.get(pileId) ?? null) : null;

  const missing = [];
  if (!coordinate) missing.push("Point Coordinates");
  if (!spring) missing.push("Point Spring Assignments");
  if (!reaction) missing.push("Nodal Reactions");
  if (spring && !capacity) missing.push("Pile capacity");

  const join = {
    status: missing.length ? "BLOCK" : "PASS",
    pointId: pid,
    combinationId: combo,
    pileId,
    coordinate: coordinate ? {
      x: n(coordinate.x ?? coordinate.X, `${pid}.x`),
      y: n(coordinate.y ?? coordinate.Y, `${pid}.y`),
      z: coordinate.z ?? coordinate.Z ?? null
    } : null,
    missing
  };

  if (missing.length) {
    return {
      overall: "BLOCK",
      blockingBlock: "JOIN",
      trace: { JOIN: join, ACTION: null, CAPACITY: null, UTILIZATION: null, STATUS: null }
    };
  }

  // ACTION
  const rawFzKn = n(reaction.Fz ?? reaction.fz ?? reaction.F3 ?? reaction.f3, `${pid}.Fz`);
  const demandKn = normalizeFz(rawFzKn, reactionCompressionSign);
  const checkType = demandKn >= -EPS ? "COMPRESSION" : "TENSION";
  const action = {
    status: "PASS",
    rawFzKn,
    demandKn,
    checkType,
    reactionCompressionSign,
    metadata: {
      FxKn: reaction.Fx ?? reaction.fx ?? reaction.F1 ?? reaction.f1 ?? null,
      FyKn: reaction.Fy ?? reaction.fy ?? reaction.F2 ?? reaction.f2 ?? null,
      MxKnm: reaction.Mx ?? reaction.mx ?? reaction.M1 ?? reaction.m1 ?? null,
      MyKnm: reaction.My ?? reaction.my ?? reaction.M2 ?? reaction.m2 ?? null,
      MzKnm: reaction.Mz ?? reaction.mz ?? reaction.M3 ?? reaction.m3 ?? null
    }
  };

  // CAPACITY
  const compressionCapacityKn = n(
    capacity.compressionCapacityKn ?? capacity.RpileKn ?? capacity.Rpile ?? capacity.Rd,
    `${pileId}.compressionCapacityKn`
  );
  if (!(compressionCapacityKn > 0)) throw new Error(`${pileId}.compressionCapacityKn must be > 0`);

  let tensionCapacityKn = null;
  if (capacity.tensionCapacityKn != null) {
    tensionCapacityKn = n(capacity.tensionCapacityKn, `${pileId}.tensionCapacityKn`);
    if (tensionCapacityKn < 0) throw new Error(`${pileId}.tensionCapacityKn must be >= 0`);
  }

  const capacityUsedKn = checkType === "COMPRESSION" ? compressionCapacityKn :
    (tensionCapacityKn != null && tensionCapacityKn > 0 ? tensionCapacityKn : null);

  const capacityBlock = {
    status: capacityUsedKn == null ? "BLOCK" : "PASS",
    compressionCapacityKn,
    tensionCapacityKn,
    capacityUsedKn,
    provenance: capacity.source ?? capacity.provenance ?? "UPSTREAM_HNL_REQUIRED"
  };

  if (capacityUsedKn == null) {
    return {
      overall: "BLOCK",
      blockingBlock: "CAPACITY",
      trace: {
        JOIN: join, ACTION: action, CAPACITY: capacityBlock, UTILIZATION: null,
        STATUS: { status: "BLOCK", reason: "NO_VERIFIED_TENSION_CAPACITY" }
      }
    };
  }

  // UTILIZATION
  const utilization = (checkType === "COMPRESSION" ? Math.max(0, demandKn) : Math.abs(demandKn)) / capacityUsedKn;
  const utilizationBlock = {
    status: "PASS",
    demandAbsKn: checkType === "COMPRESSION" ? Math.max(0, demandKn) : Math.abs(demandKn),
    capacityUsedKn,
    utilization
  };

  // STATUS
  const pass = utilization <= 1 + EPS;
  const status = {
    status: pass ? "PASS" : "FAIL",
    pass,
    utilization,
    reserveKn: capacityUsedKn - utilizationBlock.demandAbsKn,
    boundary: Math.abs(utilization - 1) <= EPS ? "AT_CAPACITY" : (utilization < 1 ? "BELOW_CAPACITY" : "ABOVE_CAPACITY")
  };

  return {
    overall: status.status,
    blockingBlock: null,
    pileId,
    pointId: pid,
    combinationId: combo,
    trace: {
      JOIN: join,
      ACTION: action,
      CAPACITY: capacityBlock,
      UTILIZATION: utilizationBlock,
      STATUS: status
    }
  };
}

export function reconstructTmSctCocFixture({
  pointCoordinates,
  pointSpringAssignments,
  nodalReactions,
  pileCapacities,
  combinationIds,
  reactionCompressionSign = "compression-negative"
}) {
  const combos = combinationIds?.length
    ? combinationIds.map(x => s(x, "combinationId"))
    : [...new Set((nodalReactions ?? []).map(r => s(r.combinationId ?? r.caseCombo ?? r.combo, "reaction.combinationId")))];
  if (!combos.length) throw new Error("No combinationIds available");

  const points = [...new Set((pointSpringAssignments ?? []).map(r => s(r.pointId ?? r.point ?? r.nodeId, "spring.pointId")))];
  if (!points.length) throw new Error("No point spring assignments available");

  const rows = [];
  for (const combo of combos) {
    for (const pointId of points) {
      rows.push(traceTmSctCocRow({
        pointId, combinationId: combo, pointCoordinates, pointSpringAssignments,
        nodalReactions, pileCapacities, reactionCompressionSign
      }));
    }
  }

  const completed = rows.filter(r => r.trace?.STATUS && r.overall !== "BLOCK");
  const comparable = completed.filter(r => Number.isFinite(r.trace.STATUS.utilization));
  const governing = comparable.length
    ? comparable.reduce((a,b) => a.trace.STATUS.utilization >= b.trace.STATUS.utilization ? a : b)
    : null;

  return {
    status: "REVIEW",
    productionNumeric: false,
    formulaPopulation: {
      totalWorkbookFormulas: 6082,
      blockCounts: "PENDING_CELL_INVENTORY"
    },
    blocks: TM_SCT_COC_BLOCKS,
    rows,
    summary: {
      totalRows: rows.length,
      pass: rows.filter(r => r.overall === "PASS").length,
      fail: rows.filter(r => r.overall === "FAIL").length,
      block: rows.filter(r => r.overall === "BLOCK").length,
      governing: governing ? {
        pileId: governing.pileId,
        pointId: governing.pointId,
        combinationId: governing.combinationId,
        utilization: governing.trace.STATUS.utilization
      } : null
    },
    exactXlsmCellEquivalence: false
  };
}
