import fs from 'node:fs';
import { importCsiBridgePayload } from '../src/csi-live-bridge.js';
import { importDceStructuralTableBundle } from '../src/etabs-sap-importer.js';

function arg(name,def=null){const i=process.argv.indexOf(name);return i>=0?process.argv[i+1]:def;}
function has(name){return process.argv.includes(name);}
function read(p){return JSON.parse(fs.readFileSync(p,'utf8'));}
function close(a,b,tol=1e-6){return Math.abs(Number(a)-Number(b))<=Math.max(tol,tol*Math.max(1,Math.abs(Number(a)),Math.abs(Number(b))));}
function keyPier(r){return `${r.story}\0${r.pier}\0${r.combinationId}\0${r.location}`;}

const livePath=arg('--live'), fixturePath=arg('--dce-fixture'), outPath=arg('--out','p1-pass5-live-golden-result.json');
const mode=arg('--mode','live');
if(!livePath||!fixturePath) throw new Error('--live and --dce-fixture are required');
if(!['live','replay'].includes(mode)) throw new Error('--mode must be live or replay');

const livePayload=read(livePath), f=read(fixturePath), T=f.tables;
const nodalSign=arg('--nodal-sign','compression-positive'), pierSign=arg('--pier-sign','compression-negative');
const live=importCsiBridgePayload(livePayload,{nodalReactionCompressionSign:nodalSign,pierForceCompressionSign:pierSign});
const ref=importDceStructuralTableBundle({
  pointCoordinates:T.pointCoordinates,nodalReactions:T.nodalReactions,pointSpringAssignments:T.pointSpringAssignments,
  pierForces:T.pierForces,pierSection:T.pierSection,sourceId:'DCE_REFERENCE',
  nodalReactionCompressionSign:nodalSign,pierForceCompressionSign:pierSign
});
const issues=[];

const coordRef=new Map(ref.canonical.pointCoordinates.map(r=>[r.pointId,r]));
let coordChecked=0;
for(const r of live.canonical.pointCoordinates){
  const x=coordRef.get(r.pointId);
  if(!x){issues.push({type:'COORD_EXTRA',pointId:r.pointId});continue;}
  coordChecked++;
  if(!close(r.x,x.x)||!close(r.y,x.y)||!close(r.z,x.z))
    issues.push({type:'COORD',pointId:r.pointId,live:[r.x,r.y,r.z],ref:[x.x,x.y,x.z]});
}

const envRef=new Map(ref.canonical.nodalReactionEnvelopes.map(r=>[`${r.pointId}\0${r.combinationId}`,r]));
let envChecked=0;
for(const r of live.canonical.nodalReactionEnvelopes){
  const x=envRef.get(`${r.pointId}\0${r.combinationId}`);
  if(!x){issues.push({type:'FZ_ENVELOPE_EXTRA',pointId:r.pointId,combinationId:r.combinationId});continue;}
  envChecked++;
  if(!close(r.FzMax,x.FzMax)||!close(r.FzMin,x.FzMin))
    issues.push({type:'FZ_ENVELOPE',pointId:r.pointId,combinationId:r.combinationId,live:[r.FzMin,r.FzMax],ref:[x.FzMin,x.FzMax]});
}

const pfRef=new Map(ref.canonical.pierForces.map(r=>[keyPier(r),r]));
let pierChecked=0;
for(const r of live.canonical.pierForces){
  const x=pfRef.get(keyPier(r));
  if(!x){issues.push({type:'PIERFORCE_EXTRA',key:keyPier(r)});continue;}
  pierChecked++;
  for(const k of ['P','V2','V3','T','M2','M3']){
    if(!close(r[k],x[k])){
      issues.push({type:'PIERFORCE',key:keyPier(r),field:k,live:r[k],ref:x[k]});
      break;
    }
  }
}

const expected={
  coordinates:ref.canonical.pointCoordinates.length,
  nodalEnvelopes:ref.canonical.nodalReactionEnvelopes.length,
  pierForces:ref.canonical.pierForces.length,
  pointSpringAssignments:ref.canonical.pointSpringAssignments.length,
  pierSection:ref.canonical.pierSection.length
};

const coverage={
  coordinates:coordChecked===expected.coordinates && live.canonical.pointCoordinates.length===expected.coordinates,
  nodalEnvelopes:envChecked===expected.nodalEnvelopes && live.canonical.nodalReactionEnvelopes.length===expected.nodalEnvelopes,
  pierForces:pierChecked===expected.pierForces && live.canonical.pierForces.length===expected.pierForces,
  pointSpringAssignments:live.canonical.pointSpringAssignments.length===expected.pointSpringAssignments,
  pierSection:live.canonical.pierSection.length===expected.pierSection
};
for(const [k,v] of Object.entries(coverage)) if(!v) issues.push({type:'COVERAGE',dataset:k,live:{
  coordinates:live.canonical.pointCoordinates.length,
  nodalEnvelopes:live.canonical.nodalReactionEnvelopes.length,
  pierForces:live.canonical.pierForces.length,
  pointSpringAssignments:live.canonical.pointSpringAssignments.length,
  pierSection:live.canonical.pierSection.length
}[k],expected:expected[k]});

const coordCross=live.bridge.directVsTableCoordinates;
const rxCross=live.bridge.directVsTableReactions;
if(coordCross?.status!=='PASS' || coordCross?.matches!==true || coordCross?.checked!==expected.coordinates)
  issues.push({type:'LIVE_CROSSCHECK_COORD',audit:coordCross});
if(rxCross?.status!=='PASS' || rxCross?.matches!==true || rxCross?.checkedGroups!==expected.nodalEnvelopes)
  issues.push({type:'LIVE_CROSSCHECK_REACTION',audit:rxCross});

if(livePayload.units?.normalizedTo!=='kN_m_C' || livePayload.units?.verified!==true)
  issues.push({type:'UNITS_NOT_VERIFIED',units:livePayload.units});

if(mode==='live'){
  if(livePayload.sourceMode!=='LIVE_API') issues.push({type:'NOT_LIVE_API',sourceMode:livePayload.sourceMode});
  if(!livePayload.modelFile) issues.push({type:'MODEL_FILE_MISSING'});
  if(livePayload.unitRestore?.restored!==true) issues.push({type:'UNITS_NOT_RESTORED',unitRestore:livePayload.unitRestore});
}

const result={
 schema:'HNL-P1-PASS5-LIVE-GOLDEN-RESULT',
 version:'1.25.7',
 mode,
 generatedAt:new Date().toISOString(),
 live:{
   product:live.bridge.product,apiVersion:live.bridge.apiVersion,modelFile:live.bridge.modelFile,
   sourceMode:live.bridge.sourceMode,units:live.bridge.units,unitRestore:livePayload.unitRestore??null,
   directVsTableCoordinates:coordCross,directVsTableReactions:rxCross
 },
 checked:{coordinates:coordChecked,nodalEnvelopes:envChecked,pierForces:pierChecked},
 expectedReference:expected,
 coverage,
 issues,
 pass:issues.length===0,
 lockRule:'Full Pass 5 may be promoted only from mode=live after exact coverage, cross-checks, unit restore, prior gates and Search Brain hash all PASS.'
};
fs.writeFileSync(outPath,JSON.stringify(result,null,2));
console.log(JSON.stringify(result,null,2));
if(!result.pass) process.exitCode=2;
