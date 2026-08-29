export const P4_SCHEMA = 'HNL_P4_PDF_EXCEL_INTELLIGENCE_V1';

export function fold(value='') {
  return String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/đ/g,'d').replace(/Đ/g,'D').toLowerCase().replace(/\s+/g,' ').trim();
}

export function parseVariableQuery(question='') {
  const raw=String(question||'').trim();
  const vars=[];
  const add=v=>{v=String(v||'').trim(); if(v && /^[A-Za-zΑ-ωÀ-ỹĐđ][A-Za-z0-9_Α-ωÀ-ỹĐđ′'’]{0,15}$/.test(v) && !vars.includes(v)) vars.push(v);};
  const quoted=[...raw.matchAll(/["“”']([A-Za-zΑ-ωÀ-ỹĐđ][A-Za-z0-9_Α-ωÀ-ỹĐđ′'’]{0,15})["“”']/g)];
  quoted.forEach(m=>add(m[1]));
  const m=raw.match(/(?:giá\s*trị|tham\s*số|hệ\s*số|biến|tìm|lấy)\s+([A-Za-zΑ-ωÀ-ỹĐđ0-9_′'’,;\s]+?)(?:\s+(?:trong|ở|theo|từ|để|và\s*xuất)|$)/i);
  if(m) m[1].split(/[\s,;]+/).filter(Boolean).filter(v=>!['gia','giá','tri','trị','tham','số','so','he','hệ'].includes(fold(v))).forEach(add);
  if(!vars.length) {
    const short=[...raw.matchAll(/\b([A-Za-z][A-Za-z0-9_′'’]{0,3})\b/g)].map(x=>x[1]);
    short.filter(v=>!['pdf','tcvn','excel','theo','trong','bang','hinh'].includes(fold(v))).forEach(add);
  }
  return vars.slice(0,12);
}

function escapeRe(s=''){return String(s).replace(/[.*+?^${}()|[\]\\]/g,'\\$&');}

export function extractAssignments(text='', variable='') {
  const src=String(text||'');
  if(!src || !variable) return [];
  const v=escapeRe(variable);
  const patterns=[
    new RegExp(`(?:^|[\\s(;,])${v}\\s*(?:=|:|≈|≃|~)\\s*([-+]?\\d+(?:[.,]\\d+)?(?:\\s*[×x*]\\s*10\\s*[\\^]?\\s*[-+]?\\d+)?)\\s*([%A-Za-zµμΩ°²³/.-]{0,14})`,'giu'),
    new RegExp(`(?:hệ\\s*số|tham\\s*số|giá\\s*trị)\\s+${v}[^\\d+\\-]{0,40}([-+]?\\d+(?:[.,]\\d+)?)\\s*([%A-Za-zµμΩ°²³/.-]{0,14})`,'giu')
  ];
  const out=[];
  for(const re of patterns){
    for(const m of src.matchAll(re)){
      const idx=m.index||0; const from=Math.max(0,idx-120), to=Math.min(src.length,idx+m[0].length+180);
      out.push({variable,valueRaw:m[1],unit:String(m[2]||'').trim(),context:src.slice(from,to).replace(/\s+/g,' ').trim(),index:idx});
    }
  }
  const seen=new Set();
  return out.filter(x=>{const k=`${x.valueRaw}|${x.unit}|${x.context}`; if(seen.has(k))return false;seen.add(k);return true;});
}

export function numericValue(raw='') {
  const s=String(raw||'').replace(/\s+/g,'').replace(',','.');
  const sci=s.match(/^([-+]?\d+(?:\.\d+)?)[×x*]10\^?([-+]?\d+)$/i);
  if(sci) return Number(sci[1])*Math.pow(10,Number(sci[2]));
  const n=Number(s); return Number.isFinite(n)?n:null;
}

export function collectCandidates({docs=[],question='',shadowReports=[],sourceSha=''}={}){
  const variables=parseVariableQuery(question);
  const candidates=[];
  for(const doc of docs||[]){
    for(const p of doc.pages||[]){
      const text=String(p.text||''); if(!text) continue;
      for(const variable of variables){
        for(const hit of extractAssignments(text,variable)) candidates.push({
          id:crypto.randomUUID?.()||`${Date.now()}-${Math.random()}`, variable, value:numericValue(hit.valueRaw), valueRaw:hit.valueRaw, unit:hit.unit,
          docId:doc.id, document:doc.standard||doc.name||'', fileName:doc.name||'', fingerprint:doc.fingerprint||null,
          page:Number(p.page)||0, bbox:null, engine:'PDF.js Native', status:'CANDIDATE', confidence:null, context:hit.context, source:'native-text'
        });
      }
    }
  }
  for(const report of shadowReports||[]){
    const text=String(report?.result?.text||''); if(!text) continue;
    for(const variable of variables){
      for(const hit of extractAssignments(text,variable)) candidates.push({
        id:crypto.randomUUID?.()||`${Date.now()}-${Math.random()}`, variable, value:numericValue(hit.valueRaw), valueRaw:hit.valueRaw, unit:hit.unit,
        docId:null, document:'Vùng PDF đã chọn', fileName:'', fingerprint:report?.provenance?.fingerprint||null,
        page:Number(report?.page||report?.provenance?.page)||0, bbox:report?.provenance?.normalizedBbox||null,
        engine:report?.result?.engine||report?.selectedRoute||'OCR/Vision', status:'REVIEW', confidence:report?.result?.quality?.confidence??null,
        context:hit.context, source:'shadow-region', promotionState:report?.promotionState||'SHADOW_ONLY', productionMutationAllowed:false
      });
    }
  }
  return {schema:P4_SCHEMA,question,variables,candidates,sourceSha:String(sourceSha||''),generatedAt:new Date().toISOString()};
}

export function chooseBestCandidates(result={}){
  const chosen=[];
  for(const variable of result.variables||[]){
    const rows=(result.candidates||[]).filter(x=>x.variable===variable);
    rows.sort((a,b)=>{
      const sa=a.source==='native-text'?3:2, sb=b.source==='native-text'?3:2;
      const va=a.value!=null?1:0, vb=b.value!=null?1:0;
      return (sb+vb)-(sa+va) || (a.page||9999)-(b.page||9999);
    });
    if(rows[0]) chosen.push({...rows[0],selected:true});
  }
  return chosen;
}


export function analyzeCandidateAmbiguity(result={}){
  const issues=[];
  for(const variable of result.variables||[]){
    const rows=(result.candidates||[]).filter(x=>x.variable===variable);
    const distinct=new Map();
    for(const row of rows){
      const key=`${row.value??row.valueRaw??''}|${row.unit||''}`;
      if(!distinct.has(key)) distinct.set(key,[]);
      distinct.get(key).push(row);
    }
    if(distinct.size>1){
      issues.push({
        variable,
        type:'MULTIPLE_VALUES',
        message:`Tham số ${variable} có ${distinct.size} giá trị/ngữ cảnh khác nhau; bắt buộc REVIEW trước khi dùng thiết kế.`,
        values:[...distinct.entries()].map(([key,items])=>({key,count:items.length,pages:[...new Set(items.map(x=>x.page).filter(Boolean))]}))
      });
    } else if(rows.length===0){
      issues.push({variable,type:'NOT_FOUND',message:`Chưa tìm thấy giá trị cho ${variable}.`,values:[]});
    }
  }
  return issues;
}
export function detectSimpleFormula(text='', variables=[]) {
  const src=String(text||'').replace(/\n/g,' ');
  const allowed=new Set(variables||[]);
  const out=[];
  const re=/\b([A-Za-z][A-Za-z0-9_]{0,12})\s*=\s*([^.;]{3,120})/g;
  for(const m of src.matchAll(re)){
    const lhs=m[1], rhs=m[2].trim();
    if(!/[+\-*/×x()]/.test(rhs)) continue;
    const ids=[...rhs.matchAll(/\b([A-Za-z][A-Za-z0-9_]{0,12})\b/g)].map(x=>x[1]);
    if(ids.some(id=>!allowed.has(id) && !['PI','SQRT','MIN','MAX','ABS'].includes(id.toUpperCase()))) continue;
    out.push({lhs,rhs,context:m[0]});
  }
  return out.slice(0,20);
}

export function buildAuditSummary(result={}){
  const byVar={}; for(const v of result.variables||[]) byVar[v]=(result.candidates||[]).filter(x=>x.variable===v).length;
  return {schema:P4_SCHEMA,variables:result.variables||[],candidateCount:(result.candidates||[]).length,byVariable:byVar,generatedAt:new Date().toISOString()};
}
