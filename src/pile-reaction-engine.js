/**
 * HNL Pile Standards AI v1.25.7
 * P1 Pass 4 — PileReactionEngine (REVIEW patch)
 *
 * IMPORTANT:
 * - This module is NOT LOCKED/VERIFIED yet.
 * - It implements a deterministic rigid-cap axial reaction model from static equilibrium.
 * - It must be benchmarked cell-by-cell against the real XLSM sheet `TM SCT Coc`
 *   before Production promotion.
 * - No ETABS/SAP importer is implemented here.
 */

const EPS = 1e-10;

export const PILE_REACTION_STATUS = Object.freeze({
  id: "pile-reaction-rigid-cap",
  status: "REVIEW",
  productionNumeric: false,
  sourceAuthority: "ENGINEERING_MODEL_REQUIRES_XLSM_BENCHMARK_AND_SOURCE_TRACE"
});

function finite(value, name) {
  const n = Number(value);
  if (!Number.isFinite(n)) throw new Error(`${name} must be a finite number`);
  return n;
}

function nonEmptyString(value, name) {
  const s = String(value ?? "").trim();
  if (!s) throw new Error(`${name} is required`);
  return s;
}

function solve3(A, b) {
  const m = A.map((row, i) => [...row.map(Number), Number(b[i])]);

  for (let col = 0; col < 3; col++) {
    let pivot = col;
    for (let r = col + 1; r < 3; r++) {
      if (Math.abs(m[r][col]) > Math.abs(m[pivot][col])) pivot = r;
    }
    if (Math.abs(m[pivot][col]) < EPS) {
      throw new Error("Pile layout is singular for N-Mx-My reaction distribution");
    }
    if (pivot !== col) [m[pivot], m[col]] = [m[col], m[pivot]];

    const div = m[col][col];
    for (let c = col; c < 4; c++) m[col][c] /= div;

    for (let r = 0; r < 3; r++) {
      if (r === col) continue;
      const f = m[r][col];
      for (let c = col; c < 4; c++) m[r][c] -= f * m[col][c];
    }
  }
  return [m[0][3], m[1][3], m[2][3]];
}

export function normalizePilePoints(points) {
  if (!Array.isArray(points) || points.length < 1) {
    throw new Error("pilePoints[] is required");
  }

  const ids = new Set();
  return points.map((p, index) => {
    const pileId = nonEmptyString(p.pileId ?? `P${index + 1}`, "pileId");
    if (ids.has(pileId)) throw new Error(`Duplicate pileId: ${pileId}`);
    ids.add(pileId);

    const x = finite(p.x, `${pileId}.x`);
    const y = finite(p.y, `${pileId}.y`);
    const compressionCapacityKn = finite(
      p.compressionCapacityKn ?? p.RpileKn ?? p.Rpile,
      `${pileId}.compressionCapacityKn`
    );
    if (!(compressionCapacityKn > 0)) {
      throw new Error(`${pileId}.compressionCapacityKn must be > 0`);
    }

    let tensionCapacityKn = null;
    if (p.tensionCapacityKn != null) {
      tensionCapacityKn = finite(p.tensionCapacityKn, `${pileId}.tensionCapacityKn`);
      if (tensionCapacityKn < 0) {
        throw new Error(`${pileId}.tensionCapacityKn must be >= 0`);
      }
    }

    return {
      pileId,
      x,
      y,
      compressionCapacityKn,
      tensionCapacityKn,
      size: p.size ?? p.diameter ?? null,
      sourceBorehole: p.sourceBorehole ?? null,
      method: p.method ?? null,
      materialGoverning: Boolean(p.materialGoverning),
      source: p.source ?? null
    };
  });
}

/**
 * Sign convention used by this REVIEW model:
 * - N > 0 = compression.
 * - Positive My contributes +N on piles with +x.
 * - Positive Mx contributes +N on piles with +y.
 *
 * Reaction field is assumed linear over the cap:
 *   Ni = a + b*x_i + c*y_i
 *
 * Coefficients satisfy:
 *   ΣNi      = N
 *   ΣNi*x_i  = My
 *   ΣNi*y_i  = Mx
 *
 * Using the full 3x3 equilibrium matrix avoids the common but unsafe
 * assumption Σxy = 0.
 */
