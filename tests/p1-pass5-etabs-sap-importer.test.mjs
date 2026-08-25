import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  rowsFromCsiFlatTable,
  normalizePointCoordinates,
  normalizePointSpringAssignments,
  normalizeNodalReactionRows,
  buildNodalReactionEnvelopes,
  toImportedCompressionCheckRows,
  normalizePierForces,
  importDceStructuralTableBundle,
  assertImporterContainsNoNumericEngineeringResults,
  STRUCTURAL_IMPORTER_STATUS
} from "../src/etabs-sap-importer.js";
import { checkImportedNodalPileReactions } from "../src/pile-reaction-engine.js";

const fixturePath = path.resolve("artifacts/p1-pass5-dce-table-bundle-fixture-v13.json");
const fixture = JSON.parse(fs.readFileSync(fixturePath, "utf8"));
const T = fixture.tables;

function imported() {
  return importDceStructuralTableBundle({
    pointCoordinates: T.pointCoordinates,
    nodalReactions: T.nodalReactions,
    pointSpringAssignments: T.pointSpringAssignments,
    pierForces: T.pierForces,
    pierSection: T.pierSection,
    sourceId: "DCE_10304_2025",
    nodalReactionCompressionSign: "compression-positive",
    pierForceCompressionSign: "compression-negative"
  });
}

test("Pass 5 importer responsibility is parse/map only", () => {
  assert.equal(STRUCTURAL_IMPORTER_STATUS.productionNumeric, false);
  assert.match(STRUCTURAL_IMPORTER_STATUS.responsibility, /PARSE_NORMALIZE_MAP_VALIDATE_HANDOFF_ONLY/);
});

test("CSI flat table adapter reconstructs rows exactly", () => {
  const rows = rowsFromCsiFlatTable({ fields:["Point","GlobalX","GlobalY"], flatData:["1",4.07,-0.03,"2",8.25,1.2], tableKey:"Point Coordinates" });
  assert.deepEqual(rows.map(r=>[r.Point,r.GlobalX,r.GlobalY]), [["1",4.07,-0.03],["2",8.25,1.2]]);
});

test("CSI flat table adapter blocks malformed field/data length", () => {
  assert.throws(()=>rowsFromCsiFlatTable({fields:["A","B"],flatData:[1,2,3]}),/not divisible/);
});

test("exact workbook point coordinates import 194 unique points", () => {
  const p = normalizePointCoordinates(T.pointCoordinates);
  assert.equal(p.length,194);
  assert.equal(new Set(p.map(x=>x.pointId)).size,194);
  assert.deepEqual(p[0], {pointId:"1",x:4.07,y:-0.03,z:0,specialPoint:"#N/A",provenance:{source:"DCE_TABLE",table:"Point Coordinates",sourceRow:2}});
});

test("point spring assignment uses physical point as pileId, not C250 property", () => {
  const s=normalizePointSpringAssignments(T.pointSpringAssignments);
  assert.equal(s.length,19);
  assert.equal(s[0].pointId,"136");
  assert.equal(s[0].pileId,"136");
  assert.equal(s[0].springName,"C250");
  assert.equal(s[0].pilePropertyId,"C250");
});

test("exact workbook preserves 38 raw nodal-reaction rows", () => {
  const r=normalizeNodalReactionRows(T.nodalReactions,{compressionSign:"compression-positive"});
  assert.equal(r.length,38);
  assert.equal(r[0].pointId,"136");
  assert.equal(r[0].Fz,286.91991774862805);
  assert.equal(r[1].Fz,190.23609139556444);
  assert.equal(r[0].compressionSign,"compression-positive");
});

test("raw reactions become 19 point/combo envelopes without dropping provenance", () => {
  const raw=normalizeNodalReactionRows(T.nodalReactions,{compressionSign:"compression-positive"});
  const env=buildNodalReactionEnvelopes(raw);
  assert.equal(env.length,19);
  assert.ok(env.every(x=>x.rawRowCount===2));
  const p136=env.find(x=>x.pointId==="136");
  assert.equal(p136.FzMax,286.91991774862805);
  assert.equal(p136.FzMin,190.23609139556444);
  assert.deepEqual(p136.provenance.sourceRows.map(x=>x.sourceRow),[2,3]);
});

test("compression handoff selects FzMax for DCE compression-positive nodal reactions", () => {
  const raw=normalizeNodalReactionRows(T.nodalReactions,{compressionSign:"compression-positive"});
  const rows=toImportedCompressionCheckRows(buildNodalReactionEnvelopes(raw));
  assert.equal(rows.length,19);
  const p136=rows.find(x=>x.pointId==="136");
  assert.equal(p136.Fz,286.91991774862805);
  assert.equal(p136.envelopeRole,"FZ_MAX");
});

test("compression handoff selects FzMin for compression-negative sources", () => {
  const raw=normalizeNodalReactionRows([
    {Node:"P1",Point:"P1",OutputCase:"C",Fz:-100},
    {Node:"P1",Point:"P1",OutputCase:"C",Fz:-250}
  ],{compressionSign:"compression-negative"});
  const row=toImportedCompressionCheckRows(buildNodalReactionEnvelopes(raw))[0];
  assert.equal(row.Fz,-250);
  assert.equal(row.envelopeRole,"FZ_MIN");
});

test("PIERFORCES imports all 234 rows and does not select Location=0 inside importer", () => {
  const rows=normalizePierForces(T.pierForces,{compressionSign:"compression-negative"});
  assert.equal(rows.length,234);
  const c1min=rows.filter(r=>r.story==="T2"&&r.pier==="C1"&&r.combinationId==="EULS Min");
  assert.deepEqual(c1min.map(r=>r.location),[0,2.25,4.5]);
  assert.equal(c1min[0].P,-2809.1355078862798);
  assert.equal(c1min[0].compressionSign,"compression-negative");
});

