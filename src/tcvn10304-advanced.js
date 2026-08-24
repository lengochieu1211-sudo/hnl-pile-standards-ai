// TCVN 10304:2025 advanced VERIFIED workflows - v1.17.0
// Source-locked to original PDF pages 52-69. No AI-owned arithmetic.

import { TCVN10304_TABLE_18 } from './codepack-tables.js';
import { lookupTable17Mv10304, kvTable17Formula10304, zeta0Table17Formula10304 } from './tcvn10304-table-engine.js';

const num = x => Number(String(x).replace(',','.'));
const pick = (q, names, unit='') => {
  for (const name of names) {
    const esc=name.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
    const m=String(q).match(new RegExp(`(?:^|[^A-Za-z0-9_])${esc}(?=$|\\s|[=:])\\s*[=:]?\\s*(-?\\d+(?:[.,]\\d+)?)\\s*${unit}`,'i'));
    if(m) return num(m[1]);
  }
  return null;
};
const pickCase=(q,name,unit='')=>{ const esc=name.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'); const m=String(q).match(new RegExp(`(?:^|[^A-Za-z0-9_])${esc}(?=$|\\s|[=:])\\s*[=:]\\s*(-?\\d+(?:[.,]\\d+)?)\\s*${unit}`)); return m?num(m[1]):null; };
const requireVals=(items)=>items.filter(([v])=>v==null || Number.isNaN(v)).map(([,n])=>n);
const interp=(x,xs,ys)=>{
  if(x<xs[0]||x>xs.at(-1)) throw new Error(`Giá trị ${x} ngoài phạm vi bảng; không ngoại suy.`);
  for(let i=0;i<xs.length;i++) if(Math.abs(x-xs[i])<1e-12) return ys[i];
  for(let i=0;i<xs.length-1;i++) if(x>xs[i]&&x<xs[i+1]) return ys[i]+(x-xs[i])*(ys[i+1]-ys[i])/(xs[i+1]-xs[i]);
  return null;
};

export const T10304_TABLE17={
  v:[0,0.05,0.10,0.15,0.20,0.25,0.30,0.35,0.40,0.45,0.50],
  kv:[2.82,2.636,2.464,2.302,2.151,2.011,1.882,1.764,1.657,1.560,1.475],
  zeta0:[0.455,0.437,0.419,0.400,0.380,0.361,0.340,0.319,0.297,0.274,0.250],
  mv:[1.345,1.373,1.405,1.446,1.491,1.540,1.607,1.685,1.786,1.916,2.010],
  source:'TCVN 10304:2025 · Bảng 17 · trang 60'
};

export function calcDynamic10304(q=''){
  const sa=pick(q,['sa','s_a','độ chối dư','do choi du'],'m?');
  const sel=pick(q,['sel','s_el','độ chối đàn hồi','do choi dan hoi'],'m?');
  const A=pick(q,['A','diện tích','dien tich'],'(?:m2|m²)?');
  const eta=pick(q,['eta','η'],'(?:kN/m2|kN/m²)?') ?? 1500;
  const M=pick(q,['M','hệ số M','he so M']);
  const Ed=pick(q,['Ed','E_d','năng lượng va chạm','nang luong va cham'],'(?:kJ)?');
  const m1=pick(q,['m1','m_1'],'(?:T|tấn|tan)?'); const m2=pick(q,['m2','m_2'],'(?:T|tấn|tan)?');
  const m3=pick(q,['m3','m_3'],'(?:T|tấn|tan)?') ?? 0; const m4=pick(q,['m4','m_4'],'(?:T|tấn|tan)?');
  const eps2=pick(q,['eps2','epsilon2','ε2','ε²']) ?? 0.2;
  if(sa==null) return {ok:false,missing:['s_a độ chối dư thực tế (m)']};
  if(sa>=0.002){
    const missing=requireVals([[A,'A (m²)'],[M,'M theo Bảng 12 (chọn theo loại đất dưới mũi; không tự nội suy)'],[Ed,'E_d (kJ)'],[m1,'m1 (T)'],[m2,'m2 (T)']]); if(missing.length) return {ok:false,missing};
    const ratio=(m1+eps2*(m2+m3))/(m1+m2+m3);
    const Ru=eta*A*M/2*(Math.sqrt(1+(4*Ed/(eta*A*sa))*ratio)-1);
    return {ok:true,branch:'CT22',RuKn:Ru,inputs:{sa,A,eta,M,Ed,m1,m2,m3,eps2},steps:[`s_a=${sa} m ≥ 0,002 m → dùng CT (22).`,`η=${eta} kN/m²; M=${M}; E_d=${Ed} kJ.`,`R_u=${Ru.toFixed(3)} kN.`],provenance:['TCVN 10304:2025 · 7.3.3.2 · CT (22) · trang 52','Bảng 11-14 · trang 53-55']};
  }
  const missing=requireVals([[sel,'s_el (m)'],[Ed,'E_d (kJ)'],[m2,'m2 (T)'],[m4,'m4 (T)']]); if(missing.length) return {ok:false,missing};
  let theta=pick(q,['theta','θ'],'(?:1/kN)?');
  if(theta==null){
    const np=pick(q,['np','n_p'],'(?:s.m/kN)?') ?? 0.00025; const nf=pick(q,['nf','n_f'],'(?:s.m/kN)?') ?? 0.025;
    const Af=pick(q,['Af','A_f'],'(?:m2|m²)?'); const H=pick(q,['H'],'m?'); const h=pick(q,['h'],'m?') ?? 0;
    const miss=requireVals([[A,'A (m²)'],[Af,'A_f (m²)'],[H,'H chiều cao rơi (m)']]); if(miss.length) return {ok:false,missing:[...miss,'hoặc nhập trực tiếp θ (1/kN)']};
    theta=0.25*(np/A+nf/Af)*(m4/(m4+m2))*Math.sqrt(2*9.81*(H-h));
  }
  const Ru=(1/(2*theta))*((2*sa+sel)/(sa+sel))*(Math.sqrt(1+(8*Ed*(sa+sel)/((2*sa+sel)**2))*(m4/(m4+m2))*theta)-1);
  return {ok:true,branch:'CT23',RuKn:Ru,theta,inputs:{sa,sel,A,Ed,m2,m4,eps2,theta},steps:[`s_a=${sa} m < 0,002 m → dùng CT (23).`,`CT (24): θ=${theta.toExponential(5)} 1/kN.`,`R_u=${Ru.toFixed(3)} kN.`],provenance:['TCVN 10304:2025 · 7.3.3.2 · CT (23),(24) · trang 52-53','Bảng 11-14 · trang 53-55']};
}

export function calcSingleSettlement10304(q=''){
  const N=pick(q,['NdSLS','N_d,SLS','N'],'(?:MN)?'); const G1=pick(q,['G1','G_1'],'(?:MPa)?'); const G2=pick(q,['G2','G_2'],'(?:MPa)?');
  const L=pick(q,['L'],'m?'); let d=pick(q,['d'],'m?'); const A=pick(q,['A'],'(?:m2|m²)?');
  const v1=pick(q,['v1','nu1','ν1']); const v2=pick(q,['v2','nu2','ν2']);
  const EA=pick(q,['EA'],'(?:MN)?');
  if(d==null && A!=null) d=Math.sqrt(4*A/Math.PI);
  const missing=requireVals([[N,'N_d,SLS (MN)'],[G1,'G1 (MPa)'],[G2,'G2 (MPa)'],[L,'L (m)'],[d,'d (m)'],[v1,'ν1'],[v2,'ν2']]); if(missing.length) return {ok:false,missing};
  if(L/d<=5 || (G1*L/(G2*d))<=1) return {ok:false,invalid:true,missing:['Điều kiện 7.4.2.1 không thỏa: cần L/d > 5 và G1·L/(G2·d) > 1.']};
  const k=G1*L/(G2*d); const v=(v1+v2)/2; if(v<0||v>0.5||v1<0||v1>0.5||v2<0||v2>0.5) return {ok:false,invalid:true,missing:['Bảng 17: ν1, ν2 và ν trung bình phải trong 0–0,5; không ngoại suy.']}; const kv=kvTable17Formula10304(v);
  if(k>=7.5){
    if(EA==null) return {ok:false,missing:['EA độ cứng thân cọc khi nén (MN) cho nhánh k ≥ 7,5']};
    const kv1=kvTable17Formula10304(v1); const chi=EA/(G1*L*L);
    if(chi<=0) return {ok:false,missing:['χ=EA/(G1L²) phải >0']};
    const bp=0.17*Math.log(kv*k); const ap=0.17*Math.log(kv1*L/d);
    const lam=2.12*Math.pow(chi,0.75)/(1+2.12*Math.pow(chi,0.75));
    const beta=bp/lam+0.3*(1-bp/ap)/chi; const s=beta*N/(G1*L);
    return {ok:true,branch:'long',settlementM:s,k,beta,lambda1:lam,inputs:{N,G1,G2,L,d,A,v1,v2,EA},steps:[`k=G1·L/(G2·d)=${k.toFixed(3)} ≥ 7,5 → CT (30).`,`CT (31)-(33): β=${beta.toFixed(5)}; λ1=${lam.toFixed(5)}.`,`s=${s.toFixed(6)} m = ${(s*1000).toFixed(2)} mm.`],provenance:['TCVN 10304:2025 · 7.4.2.1 · CT (30)-(33) · trang 59-60','Bảng 17 · trang 60']};
  }
  const mvLookup=lookupTable17Mv10304(v); const mv=mvLookup.value; const zeta0=zeta0Table17Formula10304(v); const zeta=zeta0/(1+k/mv); const s=zeta*N/(G2*d);
  return {ok:true,branch:'short',settlementM:s,k,zeta,mv,inputs:{N,G1,G2,L,d,A,v1,v2,EA},steps:[`k=${k.toFixed(3)} ≤ 7,5 → CT (34).`,`Bảng 17: m_v=${mv.toFixed(4)} (${mvLookup.mode}); ζ0=${zeta0.toFixed(5)} theo CT (34); ζ′=${zeta.toFixed(5)}.`,`s=${s.toFixed(6)} m = ${(s*1000).toFixed(2)} mm.`],provenance:['TCVN 10304:2025 · 7.4.2.1 · CT (34) · Bảng 17 · trang 60']};
}

function interactionDelta(G1,G2,L,v,a){ const kv=2.82-3.78*v+2.18*v*v; const r=kv*G1*L/(2*G2*a); return r>1?0.17*Math.log(r):0; }
export function calcGroupSettlement10304(q=''){
  const G1=pick(q,['G1','G_1'],'(?:MPa)?'); const G2=pick(q,['G2','G_2'],'(?:MPa)?'); const L=pick(q,['L'],'m?'); const v1=pick(q,['v1','nu1','ν1']); const v2=pick(q,['v2','nu2','ν2']);
  const sSingle=pick(q,['s_single','s0','s_coc_don'],'m?'); const Ni=pick(q,['Ni','N_i','NdSLSi'],'(?:MN)?') ?? 0;
  const missing=requireVals([[G1,'G1 (MPa)'],[G2,'G2 (MPa)'],[L,'L (m)'],[v1,'ν1'],[v2,'ν2'],[sSingle,'s_single (m), lấy từ CT (30)/(34)']]); if(missing.length) return {ok:false,missing};
  const v=(v1+v2)/2; let sum=0; const pairs=[];
  const re=/a(\d+)\s*=\s*(\d+(?:[.,]\d+)?)\s*m[^;\n]*?N\1\s*=\s*(\d+(?:[.,]\d+)?)\s*MN/gi; let m;
  while((m=re.exec(q))){ const a=num(m[2]),Nj=num(m[3]),delta=interactionDelta(G1,G2,L,v,a); sum+=delta*Nj; pairs.push({a,Nj,delta}); }
  const explicitSum=pick(q,['sum_deltaN','ΣδN'],'(?:MN)?'); if(explicitSum!=null) sum=explicitSum;
  if(!pairs.length && explicitSum==null) return {ok:false,missing:['Các cọc tương tác dạng a1=...m N1=...MN, a2=...m N2=...MN; hoặc sum_deltaN=Σ(δij·Nj) (MN)']};
  const s=sSingle+sum/(G1*L);
  // CT (39): equivalent length when interacting piles have different lengths.
  const Li=pick(q,['Li','L_i'],'m?'), Lj=pick(q,['Lj','L_j'],'m?');
  const equivalentLengthM=(Li!=null&&Lj!=null)?Math.sqrt((Li*Li+Lj*Lj)/2):null;
  // CT (40): optional nonlinear secant stiffness update. k_w0=N_d,j/s from the initial loading segment.
  const kw0=pick(q,['kw0','k_w0'],'(?:MN/m|kN/m)?');
  const Nu=pick(q,['Nu','N_u'],'(?:MN|kN)?'); const mCorr=pick(q,['m_corr','m hiệu chỉnh','m_hieu_chinh']);
  const kw=(kw0!=null&&Nu!=null&&mCorr!=null&&Nu>0&&mCorr>0)?kw0*Math.pow(1+Math.pow(kw0/Nu,mCorr),-1/mCorr):null;
  const steps=[`CT (36),(37): tính δ cho từng khoảng cách cọc.`,`Σ(δij·Nj)=${sum.toFixed(5)} MN.`,`CT (38): s_i=s_single+Σδij·Nj/(G1L)=${s.toFixed(6)} m = ${(s*1000).toFixed(2)} mm.`];
  if(equivalentLengthM!=null) steps.push(`CT (39): L_eq=${equivalentLengthM.toFixed(4)} m.`);
  if(kw!=null) steps.push(`CT (40): k_w=${kw.toFixed(6)} (cùng đơn vị k_w0).`);
  return {ok:true,settlementM:s,interactionSumMN:sum,pairs,equivalentLengthM,kw,inputs:{G1,G2,L,v1,v2,sSingle,Ni,sumDeltaN:sum,pairs,Li,Lj,kw0,Nu,mCorr},steps,provenance:['TCVN 10304:2025 · 7.4.3.1-7.4.3.4 · CT (36)-(40) · trang 61-62']};
}

export function calcEquivalentBlock10304(q=''){
  const sef=pick(q,['sef','s_ef'],'m?'); const E1=pick(q,['E1','E_1'],'(?:MPa)?'); const E2=pick(q,['E2','E_2'],'(?:MPa)?'); const v2=pick(q,['v2','nu2','ν2']);
  const p=pick(q,['p'],'(?:kPa)?'); const a=pick(q,['a'],'m?'); const d=pick(q,['d'],'m?'); const L=pickCase(q,'L','(?:m)?') ?? pick(q,['length'],'m?'); const E=pick(q,['Epile','E_pile','E_coc','E cọc'],'(?:MPa)?') ?? pickCase(q,'E','(?:MPa)?'); const A=pick(q,['Apile','A_pile','A_coc','A cọc'],'(?:m2|m²)?') ?? pickCase(q,'A','(?:m2|m²)?');
  const shape=/tron|tròn|circle/i.test(q)?'circle':'square'; const b=pick(q,['b'],'m?');
  const missing=requireVals([[sef,'s_ef (m) - độ lún khối quy ước theo TCVN 9362'],[E1,'E1 (MPa)'],[E2,'E2 (MPa)'],[v2,'ν2'],[p,'p (kPa)'],[a,'a khoảng cách cọc (m)'],[d,'d đường kính cọc (m)'],[L,'L (m)'],[E,'E mô đun đàn hồi cọc (MPa)'],[A,'A tiết diện cọc (m²)']]); if(missing.length) return {ok:false,missing};
  const P=(shape==='circle'?0.79:1)*p*a*a; const k=shape==='circle'?d/a:(b!=null?b/a:d/a);
  const dsp1=Math.PI*(1-v2*v2)*p*(a-1.5*d)/(4*E2*1000);
  const dsp0=(1-v2*v2)*(1-k)*P/(d*E2*1000);
  if(Math.abs(dsp0)<1e-12) return {ok:false,missing:['Δs_p0 bằng 0; kiểm tra hình học k và các input CT (44).']};
  const dsp=dsp1/((dsp1/dsp0)*(1-E1/E2)+E1/E2);
  // p[kPa]*m / (E[MPa]*m2) needs /1000 to m because 1 MPa=1000 kPa
  const dsc=P*(L-a)/(E*A)/1000;
  const s=sef+dsp+dsc;
  return {ok:true,settlementM:s,sef,dsp,dsc,P,k,inputs:{sef,E1,E2,v2,p,a,d,L,E,A,b,shape},steps:[`CT (43),(44): Δs_p1=${dsp1.toFixed(6)} m; Δs_p0=${dsp0.toFixed(6)} m.`,`CT (42): Δs_p=${dsp.toFixed(6)} m.`,`CT (45): Δs_c=${dsc.toFixed(6)} m.`,`CT (41): s=s_ef+Δs_p+Δs_c=${s.toFixed(6)} m = ${(s*1000).toFixed(2)} mm.`],provenance:['TCVN 10304:2025 · 7.4.4 · CT (41)-(45) · trang 62-64','s_ef phải tính theo TCVN 9362 như 7.4.4.2 quy định']};
}

export function calcConstructionEffect10304(q=''){
  const structureText=String(q);
  let structureIndex=null;
  if(/to[aà]n kh[oố]i|khung th[eé]p|monolithic/i.test(structureText)) structureIndex=0;
  else if(/khung b[eê] t[oô]ng|khung btct|reinforced concrete frame/i.test(structureText)) structureIndex=1;
  else if(/kh[oố]i x[aâ]y|g[aạ]ch|panel|masonry/i.test(structureText)) structureIndex=2;
  const alpha=pick(q,['alpha','α','biên độ','bien do'],'(?:cm)?');
  const delta=pick(q,['delta','δ','tần số','tan so'],'(?:Hz|1/s|s-1)?');
  const IL=pick(q,['IL','I_L']);
  let soilBand=null;
  if(/c[aá]t[^;\n]*(ch[aặ]t v[uừ]a|medium dense)/i.test(q)) soilBand='medium';
  else if(/c[aá]t[^;\n]*(x[oố]p|loose)/i.test(q)) soilBand='loose';
  else if(/c[aá]t[^;\n]*(ch[aặ]t|dense)/i.test(q)) soilBand='dense';
  else if(IL!=null) soilBand=IL<0.5?'dense':(IL<=0.75?'medium':'loose');
  const row=structureIndex!=null?TCVN10304_TABLE_18[structureIndex]:null;
  const Va=row&&soilBand?row[soilBand]:null;
  const V=(alpha!=null&&delta!=null)?2*Math.PI*alpha*delta:null;
  const Rk=pick(q,['Rk','R_k','sức chịu tải tiêu chuẩn','suc chiu tai tieu chuan'],'(?:kN)?');
  const rate=pick(q,['toc_do_ep','tốc độ ép','toc do ep','tốc độ hạ','toc do ha'],'(?:m/min)?');
  let gammaC=pick(q,['gamma_c','γc']);
  if(gammaC==null && rate!=null && rate<=3) gammaC=1.2;
  const Fmin=(Rk!=null&&gammaC!=null)?gammaC*Rk:null;
  const missing=[];
  if(V==null) missing.push('α biên độ dao động (cm) và δ tần số dao động (Hz) để tính CT (47)');
  if(structureIndex==null) missing.push('Loại kết cấu công trình theo Bảng 18');
  if(soilBand==null) missing.push('Trạng thái đất: cát chặt/chặt vừa/xốp hoặc đất sét với I_L');
  const steps=[];
  if(V!=null) steps.push(`CT (47): V=2π·α·δ=2π×${alpha}×${delta}=${V.toFixed(3)} cm/s.`);
  if(Va!=null) steps.push(`Bảng 18: V_a=${Va.toFixed(2)} cm/s → ${V<=Va?'ĐẠT':'VƯỢT'} giới hạn dao động.`);
  if(Rk!=null){
    if(gammaC==null) missing.push('γc cho CT (48); tiêu chuẩn cho γc=1,2 khi tốc độ hạ cọc ≤3 m/min, trường hợp khác cần giá trị có căn cứ');
    else steps.push(`CT (48): F_c,min ≥ γc·Rk=${gammaC}×${Rk}=${Fmin.toFixed(3)} kN.`);
  }
  return {ok:missing.length===0,VcmS:V,VaCmS:Va,vibrationOk:(V!=null&&Va!=null)?V<=Va:null,FcMinKn:Fmin,gammaC,soilBand,structure:row?.structure||null,
    inputs:{alpha,delta,IL,soilBand,structureIndex,Rk,rate,gammaC},missing,steps,
    provenance:['TCVN 10304:2025 · 7.6.6 · Bảng 18 + CT (47) · trang 68-69','TCVN 10304:2025 · 7.6.7 · CT (48) · trang 69']};
}

export function verifyPiledRaft10304(q=''){
  const IL=pick(q,['IL','I_L']); const E=pick(q,['E'],'(?:MPa)?'); const looseSand=pick(q,['loose_sand','cat_roi','cát rời'],'m?') ?? 0;
  const rock=/tua da|tựa đá|rock-supported|mui coc.*da/i.test(q);
  const missing=[]; if(IL==null) missing.push('I_L của đất loại sét đại diện'); if(E==null) missing.push('E mô đun biến dạng nền (MPa)');
  if(missing.length) return {ok:false,methodOnly:true,missing};
  const eligible=IL<0.5 && E>8 && looseSand<=1 && !rock;
  return {ok:true,methodOnly:true,eligible,inputs:{IL,E,looseSand,rock},steps:[`7.4.5.2: kiểm I_L<0,5 và E>8 MPa → ${(IL<0.5&&E>8)?'đạt':'không đạt'}.`,`7.4.5.3: lớp cát rời ngay dưới móng không được dày >1 m → ${looseSand<=1?'đạt':'không đạt'}.`,`Cọc tựa đá: ${rock?'có → không xét truyền tải của bè xuống nền':'không'}.`,`7.4.5.4-7.4.5.7 yêu cầu mô hình tương tác cọc-đất-bè; tiêu chuẩn không cho công thức đóng để Excel tự sinh phản lực nền từ đầu.`],provenance:['TCVN 10304:2025 · 7.4.5.1-7.4.5.7 · trang 65-66']};
}