export function calculatePileReactions({
  loadCombination,
  pilePoints,
  compressionSign = "compression-positive",
  tensionPolicy = "BLOCK_IF_NO_TENSION_CAPACITY"
}) {
  const pts = normalizePilePoints(pilePoints);
  if (pts.length < 2) {
    throw new Error("At least 2 piles are required for moment distribution");
  }

  const combinationId = nonEmptyString(
    loadCombination?.combinationId ?? loadCombination?.id,
    "combinationId"
  );

  const nRaw = finite(loadCombination?.N ?? loadCombination?.NKn ?? 0, "N");
  let N;
  if (compressionSign === "compression-positive") N = nRaw;
  else if (compressionSign === "compression-negative") N = -nRaw;
  else throw new Error(`Unsupported compressionSign: ${compressionSign}`);

  const Mx = finite(loadCombination?.Mx ?? loadCombination?.MxKnm ?? 0, "Mx");
  const My = finite(loadCombination?.My ?? loadCombination?.MyKnm ?? 0, "My");
  const Vx = finite(loadCombination?.Vx ?? loadCombination?.VxKn ?? 0, "Vx");
  const Vy = finite(loadCombination?.Vy ?? loadCombination?.VyKn ?? 0, "Vy");
  const T = finite(loadCombination?.T ?? loadCombination?.torsionKnm ?? 0, "T");

  const count = pts.length;
  const sx = pts.reduce((s, p) => s + p.x, 0);
  const sy = pts.reduce((s, p) => s + p.y, 0);
  const sxx = pts.reduce((s, p) => s + p.x * p.x, 0);
  const syy = pts.reduce((s, p) => s + p.y * p.y, 0);
  const sxy = pts.reduce((s, p) => s + p.x * p.y, 0);

  const [a, b, c] = solve3(
    [
      [count, sx, sy],
      [sx, sxx, sxy],
      [sy, sxy, syy]
    ],
    [N, My, Mx]
  );

  let anyUnverifiedTension = false;

  const reactions = pts.map((p) => {
    const demandKn = a + b * p.x + c * p.y;
    const inCompression = demandKn >= -EPS;

    let capacityKn;
    let utilization;
    let pass;
    let checkType;

    if (inCompression) {
      capacityKn = p.compressionCapacityKn;
      utilization = Math.max(0, demandKn) / capacityKn;
      pass = utilization <= 1 + EPS;
      checkType = "COMPRESSION";
    } else {
      checkType = "TENSION";
      const tensionDemand = -demandKn;

      if (p.tensionCapacityKn == null) {
        anyUnverifiedTension = true;
        capacityKn = null;
        utilization = null;
        pass = false;
      } else {
        capacityKn = p.tensionCapacityKn;
        utilization = capacityKn > 0 ? tensionDemand / capacityKn : Infinity;
        pass = utilization <= 1 + EPS;
      }
    }

    return {
      pileId: p.pileId,
      x: p.x,
      y: p.y,
      demandKn,
      checkType,
      capacityKn,
      utilization,
      pass,
      sourceBorehole: p.sourceBorehole,
      method: p.method,
      materialGoverning: p.materialGoverning
    };
  });

  const sumN = reactions.reduce((s, r) => s + r.demandKn, 0);
  const sumMy = reactions.reduce((s, r) => s + r.demandKn * r.x, 0);
  const sumMx = reactions.reduce((s, r) => s + r.demandKn * r.y, 0);

  const compressionRows = reactions.filter((r) => r.demandKn >= -EPS);
  const tensionRows = reactions.filter((r) => r.demandKn < -EPS);
  const maxCompressionPile = compressionRows.length
    ? compressionRows.reduce((a, b) => (a.demandKn >= b.demandKn ? a : b))
    : null;
  const maxTensionPile = tensionRows.length
    ? tensionRows.reduce((a, b) => (a.demandKn <= b.demandKn ? a : b))
    : null;

  const comparable = reactions.filter((r) => Number.isFinite(r.utilization));
  const governingPile = comparable.length
    ? comparable.reduce((a, b) => (a.utilization >= b.utilization ? a : b))
    : null;

  const equilibrium = {
    sumNKn: sumN,
    targetNKn: N,
    residualNKn: sumN - N,
    sumMxKnm: sumMx,
    targetMxKnm: Mx,
    residualMxKnm: sumMx - Mx,
    sumMyKnm: sumMy,
    targetMyKnm: My,
    residualMyKnm: sumMy - My,
    pass:
      Math.abs(sumN - N) <= 1e-7 &&
      Math.abs(sumMx - Mx) <= 1e-7 &&
      Math.abs(sumMy - My) <= 1e-7
  };

  const warnings = [];
  if (Math.abs(Vx) > EPS || Math.abs(Vy) > EPS || Math.abs(T) > EPS) {
    warnings.push(
      "Vx/Vy/T are carried as metadata only in this axial rigid-cap REVIEW model; no lateral/torsional pile-capacity check is claimed."
    );
  }
  if (tensionRows.length && anyUnverifiedTension) {
    warnings.push(
      "One or more piles are in tension but no verified tension capacity was supplied."
    );
  }

  const pass =
    equilibrium.pass &&
    reactions.every((r) => r.pass) &&
    !(tensionPolicy === "BLOCK_IF_NO_TENSION_CAPACITY" && anyUnverifiedTension);

  return {
    status: "REVIEW",
    productionNumeric: false,
    model: "RIGID_CAP_LINEAR_AXIAL_REACTION",
    combinationId,
    compressionSign,
    actions: { NKn: N, MxKnm: Mx, MyKnm: My, VxKn: Vx, VyKn: Vy, torsionKnm: T },
    coefficients: { aKn: a, bKnPerM: b, cKnPerM: c },
    equilibrium,
    reactions,
    maxCompressionPile,
    maxTensionPile,
    governingPile,
    pileCount: pts.length,
    hasTension: tensionRows.length > 0,
    anyUnverifiedTension,
    pass,
    warnings,
    sourceTrace: {
      normativeCapacity: "Rpile / tension capacity must come from prior verified HNL workflows",
      reactionModel: "engineering statics REVIEW; requires TM SCT Coc benchmark before LOCK",
      workbook: "10.1 DCE_SctCoc_10304 2025.xlsm / TM SCT Coc — REFERENCE"
    }
  };
}

