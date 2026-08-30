#!/usr/bin/env node
import fs from 'node:fs';
const p='scripts/apply-spt-excel-golden-hardening.mjs';
let s=fs.readFileSync(p,'utf8');
const old=`  s=replaceOnce(s,
    "  const geometry=geometryFromInput(input),A=num(input.areaM2)??num(geometry.tipAreaM2)??num(geometry.areaM2),u=num(input.perimeterM)??num(geometry.perimeterM);",
    "  let geometry; try{geometry=deriveSptSectionGeometry(input);}catch(e){return {ok:false,missing:[e.message],inputMode:'EXPLICIT_SPT_SUMMARY',provenance:PROV_SPT};}\\n  const A=num(geometry.tipAreaM2)??num(geometry.areaM2),u=num(geometry.perimeterM);",
    'summary geometry first');`;
const anchored=`  s=replaceRegexOnce(s,/export function calculateSptSummary10304\\(input=\\{\\}\\)\\{\\n  const geometry=geometryFromInput\\(input\\),A=num\\(input\\.areaM2\\)\\?\\?num\\(geometry\\.tipAreaM2\\)\\?\\?num\\(geometry\\.areaM2\\),u=num\\(input\\.perimeterM\\)\\?\\?num\\(geometry\\.perimeterM\\);/,
    "export function calculateSptSummary10304(input={}){\\n  let geometry; try{geometry=deriveSptSectionGeometry(input);}catch(e){return {ok:false,missing:[e.message],inputMode:'EXPLICIT_SPT_SUMMARY',provenance:PROV_SPT};}\\n  const A=num(geometry.tipAreaM2)??num(geometry.areaM2),u=num(geometry.perimeterM);",
    'summary geometry first');`;
if(!s.includes(old)) throw new Error('Old summary patch block not found');
s=s.replace(old,anchored);
fs.writeFileSync(p,s);
console.log('SPT patcher v3 prepared: calculateSptSummary10304 anchored explicitly.');
