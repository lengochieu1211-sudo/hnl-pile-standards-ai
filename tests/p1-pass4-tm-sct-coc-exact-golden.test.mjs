import test from "node:test";
import assert from "node:assert/strict";
import { traceTmSctCocRow } from "../src/tm-sct-coc-pattern.js";

const CASES = [{"row": 20, "pointId": "136", "demandKn": 286.919917748628, "capKn": 304.34782608695656, "util": 0.9427368726026347, "pass": true, "statusCached": "OK"}, {"row": 21, "pointId": "137", "demandKn": 260.927826806112, "capKn": 304.34782608695656, "util": 0.8573342880772251, "pass": true, "statusCached": "OK"}, {"row": 22, "pointId": "144", "demandKn": 270.89349858249, "capKn": 304.34782608695656, "util": 0.8900786381996099, "pass": true, "statusCached": "OK"}, {"row": 23, "pointId": "145", "demandKn": 285.1184277096, "capKn": 304.34782608695656, "util": 0.9368176910458285, "pass": true, "statusCached": "OK"}, {"row": 24, "pointId": "146", "demandKn": 297.485906351698, "capKn": 304.34782608695656, "util": 0.9774536922984363, "pass": true, "statusCached": "OK"}, {"row": 25, "pointId": "147", "demandKn": 300.337650867034, "capKn": 304.34782608695656, "util": 0.9868237099916829, "pass": true, "statusCached": "OK"}, {"row": 26, "pointId": "148", "demandKn": 300.045558219307, "capKn": 304.34782608695656, "util": 0.9858639770062942, "pass": true, "statusCached": "OK"}, {"row": 27, "pointId": "159", "demandKn": 303.413682144375, "capKn": 304.34782608695656, "util": 0.9969306699029463, "pass": true, "statusCached": "OK"}, {"row": 28, "pointId": "160", "demandKn": 343.639189746848, "capKn": 304.34782608695656, "util": 1.1291001948825004, "pass": false, "statusCached": "NOT OK"}, {"row": 29, "pointId": "161", "demandKn": 280.227715742439, "capKn": 304.34782608695656, "util": 0.9207482088680137, "pass": true, "statusCached": "OK"}, {"row": 30, "pointId": "167", "demandKn": 310.901779033709, "capKn": 304.34782608695656, "util": 1.0215344168250438, "pass": false, "statusCached": "NOT OK"}, {"row": 31, "pointId": "168", "demandKn": 365.292050700582, "capKn": 304.34782608695656, "util": 1.2002453094447694, "pass": false, "statusCached": "NOT OK"}, {"row": 32, "pointId": "169", "demandKn": 290.521381936257, "capKn": 304.34782608695656, "util": 0.9545702549334157, "pass": true, "statusCached": "OK"}, {"row": 33, "pointId": "170", "demandKn": 285.949573636969, "capKn": 304.34782608695656, "util": 0.939548599092898, "pass": true, "statusCached": "OK"}, {"row": 34, "pointId": "171", "demandKn": 285.780825879486, "capKn": 304.34782608695656, "util": 0.9389941421754538, "pass": true, "statusCached": "OK"}, {"row": 35, "pointId": "172", "demandKn": 282.454353023628, "capKn": 304.34782608695656, "util": 0.9280643027919205, "pass": true, "statusCached": "OK"}, {"row": 36, "pointId": "177", "demandKn": 284.158695264875, "capKn": 304.34782608695656, "util": 0.9336642844417321, "pass": true, "statusCached": "OK"}, {"row": 37, "pointId": "178", "demandKn": 275.855954258927, "capKn": 304.34782608695656, "util": 0.9063838497079029, "pass": true, "statusCached": "OK"}, {"row": 38, "pointId": "179", "demandKn": 273.635492783287, "capKn": 304.34782608695656, "util": 0.8990880477165144, "pass": true, "statusCached": "OK"}];
for (const c of CASES) {
  test(`TM SCT Coc exact cached row ${c.row}`, () => {
    const result = traceTmSctCocRow({
      pointId: c.pointId,
      combinationId: "EULS",
      pointCoordinates: [{pointId:c.pointId,x:0,y:0}],
      pointSpringAssignments: [{pointId:c.pointId,pileId:`P${c.row}`}],
      nodalReactions: [{pointId:c.pointId,combinationId:"EULS",Fz:c.demandKn}],
      pileCapacities: [{pileId:`P${c.row}`,compressionCapacityKn:c.capKn,source:"XLSM_REFERENCE"}],
      reactionCompressionSign: "compression-positive"
    });
    assert.ok(Math.abs(result.trace.ACTION.demandKn-c.demandKn)<1e-9);
    assert.ok(Math.abs(result.trace.CAPACITY.capacityUsedKn-c.capKn)<1e-9);
    assert.ok(Math.abs(result.trace.UTILIZATION.utilization-c.util)<1e-12);
    assert.equal(result.trace.STATUS.pass,c.pass);
    assert.equal(result.trace.STATUS.status, c.statusCached==="OK" ? "PASS":"FAIL");
  });
}