test("bundle exact counts match source workbook", () => {
  const r=imported();
  assert.deepEqual(r.audit, {
    pointCoordinates:194,
    pointSpringAssignments:19,
    nodalReactionRawRows:38,
    nodalReactionEnvelopes:19,
    compressionCheckRows:19,
    pierForces:234,
    pierSection:39,
    joinAudit:{pass:true,missingCoordinates:[],missingReactions:[],orphanReactionPoints:[]}
  });
});

test("bundle carries table-specific sign conventions instead of one global sign", () => {
  const r=imported();
  assert.equal(r.signConventions.nodalReactions,"compression-positive");
  assert.equal(r.signConventions.pierForces,"compression-negative");
});

test("bundle creates Pass 4 and Pass 3 handoffs without engineering calculations", () => {
  const r=imported();
  assert.equal(r.handoff.pass4ImportedReaction.nodalReactions.length,19);
  assert.equal(r.handoff.pass3PileQuantity.pierForces.length,234);
  assert.equal(r.handoff.pass3PileQuantity.pierSection.length,39);
  const audit=assertImporterContainsNoNumericEngineeringResults(r);
  assert.equal(audit.pass,true,JSON.stringify(audit.offenders));
});

test("duplicate spring assignment blocks before engine handoff", () => {
  const dup=[...T.pointSpringAssignments,{...T.pointSpringAssignments[0],_sourceRow:999}];
  assert.throws(()=>importDceStructuralTableBundle({pointCoordinates:T.pointCoordinates,nodalReactions:T.nodalReactions,pointSpringAssignments:dup}),/Duplicate point spring assignment/);
});

test("missing coordinate blocks before engine handoff", () => {
  const points=T.pointCoordinates.filter(r=>String(r.Point)!=="136");
  assert.throws(()=>importDceStructuralTableBundle({pointCoordinates:points,nodalReactions:T.nodalReactions,pointSpringAssignments:T.pointSpringAssignments}),/join validation failed/);
});

test("orphan reaction point blocks before engine handoff", () => {
  const rx=[...T.nodalReactions,{Node:"9999",Point:"9999",OutputCase:"EULS",CaseType:"EULS",Fx:0,Fy:0,Fz:1,Mx:0,My:0,Mz:0,_sourceRow:999}];
  assert.throws(()=>importDceStructuralTableBundle({pointCoordinates:T.pointCoordinates,nodalReactions:rx,pointSpringAssignments:T.pointSpringAssignments}),/join validation failed/);
});

test("Pass 5 handoff reproduces exact TM SCT Coc compression decisions when capacity is supplied by Pass 4 upstream", () => {
  const r=imported();
  const capacity=350/1.15;
  const pilePoints=r.canonical.pointSpringAssignments.map(s=>{
    const c=r.canonical.pointCoordinates.find(p=>p.pointId===s.pointId);
    return {pileId:s.pileId,x:c.x,y:c.y,compressionCapacityKn:capacity,source:"TEST_UPSTREAM_CAPACITY"};
  });
  const check=checkImportedNodalPileReactions({
    pilePoints,
    pointCoordinates:r.handoff.pass4ImportedReaction.pointCoordinates,
    pointSpringAssignments:r.handoff.pass4ImportedReaction.pointSpringAssignments,
    nodalReactions:r.handoff.pass4ImportedReaction.nodalReactions,
    combinationId:"EULS",
    reactionCompressionSign:"compression-positive"
  });
  assert.equal(check.reactions.length,19);
  const notOk=check.reactions.filter(x=>!x.pass).map(x=>x.pointId).sort();
  assert.deepEqual(notOk,["160","167","168"]);
  assert.equal(check.reactions.find(x=>x.pointId==="136").utilization,286.91991774862805/capacity);
});

test("importer never invents capacity from C250/Rd workbook lookup", () => {
  const r=imported();
  const serialized=JSON.stringify(r.canonical.pointSpringAssignments);
  assert.equal(serialized.includes("compressionCapacity"),false);
  assert.equal(serialized.includes("Rd"),false);
});

test("Nodal reaction envelope reproduces TM SCT Coc F=Nd Max and G=Nd Min for all 19 piles", () => {
  const ref=JSON.parse(fs.readFileSync(path.resolve("artifacts/p1-pass5-tm-fg-reference-v13.json"),"utf8"));
  const r=imported();
  for (const x of ref.rows) {
    const e=r.canonical.nodalReactionEnvelopes.find(e=>e.pointId===x.pointId&&e.combinationId===x.combinationId);
    assert.ok(e,`missing envelope ${x.pointId}/${x.combinationId}`);
    assert.ok(Math.abs(e.FzMax-x.FzMax)<=1e-9,`FzMax ${x.pointId}`);
    assert.ok(Math.abs(e.FzMin-x.FzMin)<=1e-9,`FzMin ${x.pointId}`);
  }
});

test("PIERFORCES handoff preserves all 39 Pass 3 XLSM governing source rows exactly", () => {
  const ref=JSON.parse(fs.readFileSync(path.resolve("artifacts/p1-pass5-pass3-pierforces-reference-v13.json"),"utf8"));
  const r=imported();
  assert.equal(ref.rows.length,39);
  for (const x of ref.rows) {
    const a=r.canonical.pierForces.find(p=>p.story===x.story&&p.pier===x.pier&&p.combinationId===x.combinationId&&p.location===0);
    assert.ok(a,`missing ${x.story}/${x.pier}/${x.combinationId}/0`);
    for (const k of ["P","V2","V3","T","M2","M3"]) assert.equal(a[k],x[k],`${x.pier}.${k}`);
  }
});
