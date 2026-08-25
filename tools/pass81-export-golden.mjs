import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runPass8OneClickCalculation } from '../src/pass8-workflow-router.js';
import { executePass81Export } from '../server/pass81-excel-route.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const a=(n)=>path.join(root,'artifacts',n);
const g=JSON.parse(fs.readFileSync(a('p1-pass7-full-calculation-golden-v18.json'),'utf8'));
const f=JSON.parse(fs.readFileSync(a('p1-pass5-dce-table-bundle-fixture-v13.json'),'utf8'));
const c=g.capacityInput;
const request={
  pile:{
    constructionMethod:c.mechanicalWorkflowId==='10304-bored'?'bored':'driven',shape:'square',
    sideMm:Number(c.pileInput.sideM)*1000,lengthM:c.pileInput.lengthM,tipDepthM:c.pileInput.tipDepthM,
    shaftStartDepthM:c.pileInput.shaftStartDepthM,maxSegmentM:c.pileInput.maxSegmentM
  },
  soil:{
    mechanicalGammaK:c.mechanicalInput.gammaK,sptGammaK:c.sptInput.gammaK,boreholes:c.boreholes,
    mechanicalInput:c.mechanicalInput,sptInput:c.sptInput
  },
  material:{...c.materialInput}, design:{gammaN:c.gammaN},
  structural:{kind:'DCE_TABLES',tables:f.tables,sourceId:'PASS81_GOLDEN_DCE',nodalReactionCompressionSign:'compression-positive',pierForceCompressionSign:'compression-negative'},
  combinationIds:['EULS'],sourceArtifact:'P1_PASS81_GOLDEN_RUNTIME'
};
const out=runPass8OneClickCalculation(request);
const body={schema:'HNL-P1-PASS8.1-EXCEL-EXPORT-REQUEST',version:'1.25.7',request,clientSummary:{
  RsoilKn:out.result.summary.RsoilKn,RmaterialKn:out.result.summary.RmaterialKn,RpileKn:out.result.summary.RpileKn,
  gammaN:out.result.summary.gammaN,NdMaxPerPileKn:out.result.summary.NdMaxPerPileKn,boreholeBranches:out.result.summary.boreholeBranches,
  pileChecks:out.result.summary.pileChecks,governingPileId:out.result.summary.governingPileId,governingCombinationId:out.result.summary.governingCombinationId,
  governingUtilization:out.result.summary.governingUtilization,conclusion:out.result.conclusion.statusVi
},templateVersion:'v18',exporterVersion:'Pass8.1-v20'};
const exported=executePass81Export(body);
const outPath=a('HNL_P1_Pass8_1_Dynamic_Excel_Golden_v20.xlsx');
fs.writeFileSync(outPath,exported.buffer);
fs.writeFileSync(a('p1-pass81-export-request-golden-v20.json'),JSON.stringify(body,null,2));
fs.writeFileSync(a('p1-pass81-export-result-golden-v20.json'),JSON.stringify({
  schema:'HNL-P1-PASS8.1-DYNAMIC-EXCEL-GOLDEN',version:'1.25.7',status:'PASS',
  fileName:exported.fileName,exportId:exported.exportId,templateSha256:exported.templateSha256,outputSha256:exported.buffer.toString('base64').length?await import('node:crypto').then(({default:crypto})=>crypto.createHash('sha256').update(exported.buffer).digest('hex')):null,
  summary:out.result.summary,conclusion:out.result.conclusion,compare:exported.compare
},null,2));
console.log(JSON.stringify({outPath,fileName:exported.fileName,bytes:exported.buffer.length,exportId:exported.exportId,summary:out.result.summary,conclusion:out.result.conclusion.statusVi},null,2));
