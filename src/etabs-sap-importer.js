/**
 * HNL Pile Standards AI v1.25.7
 * P1 Pass 5 — ETABS/SAP Importer
 *
 * Contract: PARSE -> NORMALIZE -> MAP -> VALIDATE -> HANDOFF ONLY.
 * The importer must not calculate pile reactions, pile capacity, utilization,
 * resistance factors, governing combinations, or rigid-cap force distribution.
 *
 * Evidence basis:
 * - DCE workbook raw tables: Point Coordinates, Nodal Reactions,
 *   Point Spring Assignments, PIERFORCES, PIERSECTION.
 * - CSi API assemblies expose cSapModel, DatabaseTables, Results.JointReact,
 *   GetTableForDisplayArray/CSV/XML and GetCoordCartesian.
 */

const EPS = 1e-12;

export const STRUCTURAL_IMPORTER_STATUS = Object.freeze({
  id: "etabs-sap-importer",
  pass: "P1_PASS_5",
  status: "CORE_LOCKED_LIVE_DEFERRED",
  productionNumeric: false,
  responsibility: "PARSE_NORMALIZE_MAP_VALIDATE_HANDOFF_ONLY",
  forbiddenResponsibilities: Object.freeze([
    "PILE_REACTION_CALCULATION",
    "PILE_CAPACITY_CALCULATION",
    "UTILIZATION_CALCULATION",
    "GOVERNING_COMBINATION_SELECTION",
    "RIGID_CAP_DISTRIBUTION"
  ])
});

function text(v, name, { allowEmpty = false } = {}) {
  const s = String(v ?? "").trim();
  if (!allowEmpty && !s) throw new Error(`${name} is required`);
  return s;
}

function finite(v, name) {
  const n = Number(v);
  if (!Number.isFinite(n)) throw new Error(`${name} must be finite`);
  return n;
}

function optionalFinite(v, name) {
  if (v == null || String(v).trim() === "") return null;
  return finite(v, name);
}

function first(row, aliases, requiredName = null) {
  for (const a of aliases) {
    if (Object.prototype.hasOwnProperty.call(row, a) && row[a] != null && String(row[a]).trim() !== "") {
      return row[a];
    }
  }
  if (requiredName) throw new Error(`${requiredName} is required; aliases: ${aliases.join(", ")}`);
  return null;
}

function sourceRow(row, fallbackIndex) {
  const n = Number(row?._sourceRow);
  return Number.isInteger(n) && n > 0 ? n : fallbackIndex + 2;
}

function uniqueBy(rows, keyFn, label) {
  const seen = new Map();
  for (const row of rows) {
    const k = keyFn(row);
    if (seen.has(k)) throw new Error(`Duplicate ${label}: ${k}`);
    seen.set(k, row);
  }
  return seen;
}

export function rowsFromCsiFlatTable({ fields, flatData, tableKey = "UNKNOWN" }) {
  if (!Array.isArray(fields) || !fields.length) throw new Error("fields[] is required");
  if (!Array.isArray(flatData)) throw new Error("flatData[] is required");
  if (flatData.length % fields.length !== 0) {
    throw new Error(`CSI table ${tableKey} flatData length ${flatData.length} is not divisible by field count ${fields.length}`);
  }
  const cleanFields = fields.map((f, i) => text(f, `fields[${i}]`));
  const rows = [];
  for (let i = 0; i < flatData.length; i += cleanFields.length) {
    const row = { _tableKey: tableKey, _sourceRow: i / cleanFields.length + 1 };
    for (let j = 0; j < cleanFields.length; j++) row[cleanFields[j]] = flatData[i + j];
    rows.push(row);
  }
  return rows;
}

export function normalizePointCoordinates(rows, { source = "DCE_TABLE" } = {}) {
  if (!Array.isArray(rows)) throw new Error("pointCoordinates rows[] is required");
  const out = rows.map((r, i) => ({
    pointId: text(first(r, ["Point", "pointId", "PointName", "UniqueName", "Node"], "Point"), "Point"),
    x: finite(first(r, ["GlobalX", "X", "x"], "GlobalX"), "GlobalX"),
    y: finite(first(r, ["GlobalY", "Y", "y"], "GlobalY"), "GlobalY"),
    z: finite(first(r, ["GlobalZ", "Z", "z"], "GlobalZ"), "GlobalZ"),
    specialPoint: first(r, ["SpecialPt", "Special Point", "SpecialPoint"]),
    provenance: { source, table: "Point Coordinates", sourceRow: sourceRow(r, i) }
  }));
  uniqueBy(out, r => r.pointId, "point coordinate pointId");
  return out;
}

