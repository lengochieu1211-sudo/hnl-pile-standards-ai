// HNL SPT Golden shared deterministic input/geometry specification.
// Numerical SPT coefficients/caps remain owned by tcvn10304-table-engine.js.

export const SPT_SECTION_TYPES = Object.freeze(['square','rectangle','circle']);

const finite = v => {
  if(v===null||v===undefined||String(v).trim()==='') return null;
  const n=Number(String(v).replace(',','.'));
  return Number.isFinite(n)?n:null;
};
const fold = raw => String(raw??'').normalize('NFKC').replace(/[×✕✖]/g,'x').toLocaleLowerCase('vi').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/đ/g,'d').replace(/\s+/g,' ').trim();
export function lengthToM(value,unit='m'){
  const n=finite(value); if(n==null) return null;
  return /^mm$/i.test(String(unit).trim())?n/1000:n;
}
export function normalizeSptSectionType(value=''){
  const v=fold(value);
  if(['square','vuong','coc vuong'].includes(v)) return 'square';
  if(['rectangle','rectangular','chu nhat','coc chu nhat'].includes(v)) return 'rectangle';
  if(['circle','circular','tron','coc tron'].includes(v)) return 'circle';
  return null;
}

export function deriveSptSectionGeometry(input={}){
  const sectionType=normalizeSptSectionType(input.sectionType??input.shape) || (finite(input.diameterM)>0?'circle':(finite(input.widthM)>0&&finite(input.heightM)>0&&Math.abs(finite(input.widthM)-finite(input.heightM))>1e-12?'rectangle':(finite(input.sideM)>0||finite(input.widthM)>0?'square':null)));
  if(sectionType==='circle'){
    const diameterM=finite(input.diameterM??input.DM);
    if(!(diameterM>0)) throw new Error('Đường kính D phải > 0 m.');
    return Object.freeze({sectionType:'circle',shape:'circle',diameterM,widthM:null,heightM:null,sideM:null,areaM2:Math.PI*diameterM*diameterM/4,tipAreaM2:Math.PI*diameterM*diameterM/4,perimeterM:Math.PI*diameterM,characteristicM:diameterM,source:'DERIVED_FROM_D'});
  }
  if(sectionType==='square'){
    const sideM=finite(input.sideM??input.widthM??input.bM);
    const heightM=finite(input.heightM??input.hM??sideM);
    if(!(sideM>0)||!(heightM>0)) throw new Error('Cạnh b/h phải > 0 m.');
    if(Math.abs(sideM-heightM)>Math.max(sideM,heightM)*1e-9) throw new Error('Tiết diện vuông yêu cầu b = h.');
    const b=(sideM+heightM)/2;
    return Object.freeze({sectionType:'square',shape:'square',diameterM:null,widthM:b,heightM:b,sideM:b,areaM2:b*b,tipAreaM2:b*b,perimeterM:4*b,characteristicM:b,source:'DERIVED_FROM_B_H'});
  }
  if(sectionType==='rectangle'){
    const widthM=finite(input.widthM??input.bM),heightM=finite(input.heightM??input.hM);
    if(!(widthM>0)||!(heightM>0)) throw new Error('Kích thước b và h phải > 0 m.');
    return Object.freeze({sectionType:'rectangle',shape:'rectangle',diameterM:null,widthM,heightM,sideM:null,areaM2:widthM*heightM,tipAreaM2:widthM*heightM,perimeterM:2*(widthM+heightM),characteristicM:Math.min(widthM,heightM),source:'DERIVED_FROM_B_H'});
  }
  throw new Error('Thiếu loại tiết diện và kích thước hình học b/h/D.');
}

export function parseSptPileLength(raw=''){
  const text=fold(raw);
  const direct=[
    /(?:^|\b)(?:chieu dai(?: coc)?|coc dai)\s*(?:=|:)?\s*(\d+(?:[.,]\d+)?)\s*(mm|m)\b/i,
    /(?:^|[^a-z0-9_])l\s*(?:=|:)\s*(\d+(?:[.,]\d+)?)\s*(mm|m)\b/i,
    /\bdai\s*(?:=|:)?\s*(\d+(?:[.,]\d+)?)\s*(mm|m)\b/i
  ];
  for(const re of direct){const m=text.match(re);if(m)return {lengthM:lengthToM(m[1],m[2]),sourceText:m[0].trim(),origin:'RAW_TEXT'};}
  const triple=text.match(/(?:coc[^\n,;:]*)?(\d+(?:[.,]\d+)?)\s*x\s*(\d+(?:[.,]\d+)?)\s*x\s*(\d+(?:[.,]\d+)?)\s*(mm|m)\b/i);
  if(triple) return {lengthM:lengthToM(triple[3],triple[4]),sourceText:triple[0].trim(),origin:'RAW_TEXT_TRIPLE_DIMENSION'};
  return null;
}

