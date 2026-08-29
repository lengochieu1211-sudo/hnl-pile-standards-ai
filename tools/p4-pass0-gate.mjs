import fs from 'node:fs';
import crypto from 'node:crypto';
import { createP4ExtractionPacket, buildP4ExcelPlan, packetFromP32Run } from '../src/p4-pdf-excel-intelligence.js';

const SHA='a494ee4a710de3b8e4fbfc48815e3a0039ae577f';
const evidence=process.argv[2]||'/mnt/data/HNL_P3.2_R1_FINAL_REAL_PDF_UI_GOLDEN_2026-08-28T23-17-02-243Z.json';
const checks=[];
function check(name,pass,detail=''){checks.push({name,pass:Boolean(pass),detail}); if(!pass) process.exitCode=1;}
check('frozen-source-sha',fs.existsSync(evidence) ? JSON.parse(fs.readFileSync(evidence,'utf8')).environment?.sourceSha===SHA : true,fs.existsSync(evidence)?evidence:'evidence optional');
if(fs.existsSync(evidence)){
 const j=JSON.parse(fs.readFileSync(evidence,'utf8'));
 const packets=[]; for(const arr of Object.values(j.runsByCase||{})) for(const run of arr||[]) packets.push(packetFromP32Run(run,j.environment));
 const plan=buildP4ExcelPlan(packets);
 check('p32-import-count',packets.length===11,`runs=${packets.length}`);
 check('no-p32-calculation-promotion',plan.summary.calculationEligiblePackets===0,`eligible=${plan.summary.calculationEligiblePackets}`);
 check('self-contained-source-sha',packets.every(p=>p.source.sourceSha===SHA));
}
const ocr=createP4ExtractionPacket({provenance:{file:'scan.png',page:1,bbox:[0,0,1,1],sourceType:'ocr',engine:'vietocr',state:'VERIFIED'}});
check('ocr-confirmation-barrier',ocr.trust.calculationEligible===false);
const report={schema:'HNL_P4_PASS0_GATE_V1',sourceSha:SHA,generatedAt:new Date().toISOString(),checks,pass:checks.every(x=>x.pass)};
fs.mkdirSync('artifacts/p4-pass0',{recursive:true});
fs.writeFileSync('artifacts/p4-pass0/P4_PASS0_GATE.json',JSON.stringify(report,null,2));
console.log(JSON.stringify(report,null,2));
if(process.exitCode) process.exit(process.exitCode);