export function normalizePointSpringAssignments(rows, { source = "DCE_TABLE" } = {}) {
  if (!Array.isArray(rows)) throw new Error("pointSpringAssignments rows[] is required");
  const out = rows.map((r, i) => {
    const pointId = text(first(r, ["Point", "pointId", "Node", "UniqueName"], "Point"), "Point");
    const springName = text(first(r, ["Spring", "springName", "SpringProp", "Property"], "Spring"), "Spring");
    return {
      pointId,
      // Physical pile identity is the point/node unless an explicit unique pile id exists.
      // The spring name is a property/type, not a globally unique physical pile.
      pileId: text(first(r, ["PileId", "pileId"]) ?? pointId, "pileId"),
      springName,
      pilePropertyId: springName,
      provenance: { source, table: "Point Spring Assignments", sourceRow: sourceRow(r, i) }
    };
  });
  uniqueBy(out, r => r.pointId, "point spring assignment pointId");
  return out;
}

export function normalizeNodalReactionRows(rows, {
  source = "DCE_TABLE",
  compressionSign = "compression-positive"
} = {}) {
  if (!Array.isArray(rows)) throw new Error("nodalReactions rows[] is required");
  if (!["compression-positive", "compression-negative"].includes(compressionSign)) {
    throw new Error(`Unsupported nodal reaction compressionSign: ${compressionSign}`);
  }
  return rows.map((r, i) => ({
    nodeId: text(first(r, ["Node", "nodeId", "Joint", "UniqueName", "Point"], "Node/Point"), "Node/Point"),
    pointId: text(first(r, ["Point", "pointId", "Node", "Joint", "UniqueName"], "Point"), "Point"),
    combinationId: text(first(r, ["OutputCase", "CaseCombo", "LoadCase", "Combo", "combinationId"], "OutputCase"), "OutputCase"),
    caseType: text(first(r, ["CaseType", "caseType", "StepType"], null) ?? "", "caseType", { allowEmpty: true }),
    Fx: optionalFinite(first(r, ["Fx", "F1", "U1"]), "Fx"),
    Fy: optionalFinite(first(r, ["Fy", "F2", "U2"]), "Fy"),
    Fz: finite(first(r, ["Fz", "F3", "U3"], "Fz"), "Fz"),
    Mx: optionalFinite(first(r, ["Mx", "M1", "R1"]), "Mx"),
    My: optionalFinite(first(r, ["My", "M2", "R2"]), "My"),
    Mz: optionalFinite(first(r, ["Mz", "M3", "R3"]), "Mz"),
    compressionSign,
    provenance: { source, table: "Nodal Reactions", sourceRow: sourceRow(r, i) }
  }));
}

/**
 * Create an import envelope from raw reaction rows without structural analysis.
 * This is deterministic data aggregation only: max/min of already imported Fz rows.
 * All source rows remain attached as provenance.
 */
