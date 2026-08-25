import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { lookup5574Concrete, lookup5574Steel, lookup5574Table16LongTermPhi } from '../src/codepack-tables.js';
import { calculateNearCenteredRectPileCapacity5574, shortTermPhi5574, calculateXlsmSctVatLieuReference, calculateCircularPileMaterialCheck5574, combineSoilAndMaterialResistance } from '../src/pile-material-engine.js';
import { evaluatePileMaterialExcelModel, evaluateGoverningExcelModel } from '../src/p1-material-excel-model.js';
import { solveEngineeringQuestion, engineeringExcelPayload } from '../src/engineering-router.js';
import { productionStatusFor } from '../src/production-status-registry.js';
import { CODEPACK_5574 } from '../src/codepacks.js';

test('P1 Pass 1 material tables use PDF-correct B30 and CB400-V values',()=>{
  const c=lookup5574Concrete('B30'),s=lookup5574Steel('CB400-V');
  assert.equal(c.Rb,17); assert.equal(c.Rbt,1.15); assert.equal(c.Eb,32500);
  assert.equal(s.Rs,350); assert.equal(s.Rsc,350); assert.equal(s.Rsw,280);
  assert.notEqual(s.Rsc,365);
});

test('P1 Pass 1 Table 16 exact/intermediate/boundary policy is strict',()=>{
  assert.deepEqual(lookup5574Table16LongTermPhi('B30',10).value,0.90);
  const x=lookup5574Table16LongTermPhi('B30',12.5); assert.equal(x.mode,'LINEAR_1D'); assert.ok(Math.abs(x.value-0.865)<1e-12);
  assert.equal(lookup5574Table16LongTermPhi('B30',6).value,0.92);
  assert.equal(lookup5574Table16LongTermPhi('B30',20).value,0.70);
  assert.equal(lookup5574Table16LongTermPhi('B60',15).value,0.80);
  assert.equal(lookup5574Table16LongTermPhi('B100',20).value,0.63);
  assert.equal(lookup5574Table16LongTermPhi('B30',5.999).ok,false);
  assert.equal(lookup5574Table16LongTermPhi('B30',20.001).ok,false);
  assert.equal(lookup5574Table16LongTermPhi('B15',10).ok,false);
});

test('P1 Pass 1 short-term phi interpolates only between explicit 10 and 20 anchors',()=>{
  assert.ok(Math.abs(shortTermPhi5574(10).value-0.90)<1e-12);
  assert.ok(Math.abs(shortTermPhi5574(15).value-0.875)<1e-12);
  assert.ok(Math.abs(shortTermPhi5574(20).value-0.85)<1e-12);
  assert.equal(shortTermPhi5574(9.999).ok,false);
  assert.equal(shortTermPhi5574(20.001).ok,false);
});

test('P1 Pass 1 CT50 square benchmark: B30 CB400-V 400x400 As=1600 L0/h=10',()=>{
  const r=calculateNearCenteredRectPileCapacity5574({grade:'B30',steel:'CB400-V',shape:'square',sideMm:400,AsTotMm2:1600,L0Mm:4000,e0Mm:400/30,e0IncludesRandom:true,reinforcementOppositeSides:true,loadDuration:'long'});
  assert.equal(r.ok,true); assert.equal(r.status,'VERIFIED'); assert.equal(r.phi,0.9); assert.equal(r.materials.RscMpa,350);
  assert.ok(Math.abs(r.NuKn-2952)<1e-12);
  assert.equal(r.capacityBasis,'DESIGN_RESISTANCE_TTGH1');
});

test('P1 Pass 1 CT50 blocks e0 and slenderness outside applicability',()=>{
  const base={grade:'B30',steel:'CB400-V',shape:'square',sideMm:400,AsTotMm2:1600,e0IncludesRandom:true,reinforcementOppositeSides:true,loadDuration:'long'};
  const e=calculateNearCenteredRectPileCapacity5574({...base,L0Mm:4000,e0Mm:14});
  assert.equal(e.ok,false); assert.equal(e.status,'OUT_OF_SCOPE');
  const l=calculateNearCenteredRectPileCapacity5574({...base,L0Mm:8001,e0Mm:400/30});
  assert.equal(l.ok,false); assert.equal(l.status,'OUT_OF_SCOPE');
  const lowLong=calculateNearCenteredRectPileCapacity5574({...base,L0Mm:2000,e0Mm:400/30});
  assert.equal(lowLong.ok,false); assert.match(lowLong.missing.join(' '),/không ngoại suy/i);
});

