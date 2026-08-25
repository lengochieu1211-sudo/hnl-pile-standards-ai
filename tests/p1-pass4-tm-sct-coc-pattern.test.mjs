import test from "node:test";
import assert from "node:assert/strict";
import {
  TM_SCT_COC_BLOCKS,
  traceTmSctCocRow,
  reconstructTmSctCocFixture
} from "../src/tm-sct-coc-pattern.js";

const coords = [
  {pointId:"N1",x:-1,y:-1,z:0},{pointId:"N2",x:1,y:-1,z:0},
  {pointId:"N3",x:-1,y:1,z:0},{pointId:"N4",x:1,y:1,z:0}
];
const springs = [
  {pointId:"N1",pileId:"P1"},{pointId:"N2",pileId:"P2"},
  {pointId:"N3",pileId:"P3"},{pointId:"N4",pileId:"P4"}
];
const caps = [
  {pileId:"P1",compressionCapacityKn:800,tensionCapacityKn:200,source:"VERIFIED"},
  {pileId:"P2",compressionCapacityKn:800,tensionCapacityKn:200,source:"VERIFIED"},
  {pileId:"P3",compressionCapacityKn:800,tensionCapacityKn:200,source:"VERIFIED"},
  {pileId:"P4",compressionCapacityKn:800,tensionCapacityKn:200,source:"VERIFIED"}
];
const reactions = [
  {pointId:"N1",combinationId:"C1",Fz:-400},
  {pointId:"N2",combinationId:"C1",Fz:-500},
  {pointId:"N3",combinationId:"C1",Fz:-600},
  {pointId:"N4",combinationId:"C1",Fz:-700},
  {pointId:"N1",combinationId:"C2",Fz:-300},
  {pointId:"N2",combinationId:"C2",Fz:-350},
  {pointId:"N3",combinationId:"C2",Fz:-650},
  {pointId:"N4",combinationId:"C2",Fz:-400}
];

