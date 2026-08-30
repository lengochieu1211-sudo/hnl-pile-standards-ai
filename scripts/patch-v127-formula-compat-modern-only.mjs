#!/usr/bin/env node
import fs from 'node:fs';
const p='src/excel-formula-compat.js'; let s=fs.readFileSync(p,'utf8');
const old=`      scanned++;\n      const next=downgradeModernExcelFormula(v.formula);\n      maxFormulaLength=Math.max(maxFormulaLength,next.length);`;
const neu=`      scanned++;\n      if(!MODERN_EXCEL_FORMULA_RE.test(v.formula)){maxFormulaLength=Math.max(maxFormulaLength,v.formula.length);return;}\n      let next;\n      try{next=downgradeModernExcelFormula(v.formula);}\n      catch(error){throw new Error(\`Excel formula compatibility failed at \${ws.name}!\${cell.address}: \${error.message}; formula=\${v.formula.slice(0,500)}\`);}\n      maxFormulaLength=Math.max(maxFormulaLength,next.length);`;
if((s.split(old).length-1)!==1) throw new Error('formula compatibility apply marker mismatch');
s=s.replace(old,neu); fs.writeFileSync(p,s); console.log('MODERN-ONLY FORMULA PARSER PATCH: APPLIED');