test('P1 Pass 1 CT50 refuses e0 without random-eccentricity proof or opposite-side rebar proof',()=>{
  const base={grade:'B30',steel:'CB400-V',shape:'square',sideMm:400,AsTotMm2:1600,L0Mm:4000,e0Mm:400/30,loadDuration:'long'};
  const a=calculateNearCenteredRectPileCapacity5574({...base,reinforcementOppositeSides:true});
  assert.equal(a.ok,false); assert.match(a.missing.join(' '),/lệch tâm ngẫu nhiên|ea/i);
  const b=calculateNearCenteredRectPileCapacity5574({...base,e0IncludesRandom:true});
  assert.equal(b.ok,false); assert.match(b.missing.join(' '),/phía đối diện/i);
  const c=calculateNearCenteredRectPileCapacity5574({...base,e0IncludesRandom:true,reinforcementOppositeSides:true,e0Mm:0});
  assert.equal(c.ok,false); assert.match(c.missing.join(' '),/ea=max|giới hạn tối thiểu/i);
});

test('P1 Pass 1 Engine and independent Excel model are Golden-equal',()=>{
  const cases=[
    {grade:'B30',steel:'CB400-V',shape:'square',sideMm:400,AsTotMm2:1600,L0Mm:2400,e0Mm:400/30,e0IncludesRandom:true,reinforcementOppositeSides:true,loadDuration:'long'},
    {grade:'B30',steel:'CB400-V',shape:'square',sideMm:400,AsTotMm2:1600,L0Mm:4000,e0Mm:400/30,e0IncludesRandom:true,reinforcementOppositeSides:true,loadDuration:'long'},
    {grade:'B30',steel:'CB400-V',shape:'rectangle',widthMm:450,heightMm:500,AsTotMm2:2400,L0Mm:6250,e0Mm:500/30,e0IncludesRandom:true,reinforcementOppositeSides:true,loadDuration:'long'},
    {grade:'B60',steel:'CB400-V',shape:'square',sideMm:500,AsTotMm2:2500,L0Mm:7500,e0Mm:500/30,e0IncludesRandom:true,reinforcementOppositeSides:true,loadDuration:'long'},
    {grade:'B100',steel:'CB500-V',shape:'square',sideMm:600,AsTotMm2:4000,L0Mm:12000,e0Mm:600/30,e0IncludesRandom:true,reinforcementOppositeSides:true,loadDuration:'long'},
    {grade:'B30',steel:'CB400-V',shape:'square',sideMm:400,AsTotMm2:1600,L0Mm:6000,e0Mm:400/30,e0IncludesRandom:true,reinforcementOppositeSides:true,loadDuration:'short'}
  ];
  for(const c of cases){
    const a=calculateNearCenteredRectPileCapacity5574(c),b=evaluatePileMaterialExcelModel(c);
    assert.equal(a.ok,true,JSON.stringify(c)); assert.equal(b.ok,true,JSON.stringify(c));
    assert.ok(Math.abs(a.NuKn-b.NuKn)<1e-10,`${a.NuKn} != ${b.NuKn}`);
    assert.ok(Math.abs(a.phi-b.phi)<1e-12);
  }
});

test('P1 Pass 1 governing uses min of verified soil Rd and material Nu on compatible basis',()=>{
  const m=calculateNearCenteredRectPileCapacity5574({grade:'B30',steel:'CB400-V',shape:'square',sideMm:400,AsTotMm2:1600,L0Mm:4000,e0Mm:400/30,e0IncludesRandom:true,reinforcementOppositeSides:true,loadDuration:'long'});
  const s1=combineSoilAndMaterialResistance({soilResult:{RdKn:2800},materialResult:m});
  assert.equal(s1.ok,true); assert.equal(s1.governing,'SOIL'); assert.equal(s1.pileResistanceKn,2800);
  const s2=combineSoilAndMaterialResistance({soilResult:{RdKn:3500},materialResult:m});
  assert.equal(s2.ok,true); assert.equal(s2.governing,'MATERIAL'); assert.equal(s2.pileResistanceKn,2952);
  assert.deepEqual(evaluateGoverningExcelModel({soilRdKn:3500,materialNuKn:2952}),{ok:true,pileResistanceKn:2952,governing:'MATERIAL'});
});

test('P1 Pass 1 refuses governing when material branch is only N-M demand check',()=>{
  const c=calculateCircularPileMaterialCheck5574({grade:'B30',steel:'CB400-V',r:300,rs:250,AsTot:3000,N:2000,M:300,bars:8});
  assert.equal(c.ok,true); assert.equal(c.capacityBasis,'DEMAND_CHECK_ONLY'); assert.equal(c.materialResistanceKn,null);
  const g=combineSoilAndMaterialResistance({soilResult:{RdKn:2800},materialResult:c});
  assert.equal(g.ok,false); assert.equal(g.pileResistanceKn,null);
});