export function calculatePileReactionEnvelope({
  loadCombinations,
  pilePoints,
  compressionSign = "compression-positive",
  tensionPolicy = "BLOCK_IF_NO_TENSION_CAPACITY"
}) {
  if (!Array.isArray(loadCombinations) || loadCombinations.length < 1) {
    throw new Error("loadCombinations[] is required");
  }

  const seen = new Set();
  const cases = loadCombinations.map((lc) => {
    const id = nonEmptyString(lc?.combinationId ?? lc?.id, "combinationId");
    if (seen.has(id)) throw new Error(`Duplicate combinationId: ${id}`);
    seen.add(id);
    return calculatePileReactions({
      loadCombination: lc,
      pilePoints,
      compressionSign,
      tensionPolicy
    });
  });

  const allRows = cases.flatMap((c) =>
    c.reactions.map((r) => ({ combinationId: c.combinationId, ...r }))
  );

  const compressionRows = allRows.filter((r) => r.demandKn >= -EPS);
  const tensionRows = allRows.filter((r) => r.demandKn < -EPS);
  const maxCompression = compressionRows.length
    ? compressionRows.reduce((a, b) => (a.demandKn >= b.demandKn ? a : b))
    : null;
  const maxTension = tensionRows.length
    ? tensionRows.reduce((a, b) => (a.demandKn <= b.demandKn ? a : b))
    : null;
  const utilRows = allRows.filter((r) => Number.isFinite(r.utilization));
  const governing = utilRows.length
    ? utilRows.reduce((a, b) => (a.utilization >= b.utilization ? a : b))
    : null;

  return {
    status: "REVIEW",
    productionNumeric: false,
    cases,
    envelope: {
      maxCompression,
      maxTension,
      governing
    },
    pass: cases.every((c) => c.pass),
    requiresXlsmBenchmark: true
  };
}

/**
 * P1 Pass 4 structural-import check mode.
 *
 * Evidence from the audited workbook shows `TM SCT Coc` consumes:
 *   Point Coordinates + Point Spring Assignments + Nodal Reactions + Rd
 * and produces per-pile utilization.  That evidence does NOT prove that the
 * workbook internally derives reactions from N/M using a rigid-cap equation.
 *
 * Therefore HNL keeps this imported-reaction path separate from
 * `calculatePileReactions()`.
 */
export const PILE_REACTION_MODES = Object.freeze({
  ANALYTICAL_RIGID_CAP: "ANALYTICAL_RIGID_CAP",
  IMPORTED_NODAL_REACTION: "IMPORTED_NODAL_REACTION"
});

function normalizeImportedCompression(rawFz, signConvention) {
  const fz = finite(rawFz, "Fz");
  if (signConvention === "compression-positive") return fz;
  if (signConvention === "compression-negative") return -fz;
  throw new Error(`Unsupported reaction sign convention: ${signConvention}`);
}

function mapUnique(rows, keyFn, label) {
  const map = new Map();
  for (const row of rows ?? []) {
    const key = keyFn(row);
    if (map.has(key)) throw new Error(`Duplicate ${label} key: ${key}`);
    map.set(key, row);
  }
  return map;
}

