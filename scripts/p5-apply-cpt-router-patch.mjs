#!/usr/bin/env node
import fs from 'node:fs';

const routerPath='src/engineering-router.js';
const registryPath='src/production-status-registry.js';
let router=fs.readFileSync(routerPath,'utf8');
let registry=fs.readFileSync(registryPath,'utf8');

const oldImport="import { lookupTable7Alphas10304, lookupTable8Qb10304, lookupTable15Beta1, lookupTable15SideBeta } from './tcvn10304-table-engine.js';";
const newImport="import { lookupTable7Alphas10304, lookupTable8Qb10304, lookupTable15Beta1, lookupTable15SideBeta, lookupTable16Cpt10304 } from './tcvn10304-table-engine.js';";
if(router.includes(oldImport)) router=router.replace(oldImport,newImport);
else if(!router.includes('lookupTable16Cpt10304')) throw new Error('P5.2 import anchor not found');

const start=router.indexOf("function calcCpt10304(q='') {");
const end=router.indexOf("function calcSpt10304(q='', options={})",start);
if(start<0||end<0) throw new Error('P5.2 calcCpt anchors not found');

const replacement=`function calcCpt10304(q='') {
  const geometry=inferPileGeometry(q);
  const norm=n(q);
  const isBored=/coc (?:khoan|nhoi)|bored|6\\.5\\s*a/.test(norm);
  const A=explicit(q,['Ap','A_p','A'],'(?:m2|mm2)?') ?? geometry.areaM2;
  const u=explicit(q,['u','chu vi'],'(?:m|mm)?') ?? geometry.perimeterM;

  // P5.2: CT (29) is a distinct CPT branch for bored piles under 6.5 a).
  // It must not be approximated by CT (25)-(28): Table 16 provides qb/fi
  // directly from qc and gammaR,f depends on concreting technology.
  if(isBored){
    const h=explicit(q,['h','L','chiều dài','chieu dai'],'m?');
    const qc=explicit(q,['qc','q_c'],'(?:kPa|MPa)?');
    const soil=/s[eé]t|dat dinh|clay/.test(norm)?'clay':'sand';
    const d=geometry.diameterM ?? explicit(q,['D','diameter','đường kính','duong kinh'],'m?');
    let qb=explicit(q,['qb','q_b'],'(?:kPa)?');
    let fi=explicit(q,['fi','f_i'],'(?:kPa)?');
    let qbLookup=null,fiLookup=null;
    if(qc!=null && qb==null){
      try{qbLookup=lookupTable16Cpt10304({qc,soil,component:'qb'});qb=qbLookup.value;}
      catch(e){return {ok:false,status:'REVIEW',cptMode:'BORED_CT29',missing:[e.message]};}
    }
    if(qc!=null && fi==null){
      try{fiLookup=lookupTable16Cpt10304({qc,soil,component:'fi'});fi=fiLookup.value;}
      catch(e){return {ok:false,status:'REVIEW',cptMode:'BORED_CT29',missing:[e.message]};}
    }
    let gammaRf=explicit(q,['gamma_Rf','gamma_R,f','γRf','γR,f']);
    const wet=/duoi nuoc|dưới nước|bentonite|dung dich set|dung dịch sét|ong vach|ống vách/.test(norm);
    if(gammaRf==null) gammaRf=wet?0.7:1.0;
    const missing=[];
    if(A==null) missing.push('A diện tích mũi (m²)');
    if(u==null) missing.push('u chu vi cọc (m)');
    if(!(h>0)) missing.push('h/L chiều dài cọc trong đất (m)');
    if(qb==null) missing.push('qc để tra qb Bảng 16 hoặc qb có provenance');
    if(fi==null) missing.push('qc để tra fi Bảng 16 hoặc fi có provenance');
    if(!(d>0)) missing.push('D đường kính cọc khoan để kiểm phạm vi Bảng 16');
    if(missing.length) return {ok:false,status:'REVIEW',cptMode:'BORED_CT29',missing};
    const applicability=[];
    if(d<0.6-1e-12||d>1.2+1e-12) applicability.push(\`Bảng 16 áp dụng cho cọc khoan D=0,6–1,2 m; D đang là \${d} m.\`);
    if(h<5-1e-12) applicability.push(\`Bảng 16 yêu cầu cọc hạ trong đất tối thiểu 5 m; h đang là \${h} m.\`);
    if(applicability.length) return {ok:false,status:'REVIEW',cptMode:'BORED_CT29',inputs:{A,u,h,qc,qb,fi,gammaRf,soil,d},missing:applicability};
    const segmentCount=Math.max(1,Math.ceil(h/2));
    const segmentThickness=h/segmentCount;
    const shaftSum=gammaRf*fi*h;
    const tip=qb*A;
    const shaft=u*shaftSum;
    const Ru=tip+shaft;
    return {
      ok:true,status:'VERIFIED',cptMode:'BORED_CT29',formulaId:29,RkKn:Ru,
      inputs:{A,u,h,qc,qb,fi,gammaRf,soil,d,segmentCount,segmentThicknessM:segmentThickness,qbAuto:!!qbLookup,fiAuto:!!fiLookup,concreting:wet?'water-bentonite-casing':'dry'},
      tableLookups:{qb:qbLookup,fi:fiLookup},
      steps:[
        \`Bảng 16: qc=\${qc} kPa → qb=\${qb} kPa; fi=\${fi} kPa.\`,
        \`Điều kiện CT (29): D=\${d.toFixed(3)} m trong 0,6–1,2 m; h=\${h.toFixed(3)} m ≥5 m; chia \${segmentCount} đoạn tính, mỗi đoạn \${segmentThickness.toFixed(3)} m ≤2 m.\`,
        \`γR,f=\${gammaRf} (\${wet?'đổ dưới nước/bentonite/ống vách':'đổ bê tông điều kiện khô'}).\`,
        \`CT (29): Rk,u=qb·A+u·Σ(γR,f·fi·hi)=\${tip.toFixed(3)}+\${shaft.toFixed(3)}=\${Ru.toFixed(3)} kN.\`
      ],
      provenance:[
        'TCVN 10304:2025 · 7.3.4.4 · CT (29) · tr.57',
        'TCVN 10304:2025 · Bảng 16 · tr.58 · Chú thích 1: qc trung gian nội suy tuyến tính; không nội suy qua ô “–”',
        'Bảng 16: cọc khoan D=600–1200 mm, chiều dài trong đất ≥5 m; hi≤2 m'
      ]
    };
  }

  // Existing CT (25)-(28) branch is intentionally preserved byte-for-byte in logic.
  const h=explicit(q,['h'],'m?');
  const qs=explicit(q,['qs','q_s'],'(?:kPa)?');
  const fs=explicit(q,['fs','f_s'],'(?:kPa)?');
  let b1=explicit(q,['beta1','β1']); let b2=explicit(q,['beta2','β2']);
  const pile=/coc vit/.test(norm)?'screw':'driven';
  const load=/keo|nh[oổ]/.test(norm)?'tension':'compression';
  const soil=/s[eé]t|dat dinh/.test(norm)?'clay':'sand';
  const probe=/dien|loai ii|loai iii/.test(norm)?'electric':'mechanical';
  let b1Lookup=null,b2Lookup=null;
  if(b1==null&&qs!=null){ try{b1Lookup=lookupTable15Beta1({qs,pile,load});b1=b1Lookup.value;}catch(e){return {ok:false,missing:[e.message,'Hoặc nhập β1 thủ công kèm provenance.']};} }
  if(b2==null&&fs!=null){ try{b2Lookup=lookupTable15SideBeta({fs,probe,soil,saturatedSand:/bao hoa/.test(norm)});b2=b2Lookup.value;}catch(e){return {ok:false,missing:[e.message,'Hoặc nhập β2/βi thủ công kèm provenance.']};} }
  const missing=[]; for(const [v,nm] of [[A,'A (m²)'],[u,'u (m)'],[h,'h (m)'],[qs,'qs (kPa)'],[fs,'fs (kPa)'],[b1,'β1 Bảng 15'],[b2,probe==='mechanical'?'β2 Bảng 15':'βi Bảng 15']]) if(v==null) missing.push(nm);
  if(missing.length) return {ok:false,missing};
  const Rs=b1*qs, f=b2*fs, Ru=Rs*A+f*h*u;
  return {ok:true,status:'VERIFIED',cptMode:'DRIVEN_CT25_28',formulaId:25,RkKn:Ru,inputs:{A,u,h,qs,fs,b1,b2,pile,load,soil,probe,b1Auto:!!b1Lookup,b2Auto:!!b2Lookup,saturatedSand:/bao hoa/.test(norm)},tableLookups:{b1:b1Lookup,b2:b2Lookup},steps:[\`Bảng 15: β1=\${b1}\${b1Lookup?\` (\${b1Lookup.mode})\`:''}; \${probe==='mechanical'?'β2':'βi'}=\${b2}\${b2Lookup?\` (\${b2Lookup.mode})\`:''}.\`,\`CT (26): Rs=β1·qs=\${Rs.toFixed(3)} kPa.\`,\`CT (27)/(28): f=β·fs=\${f.toFixed(3)} kPa.\`,\`CT (25): Ru=Rs·A+f·h·u=\${Ru.toFixed(3)} kN.\`],provenance:['TCVN 10304:2025 · 7.3.4.2 · CT (25)-(28) · tr.55-56','Bảng 15 · tr.57 · không tự nội suy nếu không có chú thích cho phép']};
}
`;
router=router.slice(0,start)+replacement+router.slice(end);