test("five formula-pattern blocks are ordered join→action→capacity→utilization→status", () => {
  assert.deepEqual(TM_SCT_COC_BLOCKS.map(x=>x.id), ["JOIN","ACTION","CAPACITY","UTILIZATION","STATUS"]);
});
test("per-block formula counts are not fabricated", () => {
  assert.ok(TM_SCT_COC_BLOCKS.every(x=>x.formulaCount === "PENDING_CELL_INVENTORY"));
});
test("JOIN resolves point, pile and coordinates", () => {
  const r=traceTmSctCocRow({pointId:"N1",combinationId:"C1",pointCoordinates:coords,pointSpringAssignments:springs,nodalReactions:reactions,pileCapacities:caps});
  assert.equal(r.trace.JOIN.status,"PASS"); assert.equal(r.pileId,"P1"); assert.equal(r.trace.JOIN.coordinate.x,-1);
});
test("JOIN blocks missing coordinate", () => {
  const r=traceTmSctCocRow({pointId:"N1",combinationId:"C1",pointCoordinates:coords.slice(1),pointSpringAssignments:springs,nodalReactions:reactions,pileCapacities:caps});
  assert.equal(r.overall,"BLOCK"); assert.equal(r.blockingBlock,"JOIN");
});
test("JOIN blocks missing reaction", () => {
  const r=traceTmSctCocRow({pointId:"N1",combinationId:"NONE",pointCoordinates:coords,pointSpringAssignments:springs,nodalReactions:reactions,pileCapacities:caps});
  assert.equal(r.blockingBlock,"JOIN"); assert.ok(r.trace.JOIN.missing.includes("Nodal Reactions"));
});
test("ACTION converts compression-negative Fz", () => {
  const r=traceTmSctCocRow({pointId:"N1",combinationId:"C1",pointCoordinates:coords,pointSpringAssignments:springs,nodalReactions:reactions,pileCapacities:caps});
  assert.equal(r.trace.ACTION.rawFzKn,-400); assert.equal(r.trace.ACTION.demandKn,400); assert.equal(r.trace.ACTION.checkType,"COMPRESSION");
});
test("ACTION supports compression-positive", () => {
  const rx=[{pointId:"N1",combinationId:"C",Fz:400}];
  const r=traceTmSctCocRow({pointId:"N1",combinationId:"C",pointCoordinates:coords,pointSpringAssignments:springs,nodalReactions:rx,pileCapacities:caps,reactionCompressionSign:"compression-positive"});
  assert.equal(r.trace.ACTION.demandKn,400);
});
test("CAPACITY uses compression capacity for compression", () => {
  const r=traceTmSctCocRow({pointId:"N2",combinationId:"C1",pointCoordinates:coords,pointSpringAssignments:springs,nodalReactions:reactions,pileCapacities:caps});
  assert.equal(r.trace.CAPACITY.capacityUsedKn,800);
});
test("CAPACITY blocks tension without verified tension capacity", () => {
  const rx=[{pointId:"N1",combinationId:"UP",Fz:100}];
  const noT=caps.map(x=>({...x,tensionCapacityKn:null}));
  const r=traceTmSctCocRow({pointId:"N1",combinationId:"UP",pointCoordinates:coords,pointSpringAssignments:springs,nodalReactions:rx,pileCapacities:noT});
  assert.equal(r.overall,"BLOCK"); assert.equal(r.blockingBlock,"CAPACITY");
});
test("UTILIZATION computes demand/capacity", () => {
  const r=traceTmSctCocRow({pointId:"N4",combinationId:"C1",pointCoordinates:coords,pointSpringAssignments:springs,nodalReactions:reactions,pileCapacities:caps});
  assert.equal(r.trace.UTILIZATION.utilization,0.875);
});
test("STATUS exact capacity is PASS AT_CAPACITY", () => {
  const rx=[{pointId:"N1",combinationId:"B",Fz:-800}];
  const r=traceTmSctCocRow({pointId:"N1",combinationId:"B",pointCoordinates:coords,pointSpringAssignments:springs,nodalReactions:rx,pileCapacities:caps});
  assert.equal(r.overall,"PASS"); assert.equal(r.trace.STATUS.boundary,"AT_CAPACITY");
});
test("STATUS above capacity is FAIL", () => {
  const rx=[{pointId:"N1",combinationId:"B",Fz:-800.001}];
  const r=traceTmSctCocRow({pointId:"N1",combinationId:"B",pointCoordinates:coords,pointSpringAssignments:springs,nodalReactions:rx,pileCapacities:caps});
  assert.equal(r.overall,"FAIL"); assert.equal(r.trace.STATUS.boundary,"ABOVE_CAPACITY");
});
test("tension with capacity is checked independently", () => {
  const rx=[{pointId:"N1",combinationId:"UP",Fz:150}];
  const r=traceTmSctCocRow({pointId:"N1",combinationId:"UP",pointCoordinates:coords,pointSpringAssignments:springs,nodalReactions:rx,pileCapacities:caps});
  assert.equal(r.trace.ACTION.checkType,"TENSION"); assert.equal(r.trace.STATUS.utilization,0.75); assert.equal(r.overall,"PASS");
});
test("fixture generates 8 rows for 4 piles × 2 combinations", () => {
  const r=reconstructTmSctCocFixture({pointCoordinates:coords,pointSpringAssignments:springs,nodalReactions:reactions,pileCapacities:caps,combinationIds:["C1","C2"]});
  assert.equal(r.summary.totalRows,8); assert.equal(r.summary.block,0);
});
test("fixture governing row is C1/P4 at utilization .875", () => {
  const r=reconstructTmSctCocFixture({pointCoordinates:coords,pointSpringAssignments:springs,nodalReactions:reactions,pileCapacities:caps,combinationIds:["C1","C2"]});
  assert.equal(r.summary.governing.combinationId,"C1"); assert.equal(r.summary.governing.pileId,"P4"); assert.equal(r.summary.governing.utilization,0.875);
});
