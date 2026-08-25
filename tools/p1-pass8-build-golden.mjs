import fs from 'node:fs';
import path from 'node:path';
import { runPass8OneClickCalculation } from '../src/pass8-workflow-router.js';

const fixture=JSON.parse(fs.readFileSync('artifacts/p1-pass5-dce-table-bundle-fixture-v13.json','utf8'));
const p7=JSON.parse(fs.readFileSync('artifacts/p1-pass7-full-calculation-golden-v18.json','utf8'));
const request={
  pile:{constructionMethod:'driven',shape:'square',sideMm:400,lengthM:12,tipDepthM:12,shaftStartDepthM:0,maxSegmentM:2},
  soil:{mechanicalGammaK:1.4,sptGammaK:1.5,boreholes:p7.capacityInput.boreholes},
  material:{grade:'B30',steel:'CB400-V',AsTotMm2:1600,L0Mm:4000,e0Mm:400/30,e0IncludesRandom:true,reinforcementOppositeSides:true,loadDuration:'long'},
  design:{gammaN:1.15},
  structural:{kind:'DCE_TABLES',tables:fixture.tables,sourceId:'PASS8_GOLDEN',nodalReactionCompressionSign:'compression-positive',pierForceCompressionSign:'compression-negative'},
  combinationIds:['EULS'],sourceArtifact:'PASS8_GOLDEN_V19'
};
const out=runPass8OneClickCalculation(request);
fs.writeFileSync('artifacts/p1-pass8-one-click-request-v19.json',JSON.stringify(request,null,2));
fs.writeFileSync('artifacts/p1-pass8-one-click-golden-v19.json',JSON.stringify(out,null,2));
console.log(JSON.stringify({status:out.status,route:out.route,summary:out.result.summary,conclusion:out.result.conclusion,excel:out.excelExport.enabled},null,2));
