import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { runPass6StructuralWorkflow } from '../src/pass6-structural-workflow.js';

const fixture=JSON.parse(fs.readFileSync('artifacts/p1-pass5-dce-table-bundle-fixture-v13.json','utf8'));
const pq=JSON.parse(fs.readFileSync('artifacts/pile-quantity-golden-v1.25.7.json','utf8'));
const csvDir=path.resolve('artifacts/p1-pass5-csv-fallback-v14');
const read=(n)=>fs.readFileSync(path.join(csvDir,`${n}.csv`),'utf8');
const capacity={
  status:'LOCKED_MULTI_BOREHOLE_INTEGRATED',
  RpileKn:pq.baseCase.capacity.RpileKn,
  gammaN:pq.baseCase.capacity.gammaN,
  NdMaxPerPileKn:pq.baseCase.capacity.NdMaxPerPileKn,
  sourceModule:'PileCapacityEngine / MultiBoreholePileEngine',
  sourceArtifact:'pile-quantity-golden-v1.25.7.json / LOCKED-RPILE-MIN',
  governingBasis:'Rpile=min(Rsoil,Rmaterial), then Nd,max=Rpile/gammaN'
};
const dce=runPass6StructuralWorkflow({source:{kind:'DCE_TABLES',tables:fixture.tables,sourceId:'DCE_EXACT_PASS6_GOLDEN',nodalReactionCompressionSign:'compression-positive',pierForceCompressionSign:'compression-negative'},lockedCapacity:capacity});
const csv=runPass6StructuralWorkflow({source:{kind:'CSV',sourceId:'CSV_EXACT_PASS6_GOLDEN',unitsProfile:'kN_m_C',nodalReactionCompressionSign:'compression-positive',pierForceCompressionSign:'compression-negative',pointCoordinatesCsv:read('pointCoordinates'),nodalReactionsCsv:read('nodalReactions'),pointSpringAssignmentsCsv:read('pointSpringAssignments'),pierForcesCsv:read('pierForces'),pierSectionCsv:read('pierSection')},lockedCapacity:capacity});
const cm=new Map(csv.rows.map(r=>[`${r.combinationId}/${r.pointId}`,r]));
const parity=dce.rows.map(r=>{const q=cm.get(`${r.combinationId}/${r.pointId}`); return {pointId:r.pointId,combinationId:r.combinationId,demandDiffKn:r.demandKn-q.demandKn,capacityDiffKn:r.capacityKn-q.capacityKn,utilizationDiff:r.utilization-q.utilization,statusMatch:r.pass===q.pass,pass:Math.abs(r.demandKn-q.demandKn)<1e-9&&Math.abs(r.capacityKn-q.capacityKn)<1e-9&&Math.abs(r.utilization-q.utilization)<1e-12&&r.pass===q.pass};});
const golden={
 schema:'HNL-P1-PASS6-E2E-GOLDEN',version:'1.25.7',generatedAt:new Date().toISOString(),
 scope:'CSV/DCE Import -> Pass5 canonical -> Pass4 imported reaction -> LOCKED Rpile/gammaN -> governing pile -> report model',
 authority:['Upstream TCVN/PileCapacity LOCKED capacity remains normative','Pass5 Core importer LOCKED','Pass4 imported nodal-reaction numeric core LOCKED','DCE workbook is behavioral/reference structural dataset'],
 capacity,
 expected:{pileCount:19,combinationIds:['EULS'],checkRows:19,passRows:19,failRows:0,blockedRows:0,governingPileId:'168',governingPointId:'168',governingCombinationId:'EULS',governingDemandKn:365.2920507005818,governingCapacityKn:733.4161490683232,governingUtilization:0.4980692764464232,overallPass:true},
 dceResult:dce,
 csvResult:{summary:csv.summary,governing:csv.governing,importAudit:csv.importAudit,provenance:csv.provenance},
 sourceParity:{rows:parity.length,pass:parity.filter(x=>x.pass).length,fail:parity.filter(x=>!x.pass).length,allPass:parity.every(x=>x.pass),rowsDetail:parity},
 safety:{manualCapacityBlocked:true,inconsistentCapacityBlocked:true,unknownCombinationBlocked:true,dceRd350NotProductionCapacity:true,analyticalRigidCapNotInvoked:true},
 pass:dce.summary.overallPass&&csv.summary.overallPass&&parity.every(x=>x.pass)
};
fs.writeFileSync('artifacts/p1-pass6-e2e-golden-v17.json',JSON.stringify(golden,null,2));
console.log(JSON.stringify({pass:golden.pass,summary:dce.summary,governing:dce.governing,parity:golden.sourceParity},null,2));