/**
 * Check imported ETABS/SAP nodal reactions against verified per-pile capacity.
 *
 * Required joins:
 *   spring.pointId -> coordinate.pointId
 *   spring.pileId  -> pilePoints.pileId
 *   reaction.pointId + combinationId -> spring.pointId + selected combination
 *
 * This is intentionally a checker, not an importer/parser. File parsing belongs
 * to P1 Pass 5 after this reaction contract is locked.
 */
export function checkImportedNodalPileReactions({
  pilePoints,
  pointCoordinates,
  pointSpringAssignments,
  nodalReactions,
  combinationId,
  reactionCompressionSign = "compression-negative",
  tensionPolicy = "BLOCK_IF_NO_TENSION_CAPACITY",
  strictUnmatched = true
}) {
  const pts = normalizePilePoints(pilePoints);
  const combo = nonEmptyString(combinationId, "combinationId");

  const capacityByPile = mapUnique(pts, (p) => p.pileId, "pileId");
  const coordByPoint = mapUnique(
    pointCoordinates ?? [],
    (p) => nonEmptyString(p.pointId ?? p.point ?? p.nodeId, "pointCoordinates.pointId"),
    "point coordinate"
  );
  const springByPoint = mapUnique(
    pointSpringAssignments ?? [],
    (s) => nonEmptyString(s.pointId ?? s.point ?? s.nodeId, "pointSpringAssignments.pointId"),
    "spring assignment"
  );

  const selectedReactions = (nodalReactions ?? []).filter((r) =>
    String(r.combinationId ?? r.caseCombo ?? r.combo ?? "").trim() === combo
  );
  if (!selectedReactions.length) {
    throw new Error(`No nodal reactions found for combinationId: ${combo}`);
  }

  const reactionByPoint = mapUnique(
    selectedReactions,
    (r) => nonEmptyString(r.pointId ?? r.point ?? r.nodeId, "nodalReactions.pointId"),
    `nodal reaction for combination ${combo}`
  );

  const joined = [];
  const unmatched = [];

  for (const [pointId, spring] of springByPoint.entries()) {
    const coord = coordByPoint.get(pointId);
    const reaction = reactionByPoint.get(pointId);
    const pileId = nonEmptyString(
      spring.pileId ?? spring.springId ?? spring.springName,
      `${pointId}.pileId`
    );
    const pile = capacityByPile.get(pileId);

    const missing = [];
    if (!coord) missing.push("Point Coordinates");
    if (!reaction) missing.push("Nodal Reactions");
    if (!pile) missing.push("PilePoint/capacity");
    if (missing.length) {
      unmatched.push({ pointId, pileId, missing });
      continue;
    }

    const x = finite(coord.x ?? coord.X, `${pointId}.x`);
    const y = finite(coord.y ?? coord.Y, `${pointId}.y`);
    const z = coord.z ?? coord.Z ?? null;
    const rawFz = finite(reaction.Fz ?? reaction.fz ?? reaction.F3 ?? reaction.f3, `${pointId}.Fz`);
    const demandKn = normalizeImportedCompression(rawFz, reactionCompressionSign);
    const checkType = demandKn >= -EPS ? "COMPRESSION" : "TENSION";

    let capacityKn = null;
    let utilization = null;
    let pass = false;
    let blockReason = null;

    if (checkType === "COMPRESSION") {
      capacityKn = pile.compressionCapacityKn;
      utilization = Math.max(0, demandKn) / capacityKn;
      pass = utilization <= 1 + EPS;
    } else if (pile.tensionCapacityKn == null || pile.tensionCapacityKn <= 0) {
      blockReason = "NO_VERIFIED_TENSION_CAPACITY";
    } else {
      capacityKn = pile.tensionCapacityKn;
      utilization = Math.abs(demandKn) / capacityKn;
      pass = utilization <= 1 + EPS;
    }

    joined.push({
      pileId,
      pointId,
      x,
      y,
      z,
      combinationId: combo,
      rawFzKn: rawFz,
      demandKn,
      checkType,
      capacityKn,
      utilization,
      pass,
      blockReason,
      sourceBorehole: pile.sourceBorehole,
      method: pile.method,
      materialGoverning: pile.materialGoverning,
      importedActions: {
        FxKn: reaction.Fx ?? reaction.fx ?? reaction.F1 ?? reaction.f1 ?? null,
        FyKn: reaction.Fy ?? reaction.fy ?? reaction.F2 ?? reaction.f2 ?? null,
        FzKn: rawFz,
        MxKnm: reaction.Mx ?? reaction.mx ?? reaction.M1 ?? reaction.m1 ?? null,
        MyKnm: reaction.My ?? reaction.my ?? reaction.M2 ?? reaction.m2 ?? null,
        MzKnm: reaction.Mz ?? reaction.mz ?? reaction.M3 ?? reaction.m3 ?? null
      }
    });
  }

  if (strictUnmatched && unmatched.length) {
    throw new Error(`Imported reaction join incomplete: ${JSON.stringify(unmatched)}`);
  }
  if (!joined.length) throw new Error("No complete pile-reaction joins were produced");

  // Reactions that exist for points without a spring assignment are also a data-quality issue.
  const orphanReactionPoints = [...reactionByPoint.keys()].filter((id) => !springByPoint.has(id));
  if (strictUnmatched && orphanReactionPoints.length) {
    throw new Error(`Nodal reactions without spring assignment: ${orphanReactionPoints.join(", ")}`);
  }

  const compressionRows = joined.filter((r) => r.demandKn >= -EPS);
  const tensionRows = joined.filter((r) => r.demandKn < -EPS);
  const comparable = joined.filter((r) => Number.isFinite(r.utilization));
  const maxCompressionPile = compressionRows.length
    ? compressionRows.reduce((a, b) => (a.demandKn >= b.demandKn ? a : b))
    : null;
  const maxTensionPile = tensionRows.length
    ? tensionRows.reduce((a, b) => (a.demandKn <= b.demandKn ? a : b))
    : null;
  const governingPile = comparable.length
    ? comparable.reduce((a, b) => (a.utilization >= b.utilization ? a : b))
    : null;

  const anyUnverifiedTension = joined.some((r) => r.blockReason === "NO_VERIFIED_TENSION_CAPACITY");
  const pass =
    joined.every((r) => r.pass) &&
    !(tensionPolicy === "BLOCK_IF_NO_TENSION_CAPACITY" && anyUnverifiedTension);

  return {
    status: "REVIEW",
    productionNumeric: false,
    model: PILE_REACTION_MODES.IMPORTED_NODAL_REACTION,
    combinationId: combo,
    reactionCompressionSign,
    reactions: joined,
    unmatched,
    orphanReactionPoints,
    maxCompressionPile,
    maxTensionPile,
    governingPile,
    hasTension: tensionRows.length > 0,
    anyUnverifiedTension,
    pass,
    sourceTrace: {
      workflowEvidence: "TM SCT Coc: Coordinates + Nodal Reactions + Point Spring Assignments + Rd -> per-pile utilization",
      normativeCapacity: "Pile capacity must come from prior VERIFIED HNL workflow",
      workbook: "10.1 DCE_SctCoc_10304 2025.xlsm / TM SCT Coc — REFERENCE",
      claimBoundary: "This checker mirrors the audited data-flow contract; exact XLSM cell formulas remain REVIEW until cell-level benchmark."
    }
  };
}

