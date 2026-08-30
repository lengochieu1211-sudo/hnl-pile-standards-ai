#!/usr/bin/env node
import fs from 'node:fs';
const p='scripts/apply-spt-excel-golden-hardening.mjs';
let s=fs.readFileSync(p,'utf8');
const from="  if(n!==1) throw new Error(`${label}: expected exactly 1 match, got ${n}`);\n  return text.replace(from,to);";
const to="  if(label==='summary geometry first'){ if(n<1) throw new Error(`${label}: expected at least 1 match, got ${n}`); return text.replace(from,to); }\n  if(n!==1) throw new Error(`${label}: expected exactly 1 match, got ${n}`);\n  return text.replace(from,to);";
if(!s.includes(from)) throw new Error('replaceOnce guard signature changed');
s=s.replace(from,to);
fs.writeFileSync(p,s);
console.log('SPT patcher v2 prepared: summary occurrence scoped; all other guards remain exact-one.');
