// Excel formula compatibility transformer used only by the Production XLSX post-processor.
// Goal: emitted workbooks must not require LET/XLOOKUP/LAMBDA/SWITCH/IFS.
// Calculation Engine source is not touched; this module rewrites workbook formulas after export.

export const MODERN_EXCEL_FORMULA_RE=/\b(?:LET|XLOOKUP|LAMBDA|SWITCH|IFS)\s*\(/i;

function splitArgs(src=''){
  const out=[]; let start=0,paren=0,brace=0,bracket=0,quote=null;
  for(let i=0;i<src.length;i++){
    const ch=src[i];
    if(quote){
      if(ch===quote){
        if(src[i+1]===quote){i++;continue;}
        quote=null;
      }
      continue;
    }
    if(ch==='"'||ch==="'"){quote=ch;continue;}
    if(ch==='(') paren++;
    else if(ch===')') paren--;
    else if(ch==='{') brace++;
    else if(ch==='}') brace--;
    else if(ch==='[') bracket++;
    else if(ch===']') bracket--;
    else if(ch===','&&paren===0&&brace===0&&bracket===0){out.push(src.slice(start,i).trim());start=i+1;}
  }
  out.push(src.slice(start).trim()); return out;
}
function matchingParen(src,open){
  let depth=0,quote=null;
  for(let i=open;i<src.length;i++){
    const ch=src[i];
    if(quote){if(ch===quote){if(src[i+1]===quote){i++;continue;}quote=null;}continue;}
    if(ch==='"'||ch==="'"){quote=ch;continue;}
    if(ch==='(') depth++; else if(ch===')'){depth--;if(depth===0)return i;}
  }
  return -1;
}
function replaceIdentifiers(src,vars){
  if(!vars||!Object.keys(vars).length) return src;
  let out='',quote=null;
  for(let i=0;i<src.length;){
    const ch=src[i];
    if(quote){out+=ch;if(ch===quote){if(src[i+1]===quote){out+=src[i+1];i+=2;continue;}quote=null;}i++;continue;}
    if(ch==='"'||ch==="'"){quote=ch;out+=ch;i++;continue;}
    if(/[A-Za-z_]/.test(ch)){
      let j=i+1;while(j<src.length&&/[A-Za-z0-9_.]/.test(src[j]))j++;
      const token=src.slice(i,j);
      if(Object.prototype.hasOwnProperty.call(vars,token)) out+=`(${vars[token]})`; else out+=token;
      i=j;continue;
    }
    out+=ch;i++;
  }
  return out;
}
function parseWholeCall(src,name){
  const t=src.trim(),m=t.match(/^([A-Za-z_][A-Za-z0-9_.]*)\s*\(/);
  if(!m||m[1].toUpperCase()!==name.toUpperCase()) return null;
  const open=t.indexOf('(',m[0].length-1),close=matchingParen(t,open);
  if(close!==t.length-1) return null;
  return splitArgs(t.slice(open+1,close));
}
function cloneEnv(env){return {vars:{...(env?.vars||{})},lambdas:{...(env?.lambdas||{})}};}
function expandLambda(def,args,env){
  if(args.length!==def.params.length) throw new Error(`LAMBDA ${def.name||''}: expected ${def.params.length} args, got ${args.length}`);
  const local=cloneEnv(env);
  def.params.forEach((p,i)=>{local.vars[p]=rewriteExpression(args[i],env);});
  return rewriteExpression(def.body,local);
}
function rewriteXlookup(args,env){
  if(args.length<3||args.length>6) throw new Error(`XLOOKUP unsupported arg count=${args.length}`);
  const a=args.map(x=>rewriteExpression(x,env));
  const matchMode=(a[4]||'0').trim(),searchMode=(a[5]||'1').trim();
  if(!['','0','2'].includes(matchMode)) throw new Error(`XLOOKUP match_mode ${matchMode} not certified`);
  if(!['','1'].includes(searchMode)) throw new Error(`XLOOKUP search_mode ${searchMode} not certified`);
  const fallback=a[3]||'NA()';
  return `IFERROR(INDEX(${a[2]},MATCH(${a[0]},${a[1]},0)),${fallback})`;
}
function rewriteSwitch(args,env){
  if(args.length<3) throw new Error('SWITCH requires expression and cases');
  const a=args.map(x=>rewriteExpression(x,env)); const expr=a[0],rest=a.slice(1);
  const hasDefault=rest.length%2===1; let result=hasDefault?rest[rest.length-1]:'NA()';
  const end=hasDefault?rest.length-1:rest.length;
  for(let i=end-2;i>=0;i-=2) result=`IF(${expr}=${rest[i]},${rest[i+1]},${result})`;
  return result;
}
function rewriteIfs(args,env){
  if(args.length<2||args.length%2!==0) throw new Error(`IFS unsupported arg count=${args.length}`);
  const a=args.map(x=>rewriteExpression(x,env)); let result='NA()';
  for(let i=a.length-2;i>=0;i-=2){
    if(i===a.length-2&&/^TRUE$/i.test(a[i].trim())) result=a[i+1];
    else result=`IF(${a[i]},${a[i+1]},${result})`;
  }
  return result;
}
function rewriteLet(args,env){
  if(args.length<3||args.length%2!==1) throw new Error(`LET unsupported arg count=${args.length}`);
  const local=cloneEnv(env);
  for(let i=0;i<args.length-1;i+=2){
    const name=args[i].trim();
    if(!/^[A-Za-z_][A-Za-z0-9_.]*$/.test(name)) throw new Error(`LET invalid name ${name}`);
    const lambdaArgs=parseWholeCall(args[i+1],'LAMBDA');
    if(lambdaArgs){
      if(lambdaArgs.length<2) throw new Error(`LAMBDA ${name} missing body`);
      const params=lambdaArgs.slice(0,-1).map(x=>x.trim());
      if(params.some(p=>!/^[A-Za-z_][A-Za-z0-9_.]*$/.test(p))) throw new Error(`LAMBDA ${name} invalid params`);
      local.lambdas[name]={name,params,body:lambdaArgs[lambdaArgs.length-1]};
    }else local.vars[name]=rewriteExpression(args[i+1],local);
  }
  return rewriteExpression(args[args.length-1],local);
}
function rewriteKnownCall(name,args,env){
  const upper=name.toUpperCase();
  if(env?.lambdas?.[name]) return expandLambda(env.lambdas[name],args,env);
  if(upper==='XLOOKUP') return rewriteXlookup(args,env);
  if(upper==='SWITCH') return rewriteSwitch(args,env);
  if(upper==='IFS') return rewriteIfs(args,env);
  if(upper==='LET') return rewriteLet(args,env);
  if(upper==='LAMBDA') throw new Error('Standalone LAMBDA is not supported; only LET-bound LAMBDA is certified');
  return null;
}
export function rewriteExpression(src='',env={vars:{},lambdas:{}}){
  let out='';
  for(let i=0;i<src.length;){
    const ch=src[i];
    if(ch==='"'||ch==="'"){
      const q=ch;let j=i+1;
      for(;j<src.length;j++){if(src[j]===q){if(src[j+1]===q){j++;continue;}j++;break;}}
      out+=src.slice(i,j);i=j;continue;
    }
    if(/[A-Za-z_]/.test(ch)){
      let j=i+1;while(j<src.length&&/[A-Za-z0-9_.]/.test(src[j]))j++;
      const name=src.slice(i,j);let k=j;while(k<src.length&&/\s/.test(src[k]))k++;
      if(src[k]==='('){
        const close=matchingParen(src,k); if(close<0) throw new Error(`Unbalanced formula near ${name}`);
        const args=splitArgs(src.slice(k+1,close));
        const replacement=rewriteKnownCall(name,args,env);
        if(replacement!==null) out+=`(${replacement})`;
        else out+=name+src.slice(j,k)+'('+args.map(a=>rewriteExpression(a,env)).join(',')+')';
        i=close+1;continue;
      }
      if(Object.prototype.hasOwnProperty.call(env?.vars||{},name)) out+=`(${env.vars[name]})`; else out+=name;
      i=j;continue;
    }
    out+=ch;i++;
  }
  return replaceIdentifiers(out,env?.vars||{});
}
export function downgradeModernExcelFormula(formula=''){
  const out=rewriteExpression(String(formula||''),{vars:{},lambdas:{}});
  if(MODERN_EXCEL_FORMULA_RE.test(out)) throw new Error(`Modern Excel function remains after rewrite: ${out.slice(0,240)}`);
  if(out.length>8192) throw new Error(`Legacy Excel formula exceeds 8192 characters (${out.length})`);
  return out;
}
export function applyLegacyExcelFormulaCompatibility(wb){
  let scanned=0,changed=0,maxFormulaLength=0; const remaining=[];
  for(const ws of wb.worksheets){
    ws.eachRow({includeEmpty:false},row=>row.eachCell({includeEmpty:false},cell=>{
      const v=cell.value;
      if(!v||typeof v!=='object'||typeof v.formula!=='string') return;
      scanned++;
      if(!MODERN_EXCEL_FORMULA_RE.test(v.formula)){maxFormulaLength=Math.max(maxFormulaLength,v.formula.length);return;}
      let next;
      try{next=downgradeModernExcelFormula(v.formula);}
      catch(error){throw new Error(`Excel formula compatibility failed at ${ws.name}!${cell.address}: ${error.message}; formula=${v.formula.slice(0,500)}`);}
      maxFormulaLength=Math.max(maxFormulaLength,next.length);
      if(next!==v.formula){cell.value={...v,formula:next};changed++;}
      if(MODERN_EXCEL_FORMULA_RE.test(next)) remaining.push(`${ws.name}!${cell.address}`);
    }));
  }
  if(remaining.length) throw new Error(`Modern Excel formulas remain: ${remaining.join(', ')}`);
  return {scanned,changed,maxFormulaLength,remaining:0};
}