export function checkImportedNodalPileReactionEnvelope({
  pilePoints,
  pointCoordinates,
  pointSpringAssignments,
  nodalReactions,
  combinationIds,
  reactionCompressionSign = "compression-negative",
  tensionPolicy = "BLOCK_IF_NO_TENSION_CAPACITY",
  strictUnmatched = true
}) {
  if (!Array.isArray(combinationIds) || !combinationIds.length) {
    throw new Error("combinationIds[] is required");
  }
  const seen = new Set();
  const cases = combinationIds.map((combinationId) => {
    const id = nonEmptyString(combinationId, "combinationId");
    if (seen.has(id)) throw new Error(`Duplicate combinationId: ${id}`);
    seen.add(id);
    return checkImportedNodalPileReactions({
      pilePoints,
      pointCoordinates,
      pointSpringAssignments,
      nodalReactions,
      combinationId: id,
      reactionCompressionSign,
      tensionPolicy,
      strictUnmatched
    });
  });

  const all = cases.flatMap((c) => c.reactions.map((r) => ({ ...r, combinationId: c.combinationId })));
  const comp = all.filter((r) => r.demandKn >= -EPS);
  const tens = all.filter((r) => r.demandKn < -EPS);
  const util = all.filter((r) => Number.isFinite(r.utilization));

  return {
    status: "REVIEW",
    productionNumeric: false,
    model: PILE_REACTION_MODES.IMPORTED_NODAL_REACTION,
    cases,
    envelope: {
      maxCompression: comp.length ? comp.reduce((a,b)=>a.demandKn>=b.demandKn?a:b) : null,
      maxTension: tens.length ? tens.reduce((a,b)=>a.demandKn<=b.demandKn?a:b) : null,
      governing: util.length ? util.reduce((a,b)=>a.utilization>=b.utilization?a:b) : null
    },
    pass: cases.every((c) => c.pass),
    requiresXlsmCellBenchmark: true
  };
}
