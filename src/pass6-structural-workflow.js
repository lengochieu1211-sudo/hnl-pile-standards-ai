/**
 * HNL Pile Standards AI v1.25.7
 * P1 Pass 6 — End-to-End Structural Workflow Integration
 *
 * Orchestration only:
 *   STRUCTURAL SOURCE -> Pass5 Core LOCKED importer -> Pass4 imported-reaction
 *   LOCKED checker -> governing pile/combo -> report model.
 *
 * This module MUST NOT:
 * - derive rigid-cap reactions,
 * - select preliminary pile count,
 * - derive geotechnical/material Rpile,
 * - silently accept manual/unverified capacity.
 */

import { importDceStructuralTableBundle } from './etabs-sap-importer.js';
import { importStructuralCsvBundle } from './csi-live-bridge.js';
import { checkImportedNodalPileReactionEnvelope } from './pile-reaction-engine.js';

const EPS = 1e-10;

export const PASS6_STRUCTURAL_WORKFLOW_STATUS = Object.freeze({
  id: 'p1-pass6-structural-e2e',
  version: '1.25.7',
  status: 'REVIEW_GOLDEN_IN_PROGRESS',
  responsibility: 'ORCHESTRATE_LOCKED_COMPONENTS_AND_REPORT',
  upstream: Object.freeze({
    pass5Core: 'LOCKED',
    pass4ImportedNumericCore: 'LOCKED',
    capacity: 'MUST_BE_LOCKED_UPSTREAM'
  }),
  forbiddenResponsibilities: Object.freeze([
    'RIGID_CAP_REACTION_DISTRIBUTION',
    'PILE_CAPACITY_DERIVATION',
    'PRELIMINARY_PILE_COUNT_SELECTION',
    'SILENT_UNIT_OR_SIGN_GUESSING'
  ])
});

function finite(v, name) {
  const n = Number(v);
  if (!Number.isFinite(n)) throw new Error(`${name} must be finite`);
  return n;
}

function nonEmpty(v, name) {
  const s = String(v ?? '').trim();
  if (!s) throw new Error(`${name} is required`);
  return s;
}

function capacityStatusLocked(status) {
  return /^LOCKED(?:_|$)/.test(String(status ?? '').trim().toUpperCase());
}

export function validateLockedCapacityProfile(profile) {
  if (!profile || typeof profile !== 'object') throw new Error('lockedCapacity is required');
  if (!capacityStatusLocked(profile.status)) {
    throw new Error('Capacity source must be LOCKED; manual/unverified capacity is blocked');
  }
  const RpileKn = finite(profile.RpileKn, 'lockedCapacity.RpileKn');
  const gammaN = finite(profile.gammaN, 'lockedCapacity.gammaN');
  if (!(RpileKn > 0)) throw new Error('lockedCapacity.RpileKn must be > 0');
  if (!(gammaN > 0)) throw new Error('lockedCapacity.gammaN must be > 0');
  const NdMaxPerPileKn = RpileKn / gammaN;
  if (profile.NdMaxPerPileKn != null) {
    const supplied = finite(profile.NdMaxPerPileKn, 'lockedCapacity.NdMaxPerPileKn');
    const tol = Math.max(1e-9, EPS * Math.max(1, Math.abs(supplied), Math.abs(NdMaxPerPileKn)));
    if (Math.abs(supplied - NdMaxPerPileKn) > tol) {
      throw new Error(`Locked capacity inconsistency: NdMaxPerPileKn=${supplied} but Rpile/gammaN=${NdMaxPerPileKn}`);
    }
  }
  const sourceModule = nonEmpty(profile.sourceModule ?? profile.source, 'lockedCapacity.sourceModule');
  const sourceArtifact = nonEmpty(profile.sourceArtifact ?? profile.provenance ?? 'LOCKED_UPSTREAM', 'lockedCapacity.sourceArtifact');
  return {
    status: String(profile.status),
    RpileKn,
    gammaN,
    NdMaxPerPileKn,
    sourceModule,
    sourceArtifact,
    governingBasis: profile.governingBasis ?? null,
    sourceBorehole: profile.sourceBorehole ?? null,
    materialGoverning: Boolean(profile.materialGoverning)
  };
}

export function importPass6StructuralSource(source) {
  if (!source || typeof source !== 'object') throw new Error('source is required');
  const kind = String(source.kind ?? '').trim().toUpperCase();
  if (kind === 'DCE_TABLES') {
    const t = source.tables ?? source;
    return importDceStructuralTableBundle({
      pointCoordinates: t.pointCoordinates,
      nodalReactions: t.nodalReactions,
      pointSpringAssignments: t.pointSpringAssignments,
      pierForces: t.pierForces ?? [],
      pierSection: t.pierSection ?? [],
      sourceId: source.sourceId ?? 'PASS6_DCE_TABLES',
      nodalReactionCompressionSign: source.nodalReactionCompressionSign ?? 'compression-positive',
      pierForceCompressionSign: source.pierForceCompressionSign ?? 'compression-negative'
    });
  }
  if (kind === 'CSV') {
    return importStructuralCsvBundle({
      pointCoordinatesCsv: source.pointCoordinatesCsv,
      nodalReactionsCsv: source.nodalReactionsCsv,
      pointSpringAssignmentsCsv: source.pointSpringAssignmentsCsv,
      pierForcesCsv: source.pierForcesCsv ?? '',
      pierSectionCsv: source.pierSectionCsv ?? '',
      sourceId: source.sourceId ?? 'PASS6_CSV',
      nodalReactionCompressionSign: source.nodalReactionCompressionSign,
      pierForceCompressionSign: source.pierForceCompressionSign,
      unitsProfile: source.unitsProfile
    });
  }
  throw new Error(`Unsupported Pass 6 source kind: ${kind || '(empty)'}`);
}