test('P1 Pass 1 reconstructs SCT VatLieu only as bugged reference benchmark',()=>{
  const r=calculateXlsmSctVatLieuReference();
  assert.equal(r.ok,true); assert.equal(r.status,'REFERENCE/BUGGED'); assert.equal(r.productionNumeric,false);
  assert.equal(r.workbookAsCalculatedRscMpa,350); assert.equal(r.workbookOwnTableRscMpa,365); assert.equal(r.pdfCorrectRscMpa,350);
  assert.ok(Math.abs(r.workbookAsCalculatedKn-12012.497578072185)<1e-9);
  assert.ok(Math.abs(r.workbookIfLookupFixedToOwnTableKn-12197.78764512835)<1e-9);
});

test('P1 Pass 1 router recognizes pile material workflow and returns governing result',()=>{
  const q='Tính sức chịu tải vật liệu cọc vuông 400x400 mm, B30, CB400-V, As,tot = 1600 mm2, L0 = 4 m, e0 = 13,333333 mm đã kể lệch tâm ngẫu nhiên ea, cốt dọc bố trí ở hai phía đối diện, tải dài hạn, Rsoil = 2800 kN';
  const p=engineeringExcelPayload(q);
  assert.equal(p.workflow?.id,'5574-pile-material'); assert.equal(p.result?.ok,true); assert.equal(p.result?.NuKn,2952); assert.equal(p.result?.governing?.governing,'SOIL');
  assert.equal(p.input?.soilRdKn,2800); assert.equal(p.canExport,true);
  assert.equal(p.production?.status,'LOCKED');
});

test('P1 Pass 1 router safety-gates missing duration and circular scalar-capacity requests',()=>{
  const a=solveEngineeringQuestion('SCT VatLieu cọc vuông 400x400 mm B30 CB400-V As,tot=1600 mm2 L0=4m e0=13,333333mm');
  assert.equal(a.workflow?.id,'5574-pile-material'); assert.equal(a.result?.ok,false); assert.match(a.result?.missing?.join(' ')||'',/dài hạn|ngắn hạn/i); assert.equal(a.canExport,false);
  const b=solveEngineeringQuestion('Sức chịu tải vật liệu cọc tròn D=600 mm B30 CB400-V As,tot=3000 mm2 L0=6m e0=20mm đã kể lệch tâm ngẫu nhiên ea cốt dọc bố trí ở hai phía đối diện tải dài hạn');
  assert.equal(b.workflow?.id,'5574-pile-material'); assert.equal(b.result?.ok,false); assert.match(b.result?.missing?.join(' ')||'',/Phụ lục F/i); assert.equal(b.canExport,false);
});

test('P1 Pass 1 production registry locks CT50 and keeps XLSM as reference',()=>{
  assert.deepEqual(productionStatusFor('5574-pile-material-near-centered-rect').status,'LOCKED');
  assert.equal(productionStatusFor('5574-pile-material-near-centered-rect').productionNumeric,true);
  assert.equal(productionStatusFor('xlsm-sct-vatlieu').status,'REFERENCE');
  assert.equal(productionStatusFor('xlsm-sct-vatlieu').productionNumeric,false);
});


test('P1 Pass 1 Code Pack exposes CT49-50 and Table 16 only through dedicated workflow',()=>{
  for(const label of ['(49)','(50)']){
    const f=CODEPACK_5574.formulas.find(x=>x.label===label);
    assert.equal(f?.status,'Verified'); assert.equal(f?.workflowComputable,true); assert.equal(f?.machineWorkflow,'5574-pile-material'); assert.equal(f?.computable,false);
  }
  const t=CODEPACK_5574.tables.find(x=>String(x.number)==='16');
  assert.equal(t?.status,'Verified'); assert.match(t?.keywords||'',/nén gần đúng tâm/i);
});

test('P1 Pass 1 Excel exporter is Formula-Only and isolates XLSM audit',()=>{
  const src=fs.readFileSync(new URL('../src/excel-export.js',import.meta.url),'utf8');
  assert.match(src,/exportPileMaterialWorkflowWorkbook/);
  assert.match(src,/Nu = Rmaterial/); assert.match(src,/MIN\(B4,B5\)/); assert.match(src,/e0 includes random ea\?/); assert.match(src,/Rebar opposite sides\?/); assert.match(src,/07_XLSM_AUDIT/);
  assert.match(src,/VLOOKUP\(C23,BANGTRA!G12:H25,2,0\)/);
  assert.match(src,/INDEX\('02_MATERIAL'!I:I,MATCH\('01_INPUT'!B6/);
  assert.match(src,/Bảng 16/);
});
