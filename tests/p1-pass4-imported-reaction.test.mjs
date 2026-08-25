import test from "node:test";
import assert from "node:assert/strict";
import {
  checkImportedNodalPileReactions,
  checkImportedNodalPileReactionEnvelope,
  PILE_REACTION_MODES
} from "../src/pile-reaction-engine.js";

const piles = [
  { pileId:"P1", x:-1, y:-1, compressionCapacityKn:800, sourceBorehole:"HK1", method:"SPT" },
  { pileId:"P2", x: 1, y:-1, compressionCapacityKn:800, sourceBorehole:"HK1", method:"SPT" },
  { pileId:"P3", x:-1, y: 1, compressionCapacityKn:700, sourceBorehole:"HK2", method:"MECH" },
  { pileId:"P4", x: 1, y: 1, compressionCapacityKn:800, sourceBorehole:"HK2", method:"MECH" }
];
const coords = [
  {pointId:"N1",x:-1,y:-1,z:0},{pointId:"N2",x:1,y:-1,z:0},
  {pointId:"N3",x:-1,y:1,z:0},{pointId:"N4",x:1,y:1,z:0}
];
const springs = [
  {pointId:"N1",pileId:"P1"},{pointId:"N2",pileId:"P2"},
  {pointId:"N3",pileId:"P3"},{pointId:"N4",pileId:"P4"}
];
const reactions = [
  {pointId:"N1",combinationId:"C1",Fz:-400,Fx:1,Fy:2,Mx:3,My:4,Mz:5},
  {pointId:"N2",combinationId:"C1",Fz:-500},
  {pointId:"N3",combinationId:"C1",Fz:-600},
  {pointId:"N4",combinationId:"C1",Fz:-700},
  {pointId:"N1",combinationId:"C2",Fz:-300},
  {pointId:"N2",combinationId:"C2",Fz:-350},
  {pointId:"N3",combinationId:"C2",Fz:-650},
  {pointId:"N4",combinationId:"C2",Fz:-400}
];

test("imported mode joins point->spring->pile and normalizes compression-negative Fz",()=>{
  const r=checkImportedNodalPileReactions({pilePoints:piles,pointCoordinates:coords,pointSpringAssignments:springs,nodalReactions:reactions,combinationId:"C1"});
  assert.equal(r.model,PILE_REACTION_MODES.IMPORTED_NODAL_REACTION);
  assert.equal(r.reactions.length,4);
  assert.deepEqual(r.reactions.map(x=>x.demandKn),[400,500,600,700]);
  assert.equal(r.pass,true);
});

test("imported checker preserves coordinates and action metadata",()=>{
  const r=checkImportedNodalPileReactions({pilePoints:piles,pointCoordinates:coords,pointSpringAssignments:springs,nodalReactions:reactions,combinationId:"C1"});
  const p1=r.reactions[0];
  assert.equal(p1.x,-1); assert.equal(p1.y,-1); assert.equal(p1.z,0);
  assert.equal(p1.importedActions.FxKn,1); assert.equal(p1.importedActions.MzKnm,5);
});

test("governing pile is by utilization, not maximum compression demand",()=>{
  const r=checkImportedNodalPileReactions({pilePoints:piles,pointCoordinates:coords,pointSpringAssignments:springs,nodalReactions:reactions,combinationId:"C1"});
  assert.equal(r.maxCompressionPile.pileId,"P4");
  // P3 = 600/700=.8571, P4=700/800=.875 => P4 governs here.
  assert.equal(r.governingPile.pileId,"P4");
  const altered=piles.map(p=>p.pileId==="P3"?{...p,compressionCapacityKn:650}:p);
  const r2=checkImportedNodalPileReactions({pilePoints:altered,pointCoordinates:coords,pointSpringAssignments:springs,nodalReactions:reactions,combinationId:"C1"});
  assert.equal(r2.maxCompressionPile.pileId,"P4");
  assert.equal(r2.governingPile.pileId,"P3");
});

