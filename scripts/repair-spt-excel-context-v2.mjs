#!/usr/bin/env node
import fs from 'node:fs';
const p='src/excel-export-compat.js';
let s=fs.readFileSync(p,'utf8');
function once(from,to,label){const n=s.split(from).length-1;if(n!==1)throw new Error(`${label}: expected 1 got ${n}`);s=s.replace(from,to);}
once(
"  const sourceInput=(context.fnName==='export10304AdvancedWorkflowWorkbook'?context.args?.[1]:context.args?.[0]?.input)||{};",
"  const sourceInput=context.sourceInput||(context.fnName==='export10304AdvancedWorkflowWorkbook'?context.args?.[1]:context.args?.[0]?.input)||{};",
'context sourceInput');
once(
"  const areaFormula=`IF('01_INPUT'!E${sectionRow}=\"circle\",PI()*('01_INPUT'!B${dRow}/1000)^2/4,IF('01_INPUT'!E${sectionRow}=\"rectangle\",('01_INPUT'!B${bRow}/1000)*('01_INPUT'!B${hRow}/1000),('01_INPUT'!B${bRow}/1000)^2))`;\n  const perimeterFormula=`IF('01_INPUT'!E${sectionRow}=\"circle\",PI()*('01_INPUT'!B${dRow}/1000),IF('01_INPUT'!E${sectionRow}=\"rectangle\",2*(('01_INPUT'!B${bRow}/1000)+('01_INPUT'!B${hRow}/1000)),4*('01_INPUT'!B${bRow}/1000)))`;",
"  const areaFormula=`IF('01_INPUT'!B${sectionRow}=\"${SHAPE.circle}\",PI()*('01_INPUT'!B${dRow}/1000)^2/4,IF('01_INPUT'!B${sectionRow}=\"${SHAPE.rectangle}\",('01_INPUT'!B${bRow}/1000)*('01_INPUT'!B${hRow}/1000),('01_INPUT'!B${bRow}/1000)^2))`;\n  const perimeterFormula=`IF('01_INPUT'!B${sectionRow}=\"${SHAPE.circle}\",PI()*('01_INPUT'!B${dRow}/1000),IF('01_INPUT'!B${sectionRow}=\"${SHAPE.rectangle}\",2*(('01_INPUT'!B${bRow}/1000)+('01_INPUT'!B${hRow}/1000)),4*('01_INPUT'!B${bRow}/1000)))`;",
'visible geometry formulas');
once(
"async function runProcessed(fn,args,{returnBuffer=false}={}){",
"async function runProcessed(fn,args,{returnBuffer=false,context={}}={}){",
'runProcessed signature');
once(
"  const processed=await postProcessHnlWorkbook(captured.buffer,captured.fileName,{fnName:fn?.name||'',args});",
"  const processed=await postProcessHnlWorkbook(captured.buffer,captured.fileName,{...context,fnName:fn?.name||'',args});",
'runProcessed context');
once(
"  return runProcessed(core.exportDrivenPileWorkflowWorkbook,[input,{...options,returnBuffer:true}],{returnBuffer:Boolean(options?.returnBuffer)});",
"  return runProcessed(core.exportDrivenPileWorkflowWorkbook,[input,{...options,returnBuffer:true}],{returnBuffer:Boolean(options?.returnBuffer),context:{kind:'driven',sourceInput:input}});",
'driven wrapper context');
once(
"  return runProcessed(core.export10304AdvancedWorkflowWorkbook,[workflowId,input,{...options,returnBuffer:true}],{returnBuffer:Boolean(options?.returnBuffer)});",
"  return runProcessed(core.export10304AdvancedWorkflowWorkbook,[workflowId,input,{...options,returnBuffer:true}],{returnBuffer:Boolean(options?.returnBuffer),context:{kind:'10304-advanced',workflowId,sourceInput:input}});",
'advanced wrapper context');
fs.writeFileSync(p,s);
console.log('SPT Excel context v2: explicit sourceInput + visible geometry formulas APPLIED');