const registryAnchor="  if(workflow.id==='10304-spt' && result?.inputMode==='EXPLICIT_SPT_SUMMARY') return '10304-spt-summary-explicit';";
if(!router.includes("workflow.id==='10304-cpt' && result?.cptMode")){
  if(!router.includes(registryAnchor)) throw new Error('P5.2 production registry router anchor missing');
  router=router.replace(registryAnchor,"  if(workflow.id==='10304-cpt' && result?.cptMode) return '10304-cpt';\n"+registryAnchor);
}

const productionAnchor="  '10304-spt-raw':{status:'LOCKED',productionNumeric:true,source:'Phụ lục D · D.1–D.6 · Bảng D.1 · SPT PDF Decision Pass · measured tip window + layer-representative shaft N; no continuous DCE interpolation'},";
if(!registry.includes("'10304-cpt':")){
  if(!registry.includes(productionAnchor)) throw new Error('P5.2 production registry file anchor missing');
  registry=registry.replace(productionAnchor,"  '10304-cpt':{status:'VERIFIED',productionNumeric:true,source:'7.3.4 · CT (25)–(29) · Bảng 15–16 · P5.2 CPT Golden + applicability gate'},\n"+productionAnchor);
}

fs.writeFileSync(routerPath,router);
fs.writeFileSync(registryPath,registry);
console.log('P5.2 CPT router patch applied.');
