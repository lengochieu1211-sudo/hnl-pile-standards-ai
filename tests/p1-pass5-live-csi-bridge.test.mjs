import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  resolveCsiTableRole,
  csiBridgeTableToRows,
  importCsiBridgePayload,
  auditDirectVsTableReactions,
  parseCsvText,
  importStructuralCsvBundle,
  importExcelFallbackPayload,
  runWindowsCsiBridge,
  CSI_LIVE_BRIDGE_STATUS
} from "../src/csi-live-bridge.js";
import { importDceStructuralTableBundle, assertImporterContainsNoNumericEngineeringResults } from "../src/etabs-sap-importer.js";
import { checkImportedNodalPileReactions } from "../src/pile-reaction-engine.js";

const fixture=JSON.parse(fs.readFileSync(path.resolve("artifacts/p1-pass5-dce-table-bundle-fixture-v13.json"),"utf8"));
const replay=JSON.parse(fs.readFileSync(path.resolve("artifacts/p1-pass5-live-api-replay-v14.json"),"utf8"));
const csvDir=path.resolve("artifacts/p1-pass5-csv-fallback-v14");

function dceImport(){
  const T=fixture.tables;
  return importDceStructuralTableBundle({
    pointCoordinates:T.pointCoordinates,nodalReactions:T.nodalReactions,pointSpringAssignments:T.pointSpringAssignments,
    pierForces:T.pierForces,pierSection:T.pierSection,sourceId:"DCE_GOLDEN",
    nodalReactionCompressionSign:"compression-positive",pierForceCompressionSign:"compression-negative"
  });
}
function liveImport(){ return importCsiBridgePayload(replay); }

test("Pass 5.2 live bridge contract is read-only/non-numeric",()=>{
  assert.equal(CSI_LIVE_BRIDGE_STATUS.productionNumeric,false);
  assert.match(CSI_LIVE_BRIDGE_STATUS.responsibility,/CONNECT_READ_RAW_EXPORT_ONLY/);
});

test("CSI table alias resolver maps modern joint/pier names",()=>{
  assert.equal(resolveCsiTableRole({tableName:"Joint Coordinates"}),"pointCoordinates");
  assert.equal(resolveCsiTableRole({tableName:"Joint Reactions - General"}),"nodalReactions");
  assert.equal(resolveCsiTableRole({tableName:"Joint Assignments - Springs"}),"pointSpringAssignments");
  assert.equal(resolveCsiTableRole({tableName:"Pier Forces"}),"pierForces");
});

test("bridge flat-table payload expands exact record count",()=>{
  const t=replay.tables.find(t=>t.role==="nodalReactions");
  const rows=csiBridgeTableToRows(t);
  assert.equal(rows.length,38);
  assert.equal(rows[0].Point,"136");
  assert.equal(Number(rows[0].Fz),286.91991774862805);
});

test("live replay uses GetCoordCartesian/JointReact direct arrays as primary",()=>{
  const r=liveImport();
  assert.equal(r.bridge.directCoordinatesUsed,true);
  assert.equal(r.bridge.directJointReactionsUsed,true);
  assert.equal(r.bridge.directVsTableCoordinates.status,"PASS");
  assert.equal(r.bridge.directVsTableCoordinates.checked,194);
  assert.equal(r.bridge.directVsTableReactions.status,"PASS");
  assert.equal(r.bridge.directVsTableReactions.checkedGroups,19);
});

test("live replay canonical counts equal exact DCE canonical counts",()=>{
  const a=dceImport(), b=liveImport();
  for(const k of ["pointCoordinates","pointSpringAssignments","nodalReactionRawRows","nodalReactionEnvelopes","compressionCheckRows","pierForces","pierSection"]){
    assert.equal(b.audit[k],a.audit[k],k);
  }
});

test("live replay all 19 Fz envelopes equal DCE raw-table path",()=>{
  const a=dceImport(), b=liveImport();
  for(const x of a.canonical.nodalReactionEnvelopes){
    const y=b.canonical.nodalReactionEnvelopes.find(z=>z.pointId===x.pointId&&z.combinationId===x.combinationId);
    assert.ok(y); assert.ok(Math.abs(y.FzMax-x.FzMax)<=1e-12); assert.ok(Math.abs(y.FzMin-x.FzMin)<=1e-12);
  }
});

test("live replay preserves all 234 PIERFORCES rows",()=>{
  const a=dceImport(), b=liveImport();
  assert.equal(b.canonical.pierForces.length,234);
  for(let i=0;i<234;i++) for(const k of ["story","pier","combinationId","location","P","V2","V3","T","M2","M3"]) assert.equal(b.canonical.pierForces[i][k],a.canonical.pierForces[i][k],`${i}.${k}`);
});

test("live bridge blocks unverified units",()=>{
  const bad=structuredClone(replay); bad.units={normalizedTo:"kN_m_C",verified:false};
  assert.throws(()=>importCsiBridgePayload(bad),/units are not verified/);
});

test("live bridge requires explicit source-specific sign convention",()=>{
  const bad=structuredClone(replay); delete bad.signConventions;
  assert.throws(()=>importCsiBridgePayload(bad),/must explicitly be/);
});