test("exact compression capacity boundary passes",()=>{
  const rr=reactions.map(r=>r.combinationId==="C1"&&r.pointId==="N4"?{...r,Fz:-800}:r);
  const r=checkImportedNodalPileReactions({pilePoints:piles,pointCoordinates:coords,pointSpringAssignments:springs,nodalReactions:rr,combinationId:"C1"});
  assert.equal(r.reactions.find(x=>x.pileId==="P4").utilization,1);
  assert.equal(r.pass,true);
});

test("epsilon over compression capacity fails",()=>{
  const rr=reactions.map(r=>r.combinationId==="C1"&&r.pointId==="N4"?{...r,Fz:-800.01}:r);
  const r=checkImportedNodalPileReactions({pilePoints:piles,pointCoordinates:coords,pointSpringAssignments:springs,nodalReactions:rr,combinationId:"C1"});
  assert.equal(r.pass,false);
});

test("tension without verified tension capacity blocks",()=>{
  const rr=reactions.map(r=>r.combinationId==="C1"&&r.pointId==="N1"?{...r,Fz:100}:r);
  const r=checkImportedNodalPileReactions({pilePoints:piles,pointCoordinates:coords,pointSpringAssignments:springs,nodalReactions:rr,combinationId:"C1"});
  assert.equal(r.hasTension,true); assert.equal(r.anyUnverifiedTension,true); assert.equal(r.pass,false);
  assert.equal(r.reactions.find(x=>x.pileId==="P1").blockReason,"NO_VERIFIED_TENSION_CAPACITY");
});

test("verified tension capacity is checked separately",()=>{
  const pp=piles.map(p=>p.pileId==="P1"?{...p,tensionCapacityKn:120}:p);
  const rr=reactions.map(r=>r.combinationId==="C1"&&r.pointId==="N1"?{...r,Fz:100}:r);
  const r=checkImportedNodalPileReactions({pilePoints:pp,pointCoordinates:coords,pointSpringAssignments:springs,nodalReactions:rr,combinationId:"C1"});
  assert.equal(r.reactions.find(x=>x.pileId==="P1").utilization,100/120);
  assert.equal(r.pass,true);
});

test("missing coordinate blocks strict join",()=>{
  assert.throws(()=>checkImportedNodalPileReactions({pilePoints:piles,pointCoordinates:coords.slice(1),pointSpringAssignments:springs,nodalReactions:reactions,combinationId:"C1"}),/join incomplete/);
});

test("missing reaction blocks strict join",()=>{
  const rr=reactions.filter(r=>!(r.combinationId==="C1"&&r.pointId==="N4"));
  assert.throws(()=>checkImportedNodalPileReactions({pilePoints:piles,pointCoordinates:coords,pointSpringAssignments:springs,nodalReactions:rr,combinationId:"C1"}),/join incomplete/);
});

test("reaction point without spring assignment blocks strict join",()=>{
  const rr=[...reactions,{pointId:"N99",combinationId:"C1",Fz:-10}];
  assert.throws(()=>checkImportedNodalPileReactions({pilePoints:piles,pointCoordinates:coords,pointSpringAssignments:springs,nodalReactions:rr,combinationId:"C1"}),/without spring assignment/);
});

test("duplicate nodal reaction for same point/combo blocks",()=>{
  const rr=[...reactions,{pointId:"N1",combinationId:"C1",Fz:-410}];
  assert.throws(()=>checkImportedNodalPileReactions({pilePoints:piles,pointCoordinates:coords,pointSpringAssignments:springs,nodalReactions:rr,combinationId:"C1"}),/Duplicate nodal reaction/);
});

test("imported envelope identifies governing combination and pile",()=>{
  const env=checkImportedNodalPileReactionEnvelope({pilePoints:piles,pointCoordinates:coords,pointSpringAssignments:springs,nodalReactions:reactions,combinationIds:["C1","C2"]});
  assert.equal(env.cases.length,2);
  assert.equal(env.envelope.maxCompression.combinationId,"C1");
  assert.equal(env.envelope.maxCompression.pileId,"P4");
  assert.equal(env.envelope.governing.combinationId,"C2");
  assert.equal(env.envelope.governing.pileId,"P3");
});