export function parseSptPileSection(raw=''){
  const text=fold(raw);
  const triple=text.match(/(?:coc|btct)[^\n,;:]{0,40}?(\d+(?:[.,]\d+)?)\s*x\s*(\d+(?:[.,]\d+)?)\s*x\s*(\d+(?:[.,]\d+)?)\s*(mm|m)\b/i);
  if(triple){
    const b=lengthToM(triple[1],triple[4]),h=lengthToM(triple[2],triple[4]);
    return {sectionType:Math.abs(b-h)<=Math.max(b,h)*1e-9?'square':'rectangle',widthM:b,heightM:h,sideM:Math.abs(b-h)<=Math.max(b,h)*1e-9?(b+h)/2:null,diameterM:null,sourceText:triple[0].trim(),origin:'RAW_TEXT'};
  }
  const twoUnit=text.match(/(?:coc|btct|vuong|chu nhat)?[^\n,;:]{0,24}?(\d+(?:[.,]\d+)?)\s*x\s*(\d+(?:[.,]\d+)?)\s*(mm|m)\b/i);
  if(twoUnit){
    const b=lengthToM(twoUnit[1],twoUnit[3]),h=lengthToM(twoUnit[2],twoUnit[3]);
    return {sectionType:Math.abs(b-h)<=Math.max(b,h)*1e-9?'square':'rectangle',widthM:b,heightM:h,sideM:Math.abs(b-h)<=Math.max(b,h)*1e-9?(b+h)/2:null,diameterM:null,sourceText:twoUnit[0].trim(),origin:'RAW_TEXT'};
  }
  const square=text.match(/(?:coc\s+)?vuong(?:\s+canh)?\s*(?:=|:)?\s*(\d+(?:[.,]\d+)?)\s*(mm|m)\b/i);
  if(square){const b=lengthToM(square[1],square[2]);return {sectionType:'square',widthM:b,heightM:b,sideM:b,diameterM:null,sourceText:square[0].trim(),origin:'RAW_TEXT'};}
  const circle=text.match(/(?:duong kinh\s*|(?:^|[^a-z0-9_])d\s*(?:=|:)?\s*)(\d+(?:[.,]\d+)?)\s*(mm|m)\b/i);
  if(circle){const d=lengthToM(circle[1],circle[2]);return {sectionType:'circle',widthM:null,heightM:null,sideM:null,diameterM:d,sourceText:circle[0].trim(),origin:'RAW_TEXT'};}
  // Required shorthand: “Cọc BTCT 400x400, dài 10m”. Bare large pile dimensions are treated as mm,
  // but the assumption is surfaced so it is never a silent unit guess.
  const bare=text.match(/(?:coc|btct)[^\n,;:]{0,24}?(\d+(?:[.,]\d+)?)\s*x\s*(\d+(?:[.,]\d+)?)(?=\s*(?:,|;|dai|$))/i);
  if(bare){
    const a=finite(bare[1]),b=finite(bare[2]);
    if(a>=100&&b>=100){const w=a/1000,h=b/1000;return {sectionType:Math.abs(w-h)<=1e-12?'square':'rectangle',widthM:w,heightM:h,sideM:Math.abs(w-h)<=1e-12?w:null,diameterM:null,sourceText:bare[0].trim(),origin:'RAW_TEXT_ASSUMED_MM',unitAssumption:'PILE_SECTION_BARE_DIMENSIONS_GE_100_ARE_MM'};}
  }
  return null;
}

export function buildNormalizedSptGeometryInput(raw='',fallback={}){
  const section=parseSptPileSection(raw)||{};
  const length=parseSptPileLength(raw)||{};
  return {
    sectionType:section.sectionType??fallback.sectionType??fallback.shape??null,
    widthM:section.widthM??fallback.widthM??fallback.sideM??null,
    heightM:section.heightM??fallback.heightM??fallback.sideM??null,
    sideM:section.sideM??fallback.sideM??null,
    diameterM:section.diameterM??fallback.diameterM??null,
    lengthM:length.lengthM??fallback.lengthM??null,
    geometryOrigin:section.origin??null,
    lengthOrigin:length.origin??null,
    unitAssumption:section.unitAssumption??null,
    geometrySourceText:section.sourceText??'',
    lengthSourceText:length.sourceText??''
  };
}