test("live bridge result contains no capacity/utilization engineering output",()=>{
  const r=liveImport(); const audit=assertImporterContainsNoNumericEngineeringResults(r);
  assert.equal(audit.pass,true,JSON.stringify(audit.offenders));
});

test("live replay handoff reproduces Pass 4 numeric decision once locked capacity is supplied",()=>{
  const r=liveImport(); const cap=350/1.15;
  const pilePoints=r.canonical.pointSpringAssignments.map(s=>{
    const c=r.canonical.pointCoordinates.find(p=>p.pointId===s.pointId);
    return {pileId:s.pileId,x:c.x,y:c.y,compressionCapacityKn:cap,source:"LOCKED_CAPACITY_TEST"};
  });
  const check=checkImportedNodalPileReactions({pilePoints,pointCoordinates:r.handoff.pass4ImportedReaction.pointCoordinates,pointSpringAssignments:r.handoff.pass4ImportedReaction.pointSpringAssignments,nodalReactions:r.handoff.pass4ImportedReaction.nodalReactions,combinationId:"EULS",reactionCompressionSign:"compression-positive"});
  assert.deepEqual(check.reactions.filter(x=>!x.pass).map(x=>x.pointId).sort(),["160","167","168"]);
});

test("CSV parser handles quotes, commas and embedded newlines",()=>{
  const rows=parseCsvText('A,B,C\n1,"x,y","line1\nline2"\n');
  assert.equal(rows.length,1); assert.equal(rows[0].B,"x,y"); assert.equal(rows[0].C,"line1\nline2");
});

test("CSV fallback exact bundle equals DCE canonical counts",()=>{
  const read=n=>fs.readFileSync(path.join(csvDir,n+".csv"),"utf8");
  const r=importStructuralCsvBundle({
    pointCoordinatesCsv:read("pointCoordinates"),nodalReactionsCsv:read("nodalReactions"),pointSpringAssignmentsCsv:read("pointSpringAssignments"),
    pierForcesCsv:read("pierForces"),pierSectionCsv:read("pierSection"),unitsProfile:"kN_m_C",
    nodalReactionCompressionSign:"compression-positive",pierForceCompressionSign:"compression-negative"
  });
  assert.deepEqual({p:r.audit.pointCoordinates,rx:r.audit.nodalReactionRawRows,s:r.audit.pointSpringAssignments,pf:r.audit.pierForces,ps:r.audit.pierSection},{p:194,rx:38,s:19,pf:234,ps:39});
});

test("CSV fallback refuses silent unit assumption",()=>{
  assert.throws(()=>importStructuralCsvBundle({pointCoordinatesCsv:'Point,GlobalX,GlobalY,GlobalZ\n1,0,0,0',nodalReactionsCsv:'Point,OutputCase,Fz\n1,C,1',pointSpringAssignmentsCsv:'Point,Spring\n1,S',nodalReactionCompressionSign:'compression-positive',pierForceCompressionSign:'compression-negative'}),/unitsProfile/);
});

test("Windows bridge runner accepts valid JSON from mocked process",async()=>{
  const execFileImpl=async()=>({stdout:JSON.stringify({ok:true,units:{normalizedTo:'kN_m_C',verified:true}}),stderr:''});
  const r=await runWindowsCsiBridge({executable:'mock.exe',execFileImpl}); assert.equal(r.ok,true);
});

test("Windows bridge runner surfaces bridge errors",async()=>{
  const execFileImpl=async()=>({stdout:JSON.stringify({ok:false,error:'No running ETABS'}),stderr:''});
  await assert.rejects(()=>runWindowsCsiBridge({executable:'mock.exe',execFileImpl}),/No running ETABS/);
});


test("Excel fallback payload requires explicit unit profile and reproduces canonical counts",()=>{
  const excel=structuredClone(replay);
  excel.sourceMode="EXCEL_FALLBACK"; excel.direct={}; excel.units={normalizedTo:"kN_m_C",verified:false};
  assert.throws(()=>importExcelFallbackPayload(excel,{nodalReactionCompressionSign:"compression-positive",pierForceCompressionSign:"compression-negative"}),/unitsProfile/);
  const r=importExcelFallbackPayload(excel,{unitsProfile:"kN_m_C",nodalReactionCompressionSign:"compression-positive",pierForceCompressionSign:"compression-negative"});
  assert.equal(r.audit.pointCoordinates,194); assert.equal(r.audit.nodalReactionRawRows,38); assert.equal(r.audit.pierForces,234);
  assert.equal(r.bridge.directCoordinatesUsed,false); assert.equal(r.bridge.directJointReactionsUsed,false);
});


test("direct-vs-table reaction audit catches live API mismatch",()=>{
  const direct=[{Point:"1",LoadCase:"C",F3:100},{Point:"1",LoadCase:"C",F3:80}];
  const table=[{Point:"1",OutputCase:"C",Fz:100},{Point:"1",OutputCase:"C",Fz:70}];
  const a=auditDirectVsTableReactions(direct,table); assert.equal(a.status,"FAIL"); assert.equal(a.matches,false); assert.equal(a.mismatches[0].type,"FZ");
});

test("live import blocks when JointReact and DatabaseTables disagree",()=>{
  const bad=structuredClone(replay); bad.direct.jointReactions[0].F3 += 0.01;
  assert.throws(()=>importCsiBridgePayload(bad),/direct\/table cross-check failed/);
});