function buildCapacityPilePoints(importResult, capacity) {
  const coord = new Map(importResult.canonical.pointCoordinates.map((p) => [p.pointId, p]));
  return importResult.canonical.pointSpringAssignments.map((s) => {
    const c = coord.get(s.pointId);
    if (!c) throw new Error(`Missing coordinate for capacity handoff point ${s.pointId}`);
    return {
      pileId: s.pileId,
      x: c.x,
      y: c.y,
      compressionCapacityKn: capacity.NdMaxPerPileKn,
      sourceBorehole: capacity.sourceBorehole,
      materialGoverning: capacity.materialGoverning,
      method: capacity.governingBasis,
      source: `${capacity.sourceModule} / ${capacity.sourceArtifact}`
    };
  });
}

function uniqueCombinationIds(importResult) {
  return [...new Set(importResult.canonical.importedCompressionCheckRows.map((r) => r.combinationId))];
}

function summaryRows(envelope) {
  return envelope.cases.flatMap((c) => c.reactions.map((r) => ({
    combinationId: c.combinationId,
    pileId: r.pileId,
    pointId: r.pointId,
    x: r.x,
    y: r.y,
    z: r.z,
    rawFzKn: r.rawFzKn,
    demandKn: r.demandKn,
    checkType: r.checkType,
    capacityKn: r.capacityKn,
    utilization: r.utilization,
    pass: r.pass,
    blockReason: r.blockReason,
    FxKn: r.importedActions?.FxKn ?? null,
    FyKn: r.importedActions?.FyKn ?? null,
    MxKnm: r.importedActions?.MxKnm ?? null,
    MyKnm: r.importedActions?.MyKnm ?? null,
    MzKnm: r.importedActions?.MzKnm ?? null
  })));
}

export function runPass6StructuralWorkflow({
  source,
  lockedCapacity,
  combinationIds = null,
  tensionPolicy = 'BLOCK_IF_NO_TENSION_CAPACITY'
}) {
  const capacity = validateLockedCapacityProfile(lockedCapacity);
  const imported = importPass6StructuralSource(source);
  const combos = combinationIds == null ? uniqueCombinationIds(imported) : [...combinationIds];
  if (!combos.length) throw new Error('No structural reaction combinations are available for Pass 6');

  const pilePoints = buildCapacityPilePoints(imported, capacity);
  const reaction = checkImportedNodalPileReactionEnvelope({
    pilePoints,
    pointCoordinates: imported.handoff.pass4ImportedReaction.pointCoordinates,
    pointSpringAssignments: imported.handoff.pass4ImportedReaction.pointSpringAssignments,
    nodalReactions: imported.handoff.pass4ImportedReaction.nodalReactions,
    combinationIds: combos,
    reactionCompressionSign: imported.handoff.pass4ImportedReaction.reactionCompressionSign,
    tensionPolicy,
    strictUnmatched: true
  });

  const rows = summaryRows(reaction);
  const passRows = rows.filter((r) => r.pass).length;
  const failRows = rows.filter((r) => !r.pass && !r.blockReason).length;
  const blockedRows = rows.filter((r) => Boolean(r.blockReason)).length;
  const governing = reaction.envelope.governing;

  return {
    schema: 'HNL-P1-PASS6-STRUCTURAL-E2E-RESULT',
    version: '1.25.7',
    status: reaction.pass ? 'PASS' : 'FAIL_OR_BLOCK',
    workflow: 'PASS5_IMPORT_TO_PASS4_IMPORTED_REACTION_WITH_LOCKED_CAPACITY',
    sourceKind: String(source.kind).toUpperCase(),
    capacity,
    combinationIds: combos,
    importAudit: imported.audit,
    rows,
    governing: governing ? {
      pileId: governing.pileId,
      pointId: governing.pointId,
      combinationId: governing.combinationId,
      demandKn: governing.demandKn,
      capacityKn: governing.capacityKn,
      utilization: governing.utilization,
      checkType: governing.checkType,
      pass: governing.pass
    } : null,
    envelope: {
      maxCompression: reaction.envelope.maxCompression,
      maxTension: reaction.envelope.maxTension,
      governing: reaction.envelope.governing
    },
    summary: {
      pileCount: imported.canonical.pointSpringAssignments.length,
      combinationCount: combos.length,
      checkRows: rows.length,
      passRows,
      failRows,
      blockedRows,
      overallPass: reaction.pass
    },
    provenance: {
      structuralImporter: imported.status,
      structuralSourceId: imported.sourceId,
      reactionEngine: 'P1_PASS4_IMPORTED_NUMERIC_CORE_LOCKED',
      capacitySource: capacity.sourceModule,
      capacityArtifact: capacity.sourceArtifact,
      claimBoundary: 'No rigid-cap reaction derivation and no capacity derivation occurs in Pass 6.'
    }
  };
}