export function buildNodalReactionEnvelopes(rawRows) {
  if (!Array.isArray(rawRows)) throw new Error("rawRows[] is required");
  const groups = new Map();
  for (const r of rawRows) {
    const key = `${r.pointId}\u0000${r.combinationId}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(r);
  }

  return [...groups.values()].map((rows) => {
    const signSet = new Set(rows.map(r => r.compressionSign));
    if (signSet.size !== 1) throw new Error(`Mixed compression sign conventions for ${rows[0].pointId}/${rows[0].combinationId}`);
    const maxRow = rows.reduce((a, b) => a.Fz >= b.Fz ? a : b);
    const minRow = rows.reduce((a, b) => a.Fz <= b.Fz ? a : b);
    return {
      pointId: rows[0].pointId,
      combinationId: rows[0].combinationId,
      compressionSign: rows[0].compressionSign,
      FzMax: maxRow.Fz,
      FzMin: minRow.Fz,
      maxRow,
      minRow,
      rawRowCount: rows.length,
      rawRows: rows,
      provenance: {
        sourceRows: rows.map(r => r.provenance),
        operation: "DATA_ENVELOPE_MAX_MIN_ONLY"
      }
    };
  });
}

/**
 * Produce one unique row per point+combo for the locked imported compression checker.
 * No capacity/utilization/reaction distribution is computed here.
 */
export function toImportedCompressionCheckRows(envelopes) {
  if (!Array.isArray(envelopes)) throw new Error("envelopes[] is required");
  return envelopes.map((e) => {
    let selected;
    if (e.compressionSign === "compression-positive") selected = e.maxRow;
    else if (e.compressionSign === "compression-negative") selected = e.minRow;
    else throw new Error(`Unsupported envelope compression sign: ${e.compressionSign}`);
    return {
      pointId: e.pointId,
      combinationId: e.combinationId,
      Fz: selected.Fz,
      Fx: selected.Fx,
      Fy: selected.Fy,
      Mx: selected.Mx,
      My: selected.My,
      Mz: selected.Mz,
      envelopeRole: e.compressionSign === "compression-positive" ? "FZ_MAX" : "FZ_MIN",
      sourceEnvelope: e,
      provenance: selected.provenance
    };
  });
}

export function normalizePierForces(rows, {
  source = "DCE_TABLE",
  compressionSign = "compression-negative"
} = {}) {
  if (!Array.isArray(rows)) throw new Error("pierForces rows[] is required");
  if (!["compression-positive", "compression-negative"].includes(compressionSign)) {
    throw new Error(`Unsupported pier force compressionSign: ${compressionSign}`);
  }
  return rows.map((r, i) => ({
    story: text(first(r, ["Story", "story"], "Story"), "Story"),
    pier: text(first(r, ["Pier", "pier"], "Pier"), "Pier"),
    combinationId: text(first(r, ["CaseCombo", "OutputCase", "Combo", "combinationId"], "CaseCombo"), "CaseCombo"),
    location: finite(first(r, ["Location", "location"], "Location"), "Location"),
    P: finite(first(r, ["P", "Axial", "Fz"], "P"), "P"),
    V2: optionalFinite(first(r, ["V2", "Vx"]), "V2"),
    V3: optionalFinite(first(r, ["V3", "Vy"]), "V3"),
    T: optionalFinite(first(r, ["T", "Torsion"]), "T"),
    M2: optionalFinite(first(r, ["M2", "Mx"]), "M2"),
    M3: optionalFinite(first(r, ["M3", "My"]), "M3"),
    compressionSign,
    provenance: { source, table: "PIERFORCES", sourceRow: sourceRow(r, i) }
  }));
}

export function normalizePierSection(rows, { source = "DCE_TABLE" } = {}) {
  if (!Array.isArray(rows)) throw new Error("pierSection rows[] is required");
  return rows.map((r, i) => ({
    story: text(first(r, ["Story", "story"], "Story"), "Story"),
    pier: text(first(r, ["Pier", "pier"], "Pier"), "Pier"),
    axisAngleDeg: finite(first(r, ["AxisAngle", "axisAngleDeg"], "AxisAngle"), "AxisAngle"),
    widthBot: optionalFinite(first(r, ["WidthBot"]), "WidthBot"),
    thickBot: optionalFinite(first(r, ["ThickBot"]), "ThickBot"),
    widthTop: optionalFinite(first(r, ["WidthTop"]), "WidthTop"),
    thickTop: optionalFinite(first(r, ["ThickTop"]), "ThickTop"),
    material: first(r, ["Material"]),
    cgBotX: optionalFinite(first(r, ["CGBotX"]), "CGBotX"),
    cgBotY: optionalFinite(first(r, ["CGBotY"]), "CGBotY"),
    cgBotZ: optionalFinite(first(r, ["CGBotZ"]), "CGBotZ"),
    cgTopX: optionalFinite(first(r, ["CGTopX"]), "CGTopX"),
    cgTopY: optionalFinite(first(r, ["CGTopY"]), "CGTopY"),
    cgTopZ: optionalFinite(first(r, ["CGTopZ"]), "CGTopZ"),
    provenance: { source, table: "PIERSECTION", sourceRow: sourceRow(r, i) }
  }));
}

export function validatePileImportJoins({ pointCoordinates, pointSpringAssignments, nodalReactionEnvelopes }) {
  const coords = uniqueBy(pointCoordinates, r => r.pointId, "canonical coordinate pointId");
  const springs = uniqueBy(pointSpringAssignments, r => r.pointId, "canonical spring pointId");
  const missingCoordinates = [...springs.keys()].filter(id => !coords.has(id));
  const reactionPoints = new Set(nodalReactionEnvelopes.map(r => r.pointId));
  const missingReactions = [...springs.keys()].filter(id => !reactionPoints.has(id));
  const orphanReactionPoints = [...reactionPoints].filter(id => !springs.has(id));
  return {
    pass: !missingCoordinates.length && !missingReactions.length && !orphanReactionPoints.length,
    missingCoordinates,
    missingReactions,
    orphanReactionPoints
  };
}

export function importDceStructuralTableBundle({
  pointCoordinates,
  nodalReactions,
  pointSpringAssignments,
  pierForces = [],
  pierSection = [],
  sourceId = "DCE_WORKBOOK",
  nodalReactionCompressionSign = "compression-positive",
  pierForceCompressionSign = "compression-negative"
}) {
  const points = normalizePointCoordinates(pointCoordinates, { source: sourceId });
  const springs = normalizePointSpringAssignments(pointSpringAssignments, { source: sourceId });
  const rawReactions = normalizeNodalReactionRows(nodalReactions, {
    source: sourceId,
    compressionSign: nodalReactionCompressionSign
  });
  const envelopes = buildNodalReactionEnvelopes(rawReactions);
  const compressionCheckRows = toImportedCompressionCheckRows(envelopes);
  const piers = normalizePierForces(pierForces, { source: sourceId, compressionSign: pierForceCompressionSign });
  const sections = normalizePierSection(pierSection, { source: sourceId });
  const joinAudit = validatePileImportJoins({
    pointCoordinates: points,
    pointSpringAssignments: springs,
    nodalReactionEnvelopes: envelopes
  });

  if (!joinAudit.pass) {
    throw new Error(`Structural import join validation failed: ${JSON.stringify(joinAudit)}`);
  }

  return {
    status: "LOCKED_DCE_TABLE_ADAPTER",
    productionNumeric: false,
    importer: STRUCTURAL_IMPORTER_STATUS,
    sourceId,
    canonical: {
      pointCoordinates: points,
      pointSpringAssignments: springs,
      nodalReactionRawRows: rawReactions,
      nodalReactionEnvelopes: envelopes,
      importedCompressionCheckRows: compressionCheckRows,
      pierForces: piers,
      pierSection: sections
    },
    signConventions: {
      nodalReactions: nodalReactionCompressionSign,
      pierForces: pierForceCompressionSign
    },
    audit: {
      pointCoordinates: points.length,
      pointSpringAssignments: springs.length,
      nodalReactionRawRows: rawReactions.length,
      nodalReactionEnvelopes: envelopes.length,
      compressionCheckRows: compressionCheckRows.length,
      pierForces: piers.length,
      pierSection: sections.length,
      joinAudit
    },
    handoff: {
      pass4ImportedReaction: {
        pointCoordinates: points,
        pointSpringAssignments: springs,
        nodalReactions: compressionCheckRows,
        reactionCompressionSign: nodalReactionCompressionSign
      },
      pass3PileQuantity: {
        pierForces: piers,
        pierSection: sections
      }
    },
    claimBoundary: "Importer only parses/normalizes/maps/validates. Capacity and reaction/utilization calculations remain outside Pass 5."
  };
}

export function assertImporterContainsNoNumericEngineeringResults(importResult) {
  const forbidden = new Set([
    "capacityKn", "compressionCapacityKn", "tensionCapacityKn", "utilization", "pass", "governingPile",
    "selectedPileCount", "Rpile", "RdComputed", "reactionDemandKn", "rigidCapReaction"
  ]);
  const offenders = [];
  function walk(v, path = "root") {
    if (!v || typeof v !== "object") return;
    if (Array.isArray(v)) return v.forEach((x, i) => walk(x, `${path}[${i}]`));
    for (const [k, val] of Object.entries(v)) {
      if (forbidden.has(k)) offenders.push(`${path}.${k}`);
      walk(val, `${path}.${k}`);
    }
  }
  // audit.joinAudit.pass is validation status, not an engineering result. Exclude audit branch.
  const clone = { ...importResult, audit: undefined, importer: undefined };
  walk(clone);
  return { pass: offenders.length === 0, offenders };
}
