import test from "node:test";
import assert from "node:assert/strict";
import {
  calculatePileReactions,
  calculatePileReactionEnvelope
} from "../src/pile-reaction-engine.js";

const cap4 = [
  { pileId: "P1", x: -1, y: -1, compressionCapacityKn: 800 },
  { pileId: "P2", x:  1, y: -1, compressionCapacityKn: 800 },
  { pileId: "P3", x: -1, y:  1, compressionCapacityKn: 800 },
  { pileId: "P4", x:  1, y:  1, compressionCapacityKn: 800 }
];

test("pure N distributes equally", () => {
  const r = calculatePileReactions({
    loadCombination: { id: "ULS-N", N: 2000, Mx: 0, My: 0 },
    pilePoints: cap4
  });
  assert.equal(r.equilibrium.pass, true);
  assert.equal(r.pass, true);
  for (const p of r.reactions) assert.ok(Math.abs(p.demandKn - 500) < 1e-9);
});

test("Mx produces linear y-gradient and exact equilibrium", () => {
  const r = calculatePileReactions({
    loadCombination: { id: "ULS-MX", N: 2000, Mx: 400, My: 0 },
    pilePoints: cap4
  });
  assert.equal(r.equilibrium.pass, true);
  const bottom = r.reactions.filter(p => p.y === -1).map(p => p.demandKn);
  const top = r.reactions.filter(p => p.y === 1).map(p => p.demandKn);
  assert.deepEqual(bottom, [400, 400]);
  assert.deepEqual(top, [600, 600]);
});

test("general asymmetric layout satisfies coupled Σxy equilibrium", () => {
  const pts = [
    { pileId: "P1", x: 0, y: 0, compressionCapacityKn: 2000 },
    { pileId: "P2", x: 2, y: 0, compressionCapacityKn: 2000 },
    { pileId: "P3", x: 0.5, y: 1.5, compressionCapacityKn: 2000 }
  ];
  const r = calculatePileReactions({
    loadCombination: { id: "ASYM", N: 1800, Mx: 240, My: 360 },
    pilePoints: pts
  });
  assert.equal(r.equilibrium.pass, true);
  assert.ok(Math.abs(r.equilibrium.residualNKn) < 1e-8);
  assert.ok(Math.abs(r.equilibrium.residualMxKnm) < 1e-8);
  assert.ok(Math.abs(r.equilibrium.residualMyKnm) < 1e-8);
});

test("compression-negative sign is explicit", () => {
  const r = calculatePileReactions({
    loadCombination: { id: "ETABS", N: -2000, Mx: 0, My: 0 },
    pilePoints: cap4,
    compressionSign: "compression-negative"
  });
  assert.equal(r.actions.NKn, 2000);
  assert.equal(r.pass, true);
});

test("compression utilization failure is detected", () => {
  const weak = cap4.map(p => ({ ...p, compressionCapacityKn: 400 }));
  const r = calculatePileReactions({
    loadCombination: { id: "OVER", N: 2000, Mx: 0, My: 0 },
    pilePoints: weak
  });
  assert.equal(r.pass, false);
  assert.equal(r.governingPile.utilization, 1.25);
});

test("tension without verified capacity blocks", () => {
  const r = calculatePileReactions({
    loadCombination: { id: "UPLIFT", N: 200, Mx: 1200, My: 0 },
    pilePoints: cap4
  });
  assert.equal(r.hasTension, true);
  assert.equal(r.anyUnverifiedTension, true);
  assert.equal(r.pass, false);
});

test("tension capacity can be checked explicitly", () => {
  const pts = cap4.map(p => ({ ...p, tensionCapacityKn: 300 }));
  const r = calculatePileReactions({
    loadCombination: { id: "UPLIFT-CHECKED", N: 200, Mx: 800, My: 0 },
    pilePoints: pts
  });
  assert.equal(r.hasTension, true);
  assert.equal(r.anyUnverifiedTension, false);
});

test("Vx/Vy/T are metadata only and trigger warning", () => {
  const r = calculatePileReactions({
    loadCombination: { id: "WITH-SHEAR", N: 2000, Mx: 0, My: 0, Vx: 50, Vy: 30, T: 10 },
    pilePoints: cap4
  });
  assert.equal(r.pass, true);
  assert.equal(r.warnings.length, 1);
});

test("duplicate pile IDs block", () => {
  assert.throws(() => calculatePileReactions({
    loadCombination: { id: "X", N: 100 },
    pilePoints: [
      { pileId: "P1", x: 0, y: 0, compressionCapacityKn: 800 },
      { pileId: "P1", x: 1, y: 0, compressionCapacityKn: 800 }
    ]
  }), /Duplicate pileId/);
});

test("singular collinear layout blocks moment distribution", () => {
  assert.throws(() => calculatePileReactions({
    loadCombination: { id: "SINGULAR", N: 1000, Mx: 100, My: 100 },
    pilePoints: [
      { pileId: "P1", x: -1, y: 0, compressionCapacityKn: 800 },
      { pileId: "P2", x: 0, y: 0, compressionCapacityKn: 800 },
      { pileId: "P3", x: 1, y: 0, compressionCapacityKn: 800 }
    ]
  }), /singular/);
});

test("envelope changes governing combination", () => {
  const env = calculatePileReactionEnvelope({
    pilePoints: cap4,
    loadCombinations: [
      { id: "C1", N: 1600, Mx: 0, My: 0 },
      { id: "C2", N: 1200, Mx: 800, My: 0 }
    ]
  });
  assert.equal(env.cases.length, 2);
  assert.equal(env.envelope.maxCompression.combinationId, "C2");
});

test("duplicate combination ID blocks", () => {
  assert.throws(() => calculatePileReactionEnvelope({
    pilePoints: cap4,
    loadCombinations: [
      { id: "C1", N: 1000 },
      { id: "C1", N: 1200 }
    ]
  }), /Duplicate combinationId/);
});
