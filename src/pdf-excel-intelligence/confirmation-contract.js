export const P4_CONFIRMATION_SCHEMA='HNL_P4_REVIEW_CONFIRMATION_V1';

const MACHINE_SOURCE_TYPES=new Set(['pdf-scan','image','ocr','vision-reuse']);

function text(v=''){return String(v??'').trim();}
function finite(v){const n=Number(v);return Number.isFinite(n)?n:null;}
function normBbox(v){
  if(!Array.isArray(v)||v.length!==4)return null;
  const a=v.map(Number);if(!a.every(Number.isFinite))return null;
  const [x0,y0,x1,y1]=a;
  if(x0<0||y0<0||x1>1||y1>1||x1<=x0||y1<=y0)return null;
  return a.map(x=>Number(x.toFixed(8)));
}
function stableValue(v){
  if(v===null||v===undefined)return null;
  if(typeof v==='number')return Number.isFinite(v)?v:null;
  if(typeof v==='string'||typeof v==='boolean')return v;
  if(Array.isArray(v))return v.map(stableValue);
  if(typeof v==='object')return Object.fromEntries(Object.keys(v).sort().map(k=>[k,stableValue(v[k])]));
  return String(v);
}
function same(a,b){return JSON.stringify(stableValue(a))===JSON.stringify(stableValue(b));}

export function normalizeP4ConfirmationSource(source={}){
  return {
    file:text(source.file||source.name),
    documentId:text(source.documentId||source.corpusDocumentId),
    standard:text(source.standard),
    page:Number.isInteger(Number(source.page))&&Number(source.page)>0?Number(source.page):null,
    bbox:normBbox(source.bbox||source.normalizedBbox),
    sourceType:text(source.sourceType),
    engine:text(source.engine),
    route:text(source.route),
    sourceSha:text(source.sourceSha).toLowerCase(),
    fingerprint:text(source.fingerprint),
  };
}

export function validateP4ConfirmationSource(source={}){
  const s=normalizeP4ConfirmationSource(source),errors=[];
  if(!s.file)errors.push('SOURCE_FILE_MISSING');
  if(!s.sourceType)errors.push('SOURCE_TYPE_MISSING');
  if(!s.engine)errors.push('SOURCE_ENGINE_MISSING');
  if(!/^[0-9a-f]{40}$/.test(s.sourceSha))errors.push('SOURCE_SHA_INVALID');
  if(s.sourceType==='pdf-native'||s.sourceType==='pdf-scan'||s.sourceType==='ocr'||s.sourceType==='vision-reuse'){
    if(!s.page)errors.push('SOURCE_PAGE_MISSING');
    if(!s.bbox)errors.push('SOURCE_BBOX_MISSING');
  }
  if(s.sourceType==='image'&&!s.fingerprint)errors.push('SOURCE_IMAGE_FINGERPRINT_MISSING');
  return {ok:errors.length===0,source:s,errors};
}

export function createP4ReviewConfirmation({source={},fieldKey='',value=null,confirmedAt=new Date().toISOString(),confirmedBy='user',note=''}={}){
  const src=validateP4ConfirmationSource(source);
  if(!src.ok)throw new Error(`P4_CONFIRMATION_SOURCE_INVALID:${src.errors.join(',')}`);
  const key=text(fieldKey);
  if(!key)throw new Error('P4_CONFIRMATION_FIELD_KEY_MISSING');
  const when=new Date(confirmedAt);
  if(!Number.isFinite(when.getTime()))throw new Error('P4_CONFIRMATION_TIME_INVALID');
  if(text(confirmedBy)!=='user')throw new Error('P4_CONFIRMATION_ACTOR_INVALID');
  return {
    schema:P4_CONFIRMATION_SCHEMA,
    confirmedBy:'user',
    confirmedAt:when.toISOString(),
    fieldKey:key,
    value:stableValue(value),
    source:src.source,
    note:text(note),
  };
}

export function validateP4ReviewConfirmation(record={},live={}){
  const errors=[];
  if(record?.schema!==P4_CONFIRMATION_SCHEMA)errors.push('CONFIRMATION_SCHEMA_INVALID');
  if(record?.confirmedBy!=='user')errors.push('CONFIRMATION_ACTOR_INVALID');
  const at=new Date(record?.confirmedAt||'');if(!Number.isFinite(at.getTime()))errors.push('CONFIRMATION_TIME_INVALID');
  const expectedKey=text(live.fieldKey);
  if(!expectedKey||text(record?.fieldKey)!==expectedKey)errors.push('CONFIRMATION_FIELD_MISMATCH');
  if(!same(record?.value,live.value))errors.push('CONFIRMATION_VALUE_MISMATCH');
  const bound=validateP4ConfirmationSource(record?.source||{});
  const current=validateP4ConfirmationSource(live.source||{});
  if(!bound.ok)errors.push(...bound.errors.map(x=>`BOUND_${x}`));
  if(!current.ok)errors.push(...current.errors.map(x=>`LIVE_${x}`));
  if(bound.ok&&current.ok&&!same(bound.source,current.source))errors.push('CONFIRMATION_SOURCE_MISMATCH');
  const maxAgeMs=finite(live.maxAgeMs);
  if(maxAgeMs!=null&&maxAgeMs>=0&&Number.isFinite(at.getTime())&&Date.now()-at.getTime()>maxAgeMs)errors.push('CONFIRMATION_EXPIRED');
  return {ok:errors.length===0,errors,confirmation:record,source:current.source};
}

export function isMachineP4Source(source={}){
  return MACHINE_SOURCE_TYPES.has(normalizeP4ConfirmationSource(source).sourceType);
}
