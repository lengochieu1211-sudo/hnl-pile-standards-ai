import test from "node:test";
import assert from "node:assert/strict";
import {
  dceNhomCocLabel,
  dceProximityGroupForPile,
  dceProximityGroups
} from "../src/tm-sct-coc-grouping-engine.js";

test("NhomCoc exact bin labels", () => {
  assert.equal(dceNhomCocLabel(1), "Đài 1 cọc");
  assert.equal(dceNhomCocLabel(2), "Đài 2 - 5 cọc");
  assert.equal(dceNhomCocLabel(5), "Đài 2 - 5 cọc");
  assert.equal(dceNhomCocLabel(6), "Đài 6 - 10 cọc");
  assert.equal(dceNhomCocLabel(10), "Đài 6 - 10 cọc");
  assert.equal(dceNhomCocLabel(11), "Đài 11 - 20 cọc");
  assert.equal(dceNhomCocLabel(20), "Đài 11 - 20 cọc");
  assert.equal(dceNhomCocLabel(21), "Đài >20 cọc");
});
test("NhomCoc preserves VBA empty behavior for zero/negative/gap 1<n<2", () => {
  assert.equal(dceNhomCocLabel(0), "");
  assert.equal(dceNhomCocLabel(-2), "");
  assert.equal(dceNhomCocLabel(1.5), "");
});
test("NhomCoc supports custom prefix/suffix exactly", () => {
  assert.equal(dceNhomCocLabel(3, "Group ", " piles"), "Group 2 - 5 piles");
});

const workbookPiles = [
  ["136",1850,4960,1],["137",1680,4030,1],["144",750,4030,1],["145",750,4960,1],
  ["146",3330,5390,3],["147",4070,5480,3],["148",4810,5570,3],
  ["159",7190,5720,3],["160",7930,5810,3],["161",8200,5110,3],
  ["167",6900,460,3],["168",7650,460,3],["169",7650,1100,3],
  ["170",4820,490,3],["171",4070,490,3],["172",3320,490,3],
  ["177",1980,460,3],["178",1230,460,3],["179",480,460,3]
].map(([pointName,xMm,yMm,expected]) => ({pointName,xMm,yMm,diameterMm:250,expected}));

test("current workbook P1=3.5 gives 875 mm threshold", () => {
  const r=dceProximityGroupForPile({pile:workbookPiles[0],piles:workbookPiles,kccoc:3.5});
  assert.equal(r.thresholdMm,875);
});
test("current workbook all 19 macro group counts match reverse-engineered VBA", () => {
  const rs=dceProximityGroups({piles:workbookPiles,kccoc:3.5});
  assert.equal(rs.length,19);
  for (let i=0;i<rs.length;i++) assert.equal(rs[i].groupCount,workbookPiles[i].expected);
});
test("current workbook has 4 singles and 15 rows in 3-pile groups", () => {
  const rs=dceProximityGroups({piles:workbookPiles,kccoc:3.5});
  assert.equal(rs.filter(x=>x.groupCount===1).length,4);
  assert.equal(rs.filter(x=>x.groupCount===3).length,15);
});
test("macro group label changes 3-pile rows to 2-5 band", () => {
  const rs=dceProximityGroups({piles:workbookPiles,kccoc:3.5});
  assert.equal(rs.find(x=>x.pointName==="146").label,"Đài 2 - 5 cọc");
});
test("kccoc=0 reproduces VBA default 3.1", () => {
  const piles=[{pointName:"A",xMm:0,yMm:0,diameterMm:100},{pointName:"B",xMm:300,yMm:0,diameterMm:100}];
  const r=dceProximityGroupForPile({pile:piles[0],piles,kccoc:0});
  assert.equal(r.factor,3.1);
  assert.equal(r.thresholdMm,310);
  assert.equal(r.groupCount,2);
});
test("transitive neighbors are recursively connected", () => {
  const piles=[
    {pointName:"A",xMm:0,yMm:0,diameterMm:100},
    {pointName:"B",xMm:300,yMm:0,diameterMm:100},
    {pointName:"C",xMm:600,yMm:0,diameterMm:100}
  ];
  const r=dceProximityGroupForPile({pile:piles[0],piles,kccoc:3.1});
  assert.equal(r.groupCount,3);
});
test("duplicate point names count once like VBA Collection", () => {
  const piles=[
    {pointName:"A",xMm:0,yMm:0,diameterMm:100},
    {pointName:"A",xMm:100,yMm:0,diameterMm:100},
    {pointName:"B",xMm:200,yMm:0,diameterMm:100}
  ];
  const r=dceProximityGroupForPile({pile:piles[0],piles,kccoc:3.1});
  assert.equal(r.groupCount,2);
});
test("unequal diameters expose DCE starting-pile asymmetry", () => {
  const piles=[
    {pointName:"A",xMm:0,yMm:0,diameterMm:100},
    {pointName:"B",xMm:500,yMm:0,diameterMm:200}
  ];
  const a=dceProximityGroupForPile({pile:piles[0],piles,kccoc:3.1});
  const b=dceProximityGroupForPile({pile:piles[1],piles,kccoc:3.1});
  assert.equal(a.groupCount,1);
  assert.equal(b.groupCount,2);
});
