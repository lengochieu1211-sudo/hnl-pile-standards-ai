#!/usr/bin/env node
import fs from 'node:fs';
import { export10304AdvancedWorkflowWorkbook } from '../src/excel-export-compat.js';
const input={inputMode:'EXPLICIT_SPT_SUMMARY',pileType:'driven',sectionType:'square',widthM:.4,heightM:.4,sideM:.4,lengthM:10,shaftStartDepthM:0,shaftLengthM:10,soilGroup:'sand',nBarTip:20,nsShaft:20,eta:1,closedTip:true,gammaK:1.5,gammaN:1.15};
const out=await export10304AdvancedWorkflowWorkbook('spt',input,{returnBuffer:true});
if(!out?.buffer) throw new Error('SPT workbook buffer missing');
fs.mkdirSync('artifacts/spt-excel-golden',{recursive:true});
fs.writeFileSync('artifacts/spt-excel-golden/HNL_SPT_GOLDEN.xlsx',Buffer.from(out.buffer));
console.log('generated artifacts/spt-excel-golden/HNL_SPT_GOLDEN.xlsx');
