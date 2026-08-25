import fs from 'node:fs';
import path from 'node:path';
import { runPass7FullCalculationWorkflow } from '../src/pass7-full-calculation-workflow.js';

const fixture=JSON.parse(fs.readFileSync('artifacts/p1-pass5-dce-table-bundle-fixture-v13.json','utf8'));
const material=(over={})=>({grade:'B30',steel:'CB400-V',shape:'square',sideMm:400,widthMm:400,heightMm:400,AsTotMm2:1600,L0Mm:4000,e0Mm:400/30,e0IncludesRandom:true,reinforcementOppositeSides:true,loadDuration:'long',...over});
const sandBh=(id,type,N1,N2,N3)=>({id,layers:[{top:0,bottom:4,soilGroup:'sand',sandType:type,sptN:N1},{top:4,bottom:9,soilGroup:'sand',sandType:type,sptN:N2},{top:9,bottom:15,soilGroup:'sand',sandType:type,sptN:N3}],sptPoints:[{depthM:10,N:N3-5},{depthM:11,N:N3},{depthM:12,N:N3+5},{depthM:13,N:N3},{depthM:14,N:N3-5}]});
const capacityInput={mechanicalWorkflowId:'10304-driven',pileInput:{shape:'square',sideM:.4,lengthM:12,tipDepthM:12,shaftStartDepthM:0,maxSegmentM:2,gammaN:1.15},mechanicalInput:{method:'hammer',gammaK:1.4},sptInput:{gammaK:1.5,pileType:'driven'},materialInput:material(),gammaN:1.15,boreholes:[sandBh('HK1','medium',18,24,30),sandBh('HK2','fine',10,15,20),sandBh('HK3','coarse',25,35,45)]};
const source={kind:'DCE_TABLES',tables:fixture.tables,sourceId:'DCE_EXACT_PASS7_GOLDEN',nodalReactionCompressionSign:'compression-positive',pierForceCompressionSign:'compression-negative'};
const result=runPass7FullCalculationWorkflow({capacityInput,structuralSource:source,sourceArtifact:'PASS7_GOLDEN_V18'});
const out={schema:'HNL-P1-PASS7-FULL-CALCULATION-GOLDEN',version:'1.25.7',generatedAt:new Date().toISOString(),scope:'Full chain Rsoil -> Rmaterial -> Rpile -> structural import -> per-pile check -> governing -> Vietnamese conclusion',capacityInput,structuralSourceSummary:{kind:source.kind,sourceId:source.sourceId},result};
fs.writeFileSync('artifacts/p1-pass7-full-calculation-golden-v18.json',JSON.stringify(out,null,2));
console.log(JSON.stringify({summary:result.summary,conclusion:result.conclusion,criticalBoreholeId:result.capacityBatch.criticalBoreholeId,criticalMethodId:result.capacityBatch.criticalMethodId,material:result.capacityBatch.materialResult},null,2));
