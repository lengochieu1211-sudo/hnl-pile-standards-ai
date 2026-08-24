// TCVN 5574:2018 VERIFIED core workflows - v1.24.0
// Pass 1: material properties, flexure (rectangular/T/I flange compression), eccentric compression.
// Sources independently checked against user PDF pages 48, 56-61 (standard pages 48, 56-61).

import { lookup5574Concrete, lookup5574Steel, lookup5574ConcreteSls, lookup5574SteelSls, lookup5574CrackLimit, lookup5574PrestressFriction } from './codepack-tables.js';

const num=v=>{ if(v==null || v==='') return null; const x=Number(v); return Number.isFinite(x)?x:null; };
export const TCVN5574_ES_BAR_MPA = 200000; // 6.2.3.3, reinforcing bars to TCVN 1651-1/-2.
export const EPS_B2_SHORT_HEAVY = 0.0035; // B60 trở xuống, 6.1.4.2, tải ngắn hạn.
export function epsB2ShortHeavy5574(grade='B30'){
  const g=Number(String(grade).toUpperCase().replace('B','').replace(',','.'));
  if(!Number.isFinite(g) || g<=60) return 0.0035;
  if(g>=100) return 0.0028;
  if(g>=70) return 0.0033 + (g-70)*(0.0028-0.0033)/30;
  return 0.0035; // khoảng B60-B70 không có cấp trung gian trong bảng sử dụng.
}

export function xiR5574({Rs,Es=TCVN5574_ES_BAR_MPA,epsB2=EPS_B2_SHORT_HEAVY,highStrength=false}={}){
  Rs=num(Rs); Es=num(Es); epsB2=num(epsB2);
  if([Rs,Es,epsB2].some(v=>v==null)||Es<=0||epsB2<=0) return null;
  const epsSel=Rs/Es;
  const numerator=highStrength?0.7:0.8;
  return {epsSel,xiR:numerator/(1+epsSel/epsB2)};
}

export function calcBendingRect5574(input={}){
  const grade=String(input.grade||'B30').toUpperCase(); const steel=String(input.steel||'CB400-V').toUpperCase();
  const c=lookup5574Concrete(grade), s=lookup5574Steel(steel);
  if(!c||!s) return {ok:false,missing:['Cấp bê tông/thép phải có trong bảng Verified TCVN 5574.']};
  const b=num(input.b), h0=num(input.h0), As=num(input.As), Asp=num(input.Asp??0), ap=num(input.ap??0), M=num(input.M);
  const missing=[]; if(!(b>0)) missing.push('b (mm)'); if(!(h0>0)) missing.push('h0 (mm)'); if(!(As>=0)) missing.push('As (mm²)'); if(M==null) missing.push('M (kN.m)'); if(missing.length) return {ok:false,missing};
  const x=(s.Rs*As-s.Rsc*Asp)/(c.Rb*b); const xi=x/h0; const epsB2=epsB2ShortHeavy5574(grade); const lim=xiR5574({Rs:s.Rs,epsB2,highStrength:/B(?:7[0-9]|8[0-9]|9[0-9]|100)/.test(grade)});
  if(!(x>=0)) return {ok:false,missing:['Cân bằng CT (35) cho x<0; kiểm lại As/As\' và giả thiết tiết diện.']};
  const MuNmm=c.Rb*b*x*(h0-0.5*x)+s.Rsc*Asp*(h0-ap); const Mu=MuNmm/1e6;
  const inDomain=lim?xi<=lim.xiR:false;
  return {ok:true,workflow:'5574-bending-rect',inputs:{grade,steel,b,h0,As,Asp,ap,M},materials:{concreteGrade:c.grade,steelGrade:s.grade,Rb:c.Rb,Rbt:c.Rbt,Eb:c.Eb,Rs:s.Rs,Rsc:s.Rsc,Rsw:s.Rsw,Es:TCVN5574_ES_BAR_MPA},xMm:x,x,xi,xiR:lim?.xiR,MuKnM:Mu,Mu,utilization:Mu>0?M/Mu:null,pass:inDomain&&M<=Mu,check:Boolean(inDomain&&M<=Mu),domainPass:inDomain,
    steps:[`Bảng 7/10/13: ${grade} → Rb=${c.Rb} MPa; ${steel} → Rs=${s.Rs} MPa, Rsc=${s.Rsc} MPa.`,`CT (35): x=(Rs·As−Rsc·As')/(Rb·b)=${x.toFixed(3)} mm; ξ=x/h0=${xi.toFixed(4)}.`,`CT (31)-(32): ξR=${lim?.xiR?.toFixed(4)}; yêu cầu ξ≤ξR cho nhánh CT (34).`,`CT (34): Mu=${Mu.toFixed(3)} kN.m.`,`CT (33): M=${M.toFixed(3)} kN.m ${inDomain&&M<=Mu?'≤':'>'} Mu → ${inDomain&&M<=Mu?'ĐẠT':'KHÔNG ĐẠT/NGOÀI NHÁNH'}.`],
    provenance:['TCVN 5574:2018 · 8.1.2.2.3 · CT (31)-(32) · trang chuẩn 56 / PDF 54','TCVN 5574:2018 · 8.1.2.3.1-2 · CT (33)-(35) · trang chuẩn 57 / PDF 55',...c.sources,...s.sources,'TCVN 5574:2018 · 6.2.3.3 · Es thanh = 2.0×10^5 MPa · trang chuẩn 48 / PDF 46']};
}

export function calcBendingT5574(input={}){
  const grade=String(input.grade||'B30').toUpperCase(); const steel=String(input.steel||'CB400-V').toUpperCase(); const c=lookup5574Concrete(grade), s=lookup5574Steel(steel);
  if(!c||!s) return {ok:false,missing:['Cấp bê tông/thép Verified.']};
  const b=num(input.b), bf=num(input.bf), hf=num(input.hf), h0=num(input.h0), As=num(input.As), Asp=num(input.Asp??0), ap=num(input.ap??0), M=num(input.M);
  const missing=[]; for(const [n,v] of [['b',b],['bf\'',bf],['hf\'',hf],['h0',h0],['As',As],['M',M]]) if(!(v>=0) || (n!=='M'&&v===0)) missing.push(`${n}`); if(missing.length) return {ok:false,missing};
  const flangeCondition=s.Rs*As <= c.Rb*bf*hf+s.Rsc*Asp;
  const x=flangeCondition?(s.Rs*As-s.Rsc*Asp)/(c.Rb*bf):(s.Rs*As-s.Rsc*Asp-c.Rb*(bf-b)*hf)/(c.Rb*b);
  const xi=x/h0, epsB2=epsB2ShortHeavy5574(grade), lim=xiR5574({Rs:s.Rs,epsB2,highStrength:/B(?:7[0-9]|8[0-9]|9[0-9]|100)/.test(grade)});
  const MuNmm=flangeCondition?c.Rb*bf*x*(h0-0.5*x)+s.Rsc*Asp*(h0-ap):c.Rb*b*x*(h0-0.5*x)+c.Rb*(bf-b)*hf*(h0-0.5*hf)+s.Rsc*Asp*(h0-ap);
  const Mu=MuNmm/1e6; const domain=lim&&xi<=lim.xiR;
  return {ok:true,workflow:'5574-bending-t',inputs:{grade,steel,b,bf,hf,h0,As,Asp,ap,M},flangeCompressionOnly:flangeCondition,xMm:x,x,xi,xiR:lim?.xiR,MuKnM:Mu,Mu,pass:Boolean(domain&&M<=Mu),check:Boolean(domain&&M<=Mu),domainPass:Boolean(domain),materials:{concreteGrade:c.grade,steelGrade:s.grade,Rb:c.Rb,Rbt:c.Rbt,Eb:c.Eb,Rs:s.Rs,Rsc:s.Rsc,Rsw:s.Rsw,Es:TCVN5574_ES_BAR_MPA},
    steps:[`CT (36): Rs·As ${flangeCondition?'≤':'>'} Rb·bf'·hf'+Rsc·As' → biên vùng nén ${flangeCondition?'nằm trong cánh':'nằm trong sườn'}.`,`x=${x.toFixed(3)} mm; ξ=${xi.toFixed(4)}, ξR=${lim?.xiR?.toFixed(4)}.`,`${flangeCondition?'CT (34) với b=bf\'':'CT (37)-(38)'}: Mu=${Mu.toFixed(3)} kN.m.`,`M=${M.toFixed(3)} kN.m → ${domain&&M<=Mu?'ĐẠT':'KHÔNG ĐẠT/NGOÀI NHÁNH'}.`],
    provenance:['TCVN 5574:2018 · 8.1.2.3.3 · CT (36)-(38) · trang chuẩn 57-58 / PDF 55-56',...c.sources,...s.sources]};
}

export function calcEccentricRect5574(input={}){
  const grade=String(input.grade||'B30').toUpperCase(); const steel=String(input.steel||'CB400-V').toUpperCase(); const c=lookup5574Concrete(grade), s=lookup5574Steel(steel);
  if(!c||!s) return {ok:false,missing:['Cấp bê tông/thép Verified.']};
  const b=num(input.b), h=num(input.h), h0=num(input.h0), As=num(input.As), Asp=num(input.Asp??0), ap=num(input.ap??0), N=num(input.N), M=num(input.M??0);
  const L=num(input.L), L0=num(input.L0), e0Override=num(input.e0), ML=num(input.ML), ML1=num(input.ML1), I=num(input.I), Is=num(input.Is);
  const missing=[]; for(const [name,v] of [['b',b],['h',h],['h0',h0],['As',As],['N',N]]) if(!(v>0) && !(name==='As'&&v===0)) missing.push(`${name}`); if(missing.length) return {ok:false,missing};
  const eStatic=e0Override!=null?e0Override:(N>0?Math.abs(M)*1e6/(N*1000):null); if(eStatic==null) return {ok:false,missing:['e0 (mm) hoặc M (kN.m) và N (kN)']};
  const ea=Math.max(L?L*1000/600:0,h/30,10);
  // 8.1.2.2.4: hệ siêu tĩnh lấy e0 không nhỏ hơn ea; hệ tĩnh định cộng thêm ea vào độ lệch tâm tĩnh học.
  const determinate=Boolean(input.determinate);
  const e0=determinate?eStatic+ea:Math.max(eStatic,ea);
  let eta=1,Ncr=null,D=null,kb=null,phiL=null,deltaE=null;
  if(L0!=null && I!=null && Is!=null){
    phiL=Math.min(2,1+(ML!=null&&ML!==0&&ML1!=null?ML1/ML:0)); deltaE=Math.max(0.15,Math.min(1.5,e0/h)); kb=0.15/(phiL*(0.3+deltaE)); D=kb*c.Eb*I+0.7*TCVN5574_ES_BAR_MPA*Is; Ncr=Math.PI**2*D/(L0**2)/1000; if(Ncr<=N) return {ok:false,missing:['N ≥ Ncr theo CT (45): ngoài miền tính sơ đồ không biến dạng; cần sơ đồ biến dạng/phi tuyến.'],diagnostics:{Ncr}}; eta=1/(1-N/Ncr);
  }
  const e=e0*eta+(h0-ap)/2; const epsB2=epsB2ShortHeavy5574(grade); const lim=xiR5574({Rs:s.Rs,epsB2,highStrength:/B(?:7[0-9]|8[0-9]|9[0-9]|100)/.test(grade)});
  const x42=(N*1000+s.Rs*As-s.Rsc*Asp)/(c.Rb*b); const xi42=x42/h0;
  const x=xi42<=lim.xiR?x42:(N*1000+s.Rs*As*(1+lim.xiR)/(1-lim.xiR)-s.Rsc*Asp)/(c.Rb*b+2*s.Rs*As/(h0*(1-lim.xiR)));
  const rhsNmm=c.Rb*b*x*(h0-0.5*x)+s.Rsc*Asp*(h0-ap); const lhsNmm=N*1000*e; const xi=x/h0;
  return {ok:true,workflow:'5574-eccentric',inputs:{grade,steel,b,h,h0,As,Asp,ap,N,M,L,L0,e0:eStatic,ML,ML1,I,Is,determinate},materials:{concreteGrade:c.grade,steelGrade:s.grade,Rb:c.Rb,Rbt:c.Rbt,Eb:c.Eb,Rs:s.Rs,Rsc:s.Rsc,Rsw:s.Rsw,Es:TCVN5574_ES_BAR_MPA},eaMm:ea,e0Mm:e0,eta,NcrKn:Ncr,D,kb,phiL,deltaE,eMm:e,xMm:x,xi,xiR:lim.xiR,lhsKnM:lhsNmm/1e6,rhsKnM:rhsNmm/1e6,pass:lhsNmm<=rhsNmm,
    steps:[`8.1.2.2.4: ea=max(L/600,h/30,10)=${ea.toFixed(3)} mm; ${determinate?'hệ tĩnh định: e0=e_tĩnh+ea':'hệ siêu tĩnh: e0=max(e_tĩnh,ea)'}=${e0.toFixed(3)} mm.`,L0!=null&&Ncr!=null?`CT (44)-(48): Ncr=${Ncr.toFixed(3)} kN; η=${eta.toFixed(4)}.`:'Không có đủ L0, I, Is → η=1; nếu L0/i>14 phải bổ sung để xét uốn dọc.',`CT (41): e=e0·η+(h0−a')/2=${e.toFixed(3)} mm.`,`CT (${xi42<=lim.xiR?'42':'43'}): x=${x.toFixed(3)} mm; ξ=${xi.toFixed(4)}, ξR=${lim.xiR.toFixed(4)}.`,`CT (40): N·e=${(lhsNmm/1e6).toFixed(3)} kN.m; sức kháng=${(rhsNmm/1e6).toFixed(3)} kN.m → ${lhsNmm<=rhsNmm?'ĐẠT':'KHÔNG ĐẠT'}.`],
    provenance:['TCVN 5574:2018 · 8.1.2.2.4 · độ lệch tâm ngẫu nhiên · trang chuẩn 56-57 / PDF 54-55','TCVN 5574:2018 · 8.1.2.4.1 · CT (40)-(43) · trang chuẩn 58-59 / PDF 56-57','TCVN 5574:2018 · 8.1.2.4.2 · CT (44)-(48) · trang chuẩn 60-61 / PDF 58-59','TCVN 5574:2018 · 8.1.2.4.4 · L0 · trang chuẩn 61 / PDF 59',...c.sources,...s.sources]};
}

// ---- Pass 1B: shear, torsion, local compression, punching ----
export function calcShear5574(input={}){
  const grade=String(input.grade||'B30').toUpperCase(), steel=String(input.steel||'CB400-V').toUpperCase();
  const c=lookup5574Concrete(grade), s=lookup5574Steel(steel); if(!c||!s) return {ok:false,missing:['Cấp bê tông/thép Verified.']};
  const b=num(input.b), h0=num(input.h0), Q=num(input.Q), Asw=num(input.Asw??0), sw=num(input.sw), a=num(input.a);
  const missing=[]; if(!(b>0)) missing.push('b (mm)'); if(!(h0>0)) missing.push('h0 (mm)'); if(Q==null) missing.push('Q (kN)'); if(Asw>0 && !(sw>0)) missing.push('sw (mm)'); if(missing.length) return {ok:false,missing};
  const qsw=Asw>0?s.Rsw*Asw/sw:0; // N/mm
  const qswMin=0.25*c.Rbt*b;
  const shearSteelCounted=Asw>0 && qsw>=qswMin;
  const Qstrip=0.3*c.Rb*b*h0/1000; // CT88
  let Qb1=0.5*c.Rbt*b*h0/1000; // CT94
  let Qsw1=shearSteelCounted?qsw*h0/1000:0; // CT95
  if(a!=null && a>0 && a<2.5*h0) Qb1=Math.min(Qb1*(2.5*h0/a),2.5*c.Rbt*b*h0/1000);
  if(a!=null && a>0 && a<h0) Qsw1*=a/h0;
  const Qu=Qb1+Qsw1; const pass=Q<=Qstrip && Q<=Qu;
  return {ok:true,workflow:'5574-shear',inputs:{grade,steel,b,h0,Q,Asw,sw,a},materials:{Rb:c.Rb,Rbt:c.Rbt,Rsw:s.Rsw},qswNmm:qsw,qswMinNmm:qswMin,shearSteelCounted,QstripKn:Qstrip,Qb1Kn:Qb1,Qsw1Kn:Qsw1,QuKn:Qu,utilization:Math.max(Q/Qstrip,Q/Qu),pass,
    steps:[`CT (88): Q ≤ 0,3Rb·b·h0 = ${Qstrip.toFixed(3)} kN.`,`CT (92): qsw=Rsw·Asw/sw=${qsw.toFixed(3)} N/mm; CT (96) yêu cầu qsw≥${qswMin.toFixed(3)} N/mm → ${shearSteelCounted?'kể cốt đai':'không kể cốt đai trong nhánh bảo thủ'}.`,`CT (94): Qb,1=${Qb1.toFixed(3)} kN; CT (95): Qsw,1=${Qsw1.toFixed(3)} kN.`,`CT (93): Q=${Q.toFixed(3)} kN ≤ ${Qu.toFixed(3)} kN và CT (88) → ${pass?'ĐẠT':'KHÔNG ĐẠT'}.`],
    provenance:['TCVN 5574:2018 · 8.1.3.2 · CT (88) · trang chuẩn 69 / PDF 67','TCVN 5574:2018 · 8.1.3.3.1 · CT (89)-(98) · trang chuẩn 70-72 / PDF 68-70',...c.sources,...s.sources]};
}

export function calcTorsion5574(input={}){
  const grade=String(input.grade||'B30').toUpperCase(), steel=String(input.steel||'CB400-V').toUpperCase(); const c=lookup5574Concrete(grade), s=lookup5574Steel(steel); if(!c||!s) return {ok:false,missing:['Cấp bê tông/thép Verified.']};
  const b=num(input.b), h=num(input.h), T=num(input.T), Asw1=num(input.Asw1), sw=num(input.sw), As1=num(input.As1), Z1=num(input.Z1), Z2=num(input.Z2);
  const missing=[]; for(const [n,v] of [['b',b],['h',h],['T',T],['Asw1',Asw1],['sw',sw],['As1',As1],['Z1',Z1],['Z2',Z2]]) if(!(v>0)) missing.push(n); if(missing.length)return {ok:false,missing};
  const q=s.Rsw*Asw1/sw, delta=Z1/(2*Z2+Z1), ratio=q*Z1/(s.Rs*As1); const Tstrip=0.1*c.Rb*b*b*h/1e6; const Tsw=q*delta*Z1*Z2/1e6; const Ts=0.5*s.Rs*As1*Z2/1e6; const Tu=Tsw+Ts; const ratioPass=ratio>=0.5&&ratio<=1.5; const pass=ratioPass&&T<=Tstrip&&T<=Tu;
  return {ok:true,workflow:'5574-torsion',inputs:{grade,steel,b,h,T,Asw1,sw,As1,Z1,Z2},qsw1Nmm:q,delta,ratio,TstripKnM:Tstrip,Tsw1KnM:Tsw,Ts1KnM:Ts,TuKnM:Tu,pass,utilization:Math.max(T/Tstrip,T/Tu),ratioPass,
    steps:[`CT (102): Tstrip=0,1Rb·b²·h=${Tstrip.toFixed(3)} kN.m.`,`CT (107),(109): qsw,1=${q.toFixed(3)} N/mm; δ=${delta.toFixed(4)}; qsw,1·Z1/(Rs·As,1)=${ratio.toFixed(3)} ∈ [0,5;1,5] → ${ratioPass?'ĐẠT':'KHÔNG ĐẠT'}.`,`CT (112): Tsw,1=${Tsw.toFixed(3)} kN.m; CT (113): Ts,1=${Ts.toFixed(3)} kN.m.`,`CT (111): Tu=${Tu.toFixed(3)} kN.m; T=${T.toFixed(3)} → ${pass?'ĐẠT':'KHÔNG ĐẠT'}.`],
    provenance:['TCVN 5574:2018 · 8.1.4.2.1 · CT (102) · trang chuẩn 75 / PDF 73','TCVN 5574:2018 · 8.1.4.2.2 · CT (103)-(113) · trang chuẩn 75-77 / PDF 73-75',...c.sources,...s.sources]};
}

export function calcLocalCompression5574(input={}){
  const grade=String(input.grade||'B30').toUpperCase(); const c=lookup5574Concrete(grade); if(!c) return {ok:false,missing:['Cấp bê tông Verified.']};
  const N=num(input.N), AbLoc=num(input.AbLoc), AbMax=num(input.AbMax), psi=num(input.psi??1);
  const missing=[]; if(N==null)missing.push('N (kN)'); if(!(AbLoc>0))missing.push('Ab,loc (mm²)'); if(!(AbMax>=AbLoc))missing.push('Ab,max (mm²) ≥ Ab,loc'); if(![0.75,1].includes(psi))missing.push('ψ = 1,0 (đều) hoặc 0,75 (không đều)'); if(missing.length)return {ok:false,missing};
  const phi=Math.max(1,Math.min(2.5,0.8*Math.sqrt(AbMax/AbLoc))); const Rbloc=phi*c.Rb; const Nu=psi*Rbloc*AbLoc/1000; return {ok:true,workflow:'5574-local',inputs:{grade,N,AbLoc,AbMax,psi},phiB:phi,RbLoc:Rbloc,NuKn:Nu,utilization:N/Nu,pass:N<=Nu,
    steps:[`CT (118): φb=0,8√(Ab,max/Ab,loc)=${phi.toFixed(4)} (khóa 1,0…2,5).`,`CT (117): Rb,loc=φb·Rb=${Rbloc.toFixed(3)} MPa.`,`CT (116): Nu=ψ·Rb,loc·Ab,loc=${Nu.toFixed(3)} kN; N=${N.toFixed(3)} → ${N<=Nu?'ĐẠT':'KHÔNG ĐẠT'}.`],provenance:['TCVN 5574:2018 · 8.1.5.2 · CT (116)-(118) · trang chuẩn 80 / PDF 78',...c.sources]};
}

export function calcPunching5574(input={}){
  const grade=String(input.grade||'B30').toUpperCase(), steel=String(input.steel||'CB400-V').toUpperCase(); const c=lookup5574Concrete(grade), s=lookup5574Steel(steel); if(!c||!s)return {ok:false,missing:['Cấp bê tông/thép Verified.']};
  const F=num(input.F), u=num(input.u), h0=num(input.h0), Asw=num(input.Asw??0), sw=num(input.sw);
  const missing=[]; if(F==null)missing.push('F (kN)'); if(!(u>0))missing.push('u chu vi tính toán (mm)'); if(!(h0>0))missing.push('h0 (mm)'); if(Asw>0&&!(sw>0))missing.push('sw (mm)'); if(missing.length)return {ok:false,missing};
  const Ab=u*h0, Fbu=c.Rbt*Ab/1000; const q=Asw>0?s.Rsw*Asw/sw:0; const rawFsw=0.8*q*u/1000; const counted=rawFsw>=0.25*Fbu; const Fsw=counted?Math.min(rawFsw,Fbu):0; const Fu=Fbu+Fsw; return {ok:true,workflow:'5574-punch',inputs:{grade,steel,F,u,h0,Asw,sw},AbMm2:Ab,FbuKn:Fbu,qswNmm:q,FswRawKn:rawFsw,FswKn:Fsw,transverseCounted:counted,FuKn:Fu,utilization:F/Fu,pass:F<=Fu,
    steps:[`CT (125): Ab=u·h0=${Ab.toFixed(1)} mm².`,`CT (124): Fb,u=Rbt·Ab=${Fbu.toFixed(3)} kN.`,Asw>0?`CT (128),(127): qsw=${q.toFixed(3)} N/mm; Fsw,u(raw)=${rawFsw.toFixed(3)} kN; yêu cầu ≥0,25Fb,u → ${counted?'kể':'không kể'}; tổng bị giới hạn ≤2Fb,u.`:'Không có cốt thép ngang chọc thủng: Fsw,u=0.',`CT (123)/(126): Fu=${Fu.toFixed(3)} kN; F=${F.toFixed(3)} → ${F<=Fu?'ĐẠT':'KHÔNG ĐẠT'}.`],
    provenance:['TCVN 5574:2018 · 8.1.6.2.1 · CT (123)-(125) · trang chuẩn 86-87 / PDF 84-85','TCVN 5574:2018 · 8.1.6.2.2 · CT (126)-(128) · trang chuẩn 88 / PDF 86',...c.sources,...s.sources]};
}

// ---- Pass 2: serviceability (crack, deformation) + prestress losses ----
export const CREEP_5574_TABLE11={
  '>75':{B10:2.8,B15:2.4,B20:2.0,B25:1.8,B30:1.6,B35:1.5,B40:1.4,B45:1.3,B50:1.2,B55:1.1,B60:1.0},
  '40-75':{B10:3.9,B15:3.4,B20:2.8,B25:2.5,B30:2.3,B35:2.1,B40:1.9,B45:1.8,B50:1.6,B55:1.5,B60:1.4},
  '<40':{B10:5.6,B15:4.8,B20:4.0,B25:3.6,B30:3.2,B35:3.0,B40:2.8,B45:2.6,B50:2.4,B55:2.2,B60:2.0}
};
export function creepPhi5574(grade='B30',humidity=60){
  const g=Number(String(grade).toUpperCase().replace('B','').replace(',','.'));
  const band=humidity>75?'>75':(humidity>=40?'40-75':'<40');
  const key=g>=60?'B60':`B${g}`;
  return CREEP_5574_TABLE11[band]?.[key]??null;
}

export function calcCrackFlexure5574(input={}){
  const grade=String(input.grade||'B30').toUpperCase(); const steel=String(input.steel||'CB400-V').toUpperCase();
  const c=lookup5574Concrete(grade), s=lookup5574Steel(steel), cs=lookup5574ConcreteSls(grade), ss=lookup5574SteelSls(steel); if(!c||!s||!cs||!ss) return {ok:false,missing:['Cấp bê tông/thép Verified.']};
  const b=num(input.b),h=num(input.h),h0=num(input.h0),As=num(input.As),Asp=num(input.Asp??0),a=num(input.a),ap=num(input.ap??0),M=num(input.M),ds=num(input.ds),Abt=num(input.Abt),RbtSer=num(input.RbtSer)??cs.RbtSer,RsSer=num(input.RsSer)??ss.RsSer;
  const duration=String(input.duration||'short').toLowerCase(), ribbed=input.ribbed!==false, forceType=String(input.forceType||'flexure').toLowerCase();
  const missing=[]; for(const [n,v] of [['b',b],['h',h],['h0',h0],['As',As],['a',a],['M',M],['ds',ds],['Abt',Abt],['Rbt,ser',RbtSer]]) if(!(v>0)) missing.push(n); if(missing.length)return {ok:false,missing};
  const alpha=TCVN5574_ES_BAR_MPA/c.Eb; const A=b*h; const Ared=A+alpha*(As+Asp);
  const ys=h-a, ysp=ap; const ybar=(A*h/2+alpha*As*ys+alpha*Asp*ysp)/Ared; const yt=h-ybar;
  const Ic=b*h**3/12+A*(h/2-ybar)**2; const Is=As*(ys-ybar)**2; const Isp=Asp*(ysp-ybar)**2; const Ired=Ic+alpha*(Is+Isp);
  const Wred=Ired/yt, Wpl=1.3*Wred, Mcrc=Wpl*RbtSer/1e6; // N=0 selected branch; Rbt,ser is explicit SLS input until its table is structured.
  const zs=0.8*h0; const sigmaS=(M*1e6)/(zs*As);
  const LsRaw=0.5*Abt/As*ds; const Ls=Math.max(Math.max(10*ds,100),Math.min(LsRaw,Math.min(40*ds,400)));
  const psi=Math.max(0,Math.min(1,1-0.8*Mcrc/M)); const phi1=duration.includes('long')?1.4:1.0; const phi2=ribbed?0.5:0.8; const phi3=forceType.includes('tension')?1.2:1.0;
  const acrc=phi1*phi2*phi3*psi*sigmaS/TCVN5574_ES_BAR_MPA*Ls; const crackLimit=lookup5574CrackLimit({steel,duration,watertight:Boolean(input.watertight),group:input.crackGroup||''}); const acrcU=crackLimit?.acrcUMm??null;
  return {ok:true,workflow:'5574-crack',inputs:{grade,steel,b,h,h0,As,Asp,a,ap,M,ds,Abt,RbtSer,RsSer,duration,ribbed,forceType},alpha,AredMm2:Ared,ybarMm:ybar,IredMm4:Ired,WredMm3:Wred,McrcKnM:Mcrc,zsMm:zs,sigmaSMpa:sigmaS,LsMm:Ls,psiS:psi,phi1,phi2,phi3,acrcMm:acrc,acrcUMm:acrcU,crackPass:acrcU!=null?acrc<=acrcU:null,crackLimit,cracked:M>Mcrc,
    steps:[`CT (162)-(164): tiết diện quy đổi → Ared=${Ared.toFixed(1)} mm²; Ired=${Ired.toFixed(1)} mm⁴; Wred=${Wred.toFixed(1)} mm³.`,`CT (159),(158), N=0: Wpl=1,3Wred; Mcrc=${Mcrc.toFixed(3)} kN.m.`,`Cho phép 8.2.2.3.2: zs=0,8h0=${zs.toFixed(1)} mm; σs≈M/(zsAs)=${sigmaS.toFixed(3)} MPa.`,`CT (174): Ls=${Ls.toFixed(2)} mm sau khi áp giới hạn 10ds/100 mm và 40ds/400 mm.`,`CT (176): ψs=${psi.toFixed(4)}. CT (166): acrc=${acrc.toFixed(4)} mm.`],
    provenance:['TCVN 5574:2018 · 8.2.2.2.4-5 · CT (158)-(164) · trang chuẩn 99-100 / PDF 97-98','TCVN 5574:2018 · 8.2.2.3.1-4 · CT (166),(170),(174),(176) · trang chuẩn 101-105 / PDF 99-103',...c.sources,...s.sources],warnings:[...(RsSer>0&&sigmaS>RsSer?[`σs=${sigmaS.toFixed(2)} MPa vượt Rs,ser=${RsSer.toFixed(2)} MPa đã nhập; cần kiểm lại miền áp dụng.`]:[]),`Bảng 6/12 đã số hóa: Rbt,ser=${RbtSer} MPa; Rs,ser=${RsSer} MPa. ${acrcU!=null?`Bảng 17: acrc,u=${acrcU} mm.`:'Chưa xác định nhóm Bảng 17.'}`]};
}

export function calcDeflectionSimple5574(input={}){
  const grade=String(input.grade||'B30').toUpperCase(); const c=lookup5574Concrete(grade); if(!c)return {ok:false,missing:['Cấp bê tông Verified.']};
  const L=num(input.L),b=num(input.b),h=num(input.h),Mmax=num(input.Mmax),sCoef=num(input.sCoef??5/48),humidity=num(input.humidity??60); const longTerm=Boolean(input.longTerm);
  const missing=[]; for(const [n,v] of [['L',L],['b',b],['h',h],['Mmax',Mmax]]) if(!(v>0))missing.push(n); if(missing.length)return {ok:false,missing};
  const I=b*h**3/12; const phi=longTerm?creepPhi5574(grade,humidity):0; if(longTerm&&phi==null)return {ok:false,missing:['Bảng 11 hiện số hóa cho bê tông nặng B10-B60/B100 theo các dải độ ẩm; kiểm cấp bê tông.']};
  const Eb1=longTerm?c.Eb/(1+phi):c.Eb; const curvature=Mmax*1e6/(Eb1*I); const f=sCoef*(L*1000)**2*curvature;
  return {ok:true,workflow:'5574-deformation',inputs:{grade,L,b,h,Mmax,sCoef,humidity,longTerm},IredMm4:I,phiBcr:phi,Eb1Mpa:Eb1,curvaturePerMm:curvature,deflectionMm:f,
    steps:[`CT (188): D=Eb1·Ired. Nhánh không nứt tiết diện chữ nhật: I=${I.toFixed(1)} mm⁴.`,longTerm?`Bảng 11: φb,cr=${phi}; Eb1=Eb/(1+φ)=${Eb1.toFixed(1)} MPa.`:`Tải ngắn hạn: Eb1=Eb=${Eb1.toFixed(1)} MPa.`,`CT (187): 1/r=M/D=${curvature.toExponential(5)} 1/mm.`,`CT (180): f=s·L²·(1/r)=${f.toFixed(3)} mm.`],
    provenance:['TCVN 5574:2018 · 8.2.3.2 · CT (177)-(180) · trang chuẩn 105-107 / PDF 103-105','TCVN 5574:2018 · 8.2.3.3 · CT (187)-(189) · trang chuẩn 109 / PDF 107','TCVN 5574:2018 · Bảng 11 · trang chuẩn 40 / PDF 38',...c.sources],warnings:['VERIFIED cho nhánh cấu kiện không nứt, tiết diện không đổi, độ võng chủ yếu do uốn. Nếu L/h<10 phải cộng biến dạng trượt CT (181)-(184); nếu có vết nứt phải dùng độ cứng/độ cong nhánh có nứt.']};
}

export function calcPrestressLosses5574(input={}){
  const sigmaSp=num(input.sigmaSp),Rsn=num(input.Rsn),Es=num(input.Es??TCVN5574_ES_BAR_MPA),method=String(input.method||'mechanical').toLowerCase(),steelType=String(input.steelType||'bar').toLowerCase();
  const dt=num(input.deltaT??0),n=num(input.n??1),dLForm=num(input.dLForm??0),LForm=num(input.LForm),dLAnchor=num(input.dLAnchor??2),LAnchor=num(input.LAnchor),epsShrink=num(input.epsShrink??0),Asp=num(input.Asp); const frictionResult=input.friction?calcPrestressFriction5574({sigmaSp,...input.friction,steelType}):null; const creepResult=input.creep?calcPrestressCreep5574(input.creep):null; const creepLoss=num(input.creepLoss)??(creepResult?.ok?creepResult.lossMpa:0);
  const missing=[]; if(!(sigmaSp>0))missing.push('σsp (MPa)'); if(!(Rsn>0))missing.push('Rs,n (MPa)'); if(!(Asp>0))missing.push('Asp (mm²)'); if(missing.length)return {ok:false,missing};
  const cold=steelType.includes('wire')||steelType.includes('strand')||steelType.includes('cable'); const limit=(cold?0.8:0.9)*Rsn; if(sigmaSp>limit)return {ok:false,missing:[`σsp=${sigmaSp} MPa vượt giới hạn 9.1.1 = ${limit.toFixed(1)} MPa.`]};
  let l1=0; if(cold) l1=method.includes('thermal')?0.05*sigmaSp:Math.max(0,(0.22*sigmaSp/Rsn-0.1)*sigmaSp); else l1=method.includes('thermal')?0.03*sigmaSp:Math.max(0,0.1*sigmaSp-20);
  const l2=dt?1.25*dt:0; let l3=0; if(!method.includes('thermal')&&n>1){ if(LForm>0&&dLForm>=0) l3=(n-1)/(2*n)*(dLForm/LForm)*Es; else l3=30; }
  let l4=0; if(!method.includes('thermal')&&LAnchor>0)l4=dLAnchor/LAnchor*Es;
  const l5=Math.max(0,epsShrink*Es); const l6=Math.max(0,creepLoss); const l7=frictionResult?.ok?frictionResult.lossMpa:0; const first=l1+l2+l3+l4+l7; let total=first+l5+l6; if(total<100) total=100; const sigma1=Math.max(0,sigmaSp-first),sigma2=Math.max(0,sigmaSp-total); const P1=Asp*sigma1/1000, P2=Asp*sigma2/1000;
  return {ok:true,workflow:'5574-prestress',inputs:{sigmaSp,Rsn,Es,method,steelType,deltaT:dt,n,dLForm,LForm,dLAnchor,LAnchor,epsShrink,creepLoss,Asp,friction:input.friction||null,creep:input.creep||null},limitMpa:limit,lossesMpa:{relaxation:l1,temperature:l2,form:l3,anchor:l4,friction:l7,shrinkage:l5,creep:l6,first,total},frictionResult,creepResult,sigmaSp1Mpa:sigma1,sigmaSp2Mpa:sigma2,P1Kn:P1,P2Kn:P2,
    steps:[`9.1.1: σsp≤${cold?'0,8':'0,9'}Rs,n=${limit.toFixed(1)} MPa → đạt.`,`CT (207)-(210): Δσsp1=${l1.toFixed(2)} MPa. CT (211): Δσsp2=${l2.toFixed(2)} MPa.`,`CT (212): Δσsp3=${l3.toFixed(2)} MPa. CT (213): Δσsp4=${l4.toFixed(2)} MPa. CT (214): Δσsp7=${l7.toFixed(2)} MPa.`,`CT (215): Δσsp5=${l5.toFixed(2)} MPa. CT (216): Δσsp6=${l6.toFixed(2)} MPa (nhập từ module từ biến chi tiết nếu dùng).`,`CT (217),(219): hao tổn thứ nhất=${first.toFixed(2)} MPa; tổng hao tổn dùng tính=${total.toFixed(2)} MPa (không nhỏ hơn 100 MPa cho cốt chịu lực chính).`,`CT (218),(220): P(1)=${P1.toFixed(2)} kN; P(2)=${P2.toFixed(2)} kN.`],
    provenance:['TCVN 5574:2018 · 9.1.1-9.1.10 · CT (207)-(220) · trang chuẩn 116-120 / PDF 114-118'],warnings:[...(input.creep&&!creepResult?.ok?['Thiếu input CT (216).']:[]),...(input.friction&&!frictionResult?.ok?['Thiếu input CT (214)/Bảng 18.']:[])]};
}


export function epsB1RedLong5574(grade='B30',humidity=60){
  let eps=humidity>75?0.0024:(humidity>=40?0.0028:0.0034);
  const g=Number(String(grade).toUpperCase().replace('B','').replace(',','.')); if(Number.isFinite(g)&&g>=70) eps*=((270-g)/210); return eps;
}
function crackGeomRect5574({b,h,h0,As,a,grade='B30',M,RbtSer=null}={}){ const c=lookup5574Concrete(grade),cs=lookup5574ConcreteSls(grade); if(!c||!cs)return null; RbtSer=num(RbtSer)??cs.RbtSer; const alpha=TCVN5574_ES_BAR_MPA/c.Eb,A=b*h,ys=h-a,Ared=A+alpha*As,ybar=(A*h/2+alpha*As*ys)/Ared,Ic=b*h**3/12+A*(h/2-ybar)**2,Is=As*(ys-ybar)**2,Ired=Ic+alpha*Is,Wred=Ired/(h-ybar),Mcrc=1.3*Wred*RbtSer/1e6,psi=Math.max(0,Math.min(1,1-0.8*Mcrc/M)); return {c,cs,Ared,Ired,Wred,Mcrc,psi}; }
export function calcCrackedCurvatureRect5574(input={}){ const grade=String(input.grade||'B30').toUpperCase(),steel=String(input.steel||'CB400-V').toUpperCase(),c=lookup5574Concrete(grade),cs=lookup5574ConcreteSls(grade); if(!c||!cs)return {ok:false,missing:['Cấp bê tông Verified.']}; const b=num(input.b),h=num(input.h),h0=num(input.h0),As=num(input.As),a=num(input.a),M=num(input.M),humidity=num(input.humidity??60),longTerm=Boolean(input.longTerm),missing=[]; for(const [n,v] of [['b',b],['h',h],['h0',h0],['As',As],['a',a],['M',M]])if(!(v>0))missing.push(n); if(missing.length)return {ok:false,missing}; if(num(input.Asp??0)>0)return {ok:false,missing:["Nhánh có nứt Verified hiện áp dụng tiết diện chữ nhật chỉ có cốt kéo As; As' phải bằng 0."]}; const geom=crackGeomRect5574({b,h,h0,As,a,grade,M,RbtSer:input.RbtSer}); const eps=longTerm?epsB1RedLong5574(grade,humidity):0.0015,EbRed=cs.RbSer/eps,EsRed=TCVN5574_ES_BAR_MPA/Math.max(geom.psi,1e-9),alpha1=TCVN5574_ES_BAR_MPA/EbRed,alpha2=EsRed/EbRed,mu=As/(b*h0),p=mu*alpha2,xm=h0*(Math.sqrt(p*p+2*p)-p),z=h0-xm/3,D=EsRed*As*z*(h0-xm),curvature=M*1e6/D; return {ok:true,workflow:'5574-deformation-cracked-curvature',inputs:{grade,steel,b,h,h0,As,a,M,humidity,longTerm},RbSerMpa:cs.RbSer,RbtSerMpa:cs.RbtSer,epsB1Red:eps,EbRedMpa:EbRed,psiS:geom.psi,alphaS1:alpha1,alphaS2:alpha2,muS:mu,xmMm:xm,zMm:z,Dnmm2:D,curvaturePerMm:curvature,McrcKnM:geom.Mcrc,steps:[`Bảng 6: Rb,ser=${cs.RbSer} MPa; Rbt,ser=${cs.RbtSer} MPa; εb1,red=${eps}.`,`CT (176),(204): ψs=${geom.psi.toFixed(4)}; Es,red=${EsRed.toFixed(1)} MPa.`,`CT (195),(201): xm=${xm.toFixed(3)} mm; z=${z.toFixed(3)} mm.`,`CT (200),(187): D=${D.toExponential(5)} N.mm²; 1/r=${curvature.toExponential(6)} 1/mm.`],provenance:['TCVN 5574:2018 · Bảng 6 · trang chuẩn 34 / PDF 32','TCVN 5574:2018 · Bảng 9 · trang chuẩn 36 / PDF 34','TCVN 5574:2018 · 8.2.3.3.5-8 · CT (193)-(204) · trang chuẩn 110-114 / PDF 108-112']}; }
export function calcDeflectionCracked5574(input={}){ const MTotal=num(input.MTotal??input.Mmax),MLong=num(input.MLong??0),L=num(input.L),sCoef=num(input.sCoef??5/48),missing=[]; if(!(MTotal>0))missing.push('MTotal/Mmax (kN.m)'); if(!(L>0))missing.push('L (m)'); if(missing.length)return {ok:false,missing}; const c1=calcCrackedCurvatureRect5574({...input,M:MTotal,longTerm:false}); if(!c1.ok)return c1; let curvature=c1.curvaturePerMm,c2=null,c3=null; if(MLong>0){ c2=calcCrackedCurvatureRect5574({...input,M:MLong,longTerm:false}); c3=calcCrackedCurvatureRect5574({...input,M:MLong,longTerm:true}); if(!c2.ok||!c3.ok)return !c2.ok?c2:c3; curvature=c1.curvaturePerMm-c2.curvaturePerMm+c3.curvaturePerMm; } const f=sCoef*(L*1000)**2*curvature; return {ok:true,workflow:'5574-deformation-cracked',inputs:{...input,MTotal,MLong,L,sCoef},curvatureTotalPerMm:curvature,deflectionMm:f,components:{shortTotal:c1,shortLong:c2,longLong:c3},steps:[`CT (186): tổng độ cong=${curvature.toExponential(6)} 1/mm.`,`CT (180): f=${f.toFixed(3)} mm.`],provenance:['TCVN 5574:2018 · CT (186) · trang chuẩn 109 / PDF 107','TCVN 5574:2018 · CT (180) · trang chuẩn 107 / PDF 105',...(c1.provenance||[])]}; }
export function calcShearDeflectionUdl5574(input={}){
  const grade=String(input.grade||'B30').toUpperCase(),c=lookup5574Concrete(grade),cs=lookup5574ConcreteSls(grade);
  if(!c||!cs)return {ok:false,missing:['Cấp bê tông Verified.']};
  const L=num(input.L),b=num(input.b),h0=num(input.h0),w=num(input.wKnM),humidity=num(input.humidity??60),longTerm=Boolean(input.longTerm),missing=[];
  let phiCrc=num(input.phiCrc); const crackState=String(input.crackState||'').toLowerCase();
  for(const [n,v] of [['L',L],['b',b],['h0',h0],['w',w]])if(!(v>0))missing.push(n); if(missing.length)return {ok:false,missing};
  const G=0.4*c.Eb,phi=longTerm?1+creepPhi5574(grade,humidity):1,Qmax=w*L/2,diagonalCrack=Qmax*1000>0.5*cs.RbtSer*b*h0;
  if(phiCrc==null){
    if(/both|normal|thang|thẳng/.test(crackState)){
      const Mx=num(input.MxKnM),curv=num(input.curvaturePerMm),Ired=num(input.Ired);
      if(!(Mx>0)||!(curv>0)||!(Ired>0)) return {ok:false,missing:['Mx (kN.m), (1/r)x (1/mm), Ired (mm4) để tính φcrc theo CT (183).'],warnings:['Nhánh có vết nứt thẳng góc/đồng thời thẳng góc + xiên không được tự gán φcrc.']};
      phiCrc=3*c.Eb*Ired/(Mx*1e6)*curv;
    } else if(/diagonal|xien|xiên/.test(crackState)) phiCrc=4;
    else if(diagonalCrack) return {ok:false,missing:['Trạng thái vết nứt: diagonal hoặc both/normal.'],warnings:['CT (184) cho thấy có thể hình thành vết nứt xiên; cần xác định có đồng thời vết nứt thẳng góc hay không trước khi chọn φcrc.']};
    else phiCrc=1;
  }
  const Lmm=L*1000,integral=w*Lmm**2/8,fq=1.2*phi*phiCrc/(G*b*h0)*integral;
  return {ok:true,workflow:'5574-deformation-shear',inputs:{grade,L,b,h0,wKnM:w,humidity,longTerm,phiCrc,crackState},Gmpa:G,phiB:phi,phiCrc,diagonalCrack,QmaxKn:Qmax,shearDeflectionMm:fq,
    steps:[`CT (184): Qmax=${Qmax.toFixed(3)} kN ${diagonalCrack?'>':'≤'} 0,5Rbt,ser·b·h0.`,`CT (182)-(183): G=0,4Eb=${G.toFixed(1)} MPa; φb=${phi.toFixed(3)}; φcrc=${phiCrc.toFixed(3)}.`,`CT (181), dầm tựa đơn tải đều tại giữa nhịp: fq=${fq.toFixed(3)} mm.`],
    provenance:['TCVN 5574:2018 · CT (181)-(184) · trang chuẩn 107-108 / PDF 105-106']};
}

export function calcPrestressFriction5574(input={}){ const sigmaSp=num(input.sigmaSp),x=num(input.xM),theta=num(input.thetaRad),surface=String(input.surface||'metal-duct'),steelType=String(input.steelType||'cable'),row=lookup5574PrestressFriction(surface,steelType),missing=[]; if(!(sigmaSp>0))missing.push('σsp'); if(!(x>=0))missing.push('χ (m)'); if(!(theta>=0))missing.push('θ (rad)'); if(!row)missing.push('Bảng 18'); if(missing.length)return {ok:false,missing}; const exponent=row.omega*x+row.delta*theta,loss=(1-Math.exp(-exponent))*sigmaSp; return {ok:true,workflow:'5574-prestress-friction',inputs:{sigmaSp,xM:x,thetaRad:theta,surface,steelType},omega:row.omega,delta:row.delta,lossMpa:loss,remainingMpa:sigmaSp-loss,steps:[`Bảng 18: ω=${row.omega}; δ=${row.delta}.`,`CT (214): Δσsp7=${loss.toFixed(3)} MPa.`],provenance:['TCVN 5574:2018 · 9.1.7 · CT (214), Bảng 18 · trang chuẩn 117 / PDF 115']}; }
export function calcPrestressCreep5574(input={}){ const grade=String(input.grade||'B30').toUpperCase(),c=lookup5574Concrete(grade); if(!c)return {ok:false,missing:['Cấp bê tông Verified.']}; const sigmaBpj=num(input.sigmaBpj),ysj=num(input.ysj),Ared=num(input.Ared),Ired=num(input.Ired),A=num(input.A),Aspj=num(input.Aspj),humidity=num(input.humidity??60),Es=num(input.Es??TCVN5574_ES_BAR_MPA),heat=Boolean(input.heatTreated),missing=[]; for(const [n,v] of [['σbpj',sigmaBpj],['ysj',ysj],['Ared',Ared],['Ired',Ired],['A',A],['Aspj',Aspj]])if(v==null||(n!=='σbpj'&&n!=='ysj'&&!(v>0)))missing.push(n); if(missing.length)return {ok:false,missing}; const phi=creepPhi5574(grade,humidity); if(phi==null)return {ok:false,missing:['φb,cr']}; if(sigmaBpj<0)return {ok:true,workflow:'5574-prestress-creep',lossMpa:0,shrinkageMustBeZero:true,steps:['9.1.9: σbpj<0 → Δσsp6=0 và Δσsp5=0.'],provenance:['TCVN 5574:2018 · CT (216) · trang chuẩn 118 / PDF 116']}; const alpha=Es/c.Eb,mu=Aspj/A,geom=1+ysj**2*Ared/Ired,denom=1+alpha*mu*geom*(1+0.8*phi); let loss=0.8*alpha*phi*sigmaBpj/denom; if(heat)loss*=0.85; return {ok:true,workflow:'5574-prestress-creep',inputs:{grade,sigmaBpj,ysj,Ared,Ired,A,Aspj,humidity,Es,heatTreated:heat},phiBcr:phi,alpha,muSpj:mu,geometryFactor:geom,denominator:denom,lossMpa:loss,steps:[`Bảng 11: φb,cr=${phi}; α=${alpha.toFixed(4)}; μspj=${mu.toFixed(6)}.`,`CT (216): Δσsp6=${loss.toFixed(3)} MPa.`],provenance:['TCVN 5574:2018 · 9.1.9 · CT (216) · trang chuẩn 118 / PDF 116','TCVN 5574:2018 · Bảng 11 · trang chuẩn 40 / PDF 38']}; }


// ---- Pass 3: detailing / annexes ----
// Source: TCVN 5574:2018 user PDF, 10.3.5–10.3.6 and Annexes G/H.
export const TCVN5574_ANCHORAGE_ETA1 = Object.freeze({
  plainBar:1.5,
  coldRibbed:2.0,
  hotRibbed:2.5,
  prestressColdRibbed:1.8,
  strand7PlainOr19:2.2,
  strand7Ribbed:2.4,
  prestressHotOrThermo:2.5,
});

export function anchorageEta25574({barType='hotRibbed',ds,prestressed=false}={}){
  const d=num(ds); if(!(d>0)) return null;
  if(prestressed) return 1.0;
  return d<=32?1.0:0.9;
}

export function calcAnchorage5574(input={}){
  const grade=String(input.grade||'B30').toUpperCase(), steel=String(input.steel||'CB400-V').toUpperCase();
  const c=lookup5574Concrete(grade), st=lookup5574Steel(steel);
  if(!c||!st) return {ok:false,missing:['Cấp bê tông/thép phải có trong bảng Verified.']};
  const ds=num(input.ds), As=num(input.As), AsCal=num(input.AsCal??input.As), AsEf=num(input.AsEf??input.As), alpha=num(input.alpha), Ls=num(input.Ls);
  const prestressed=Boolean(input.prestressed), barType=String(input.barType||'hotRibbed');
  const eta1=num(input.eta1)??TCVN5574_ANCHORAGE_ETA1[barType]; const eta2=num(input.eta2)??anchorageEta25574({barType,ds,prestressed});
  const missing=[]; if(!(ds>0)) missing.push('ds (mm)'); if(!(As>0)) missing.push('As (mm²)'); if(!(AsCal>0)) missing.push('As,cal (mm²)'); if(!(AsEf>0)) missing.push('As,ef (mm²)'); if(!(eta1>0)) missing.push('η1 / loại bề mặt cốt thép'); if(!(eta2>0)) missing.push('η2'); if(!(alpha>0)) missing.push('α theo 10.3.5.5 (phải có căn cứ cấu tạo/trạng thái ứng suất)');
  if(missing.length) return {ok:false,missing};
  const us=Math.PI*ds; // chu vi thanh tròn theo đường kính danh nghĩa
  const Rbond=eta1*eta2*c.Rbt; // CT256
  const L0an=st.Rs*As/(Rbond*us); // CT255
  const raw=alpha*L0an*AsCal/AsEf; // CT257
  const minimum=Math.max(15*ds,200,prestressed?0:0.3*L0an);
  const Lan=Math.max(raw,minimum);
  const Ns=Ls!=null&&Ls>=0?Math.min(st.Rs*As,st.Rs*As*Ls/Lan):null; // CT258
  return {ok:true,workflow:'5574-anchorage',inputs:{grade,steel,ds,As,AsCal,AsEf,alpha,Ls,prestressed,barType,eta1,eta2},materials:{Rb:c.Rb,Rbt:c.Rbt,Eb:c.Eb,Rs:st.Rs,Es:TCVN5574_ES_BAR_MPA},usMm:us,RbondMpa:Rbond,L0anMm:L0an,LanRawMm:raw,LanMinMm:minimum,LanMm:Lan,NsN:Ns,NsKn:Ns==null?null:Ns/1000,
    steps:[`CT (256): Rbond=η1·η2·Rbt=${eta1}×${eta2}×${c.Rbt}=${Rbond.toFixed(3)} MPa.`,`CT (255): L0,an=Rs·As/(Rbond·us)=${L0an.toFixed(1)} mm.`,`CT (257): Lan,calc=α·L0,an·As,cal/As,ef=${raw.toFixed(1)} mm.`,`10.3.5.5: Lan không nhỏ hơn max(15ds; 200 mm${prestressed?'':'; 0,3L0,an'})=${minimum.toFixed(1)} mm → Lan=${Lan.toFixed(1)} mm.`,Ns==null?'CT (258): nhập Ls nếu cần xác định lực Ns thanh neo truyền được.':`CT (258): Ns=min(RsAs; RsAs·Ls/Lan)=${(Ns/1000).toFixed(2)} kN.`],
    provenance:['TCVN 5574:2018 · 10.3.5.4 · CT (255)-(256) · trang chuẩn 139-140 / PDF 137-138','TCVN 5574:2018 · 10.3.5.5 · CT (257) + chiều dài tối thiểu · trang chuẩn 140 / PDF 138','TCVN 5574:2018 · 10.3.5.6 · CT (258) · trang chuẩn 141 / PDF 139',...c.sources,...st.sources],
    warnings:[alpha==null?'α không được suy đoán: workflow chỉ chạy khi người dùng/Code Pack cung cấp α có provenance.':null].filter(Boolean)};
}

export function calcLapSplice5574(input={}){
  const grade=String(input.grade||'B30').toUpperCase(), steel=String(input.steel||'CB400-V').toUpperCase();
  const c=lookup5574Concrete(grade), st=lookup5574Steel(steel); if(!c||!st) return {ok:false,missing:['Cấp bê tông/thép Verified.']};
  const ds=num(input.ds), As=num(input.As), AsCal=num(input.AsCal??input.As), AsEf=num(input.AsEf??input.As), stress=String(input.stress||'tension').toLowerCase(), barType=String(input.barType||'hotRibbed');
  if(ds>40) return {ok:false,missing:['Mối nối chồng theo 10.3.6.2 chỉ dùng cho thanh có đường kính không lớn hơn 40 mm.']};
  let alpha=num(input.alpha); const conventional=Boolean(input.conventional??true); if(alpha==null&&conventional) alpha=/comp|nen|nén/.test(stress)?0.9:1.2;
  const eta1=num(input.eta1)??TCVN5574_ANCHORAGE_ETA1[barType], eta2=num(input.eta2)??anchorageEta25574({barType,ds,prestressed:false});
  const missing=[]; if(!(ds>0))missing.push('ds (mm)'); if(!(As>0))missing.push('As (mm²)'); if(!(AsCal>0))missing.push('As,cal'); if(!(AsEf>0))missing.push('As,ef'); if(!(alpha>0))missing.push('α nối chồng có provenance'); if(!(eta1>0)||!(eta2>0))missing.push('η1/η2'); if(missing.length)return {ok:false,missing};
  const us=Math.PI*ds,Rbond=eta1*eta2*c.Rbt,L0an=st.Rs*As/(Rbond*us),Llap=alpha*L0an*AsCal/AsEf;
  return {ok:true,workflow:'5574-lap-splice',inputs:{grade,steel,ds,As,AsCal,AsEf,stress,barType,alpha,eta1,eta2,conventional},RbondMpa:Rbond,L0anMm:L0an,LlapMm:Llap,
    steps:[`CT (255)-(256): Rbond=${Rbond.toFixed(3)} MPa; L0,an=${L0an.toFixed(1)} mm.`,`CT (259): Llap=α·L0,an·As,cal/As,ef=${Llap.toFixed(1)} mm.`,conventional?`Trường hợp nối quy ước 10.3.6.2: α=${alpha} (${stress.includes('comp')?'chịu nén':'chịu kéo'}).`:'α lấy theo input có provenance.'],
    provenance:['TCVN 5574:2018 · 10.3.6.2 · CT (259) · trang chuẩn 141 / PDF 139','TCVN 5574:2018 · 10.3.5.4 · CT (255)-(256) · trang chuẩn 139-140 / PDF 137-138',...c.sources,...st.sources]};
}

export function calcConcreteShearKey5574(input={}){
  const grade=String(input.grade||'B30').toUpperCase(),c=lookup5574Concrete(grade); if(!c)return {ok:false,missing:['Cấp bê tông Verified.']};
  const Q=num(input.Q),Lk=num(input.Lk),nk=num(input.nk),N=num(input.N??0),missing=[]; if(!(Q>=0))missing.push('Q (kN)');if(!(Lk>0))missing.push('Lk (mm)');if(!(nk>0&&nk<=3))missing.push('nk (1…3)'); if(missing.length)return {ok:false,missing};
  const Qn=Q*1000, tk=Qn/(c.Rb*Lk*nk), hk0=Qn/(2*c.Rbt*Lk*nk); let hk=hk0;
  if(N>0) hk=Math.max(hk0/2,(Qn-0.7*N*1000)/(2*c.Rbt*Lk*nk));
  return {ok:true,workflow:'5574-annex-g-shear-key',inputs:{grade,Q,Lk,nk,N},tkMm:tk,hkNoCompressionMm:hk0,hkMm:hk,
    steps:[`G.1: tk≥Q/(Rb·Lk·nk)=${tk.toFixed(2)} mm.`,`G.2: hk≥Q/(2Rbt·Lk·nk)=${hk0.toFixed(2)} mm.`,N>0?`G.3: xét N=${N} kN, hk=${hk.toFixed(2)} mm; mức giảm không vượt quá 2 lần.`:'Không có lực nén N → dùng G.2.'],provenance:['TCVN 5574:2018 · Phụ lục G · G.1-G.3 · trang chuẩn 169-170 / PDF 167-168',...c.sources]};
}

export function calcShortCorbel5574(input={}){
  const grade=String(input.grade||'B30').toUpperCase(),c=lookup5574Concrete(grade); if(!c)return {ok:false,missing:['Cấp bê tông Verified.']};
  const b=num(input.b),h0=num(input.h0),L1=num(input.L1),Lsup=num(input.Lsup),Q=num(input.Q),Asw=num(input.Asw??0),sw=num(input.sw),Es=num(input.Es??TCVN5574_ES_BAR_MPA),missing=[];
  for(const [n,v] of [['b',b],['h0',h0],['L1',L1],['Lsup',Lsup],['Q',Q]])if(!(v>0))missing.push(`${n} (mm/kN)`); if(Asw>0&&!(sw>0))missing.push('sw (mm)'); if(missing.length)return {ok:false,missing};
  const ratio=L1/h0; if(ratio>0.9)return {ok:false,missing:[`Phụ lục H áp dụng công xôn ngắn khi L1/h0≤0,9; hiện =${ratio.toFixed(3)}.`]};
  const sinTheta=h0/Math.sqrt(h0*h0+L1*L1),alpha=Es/c.Eb,muW=Asw>0?Asw/(b*sw):0;
  const base=0.8*c.Rb*b*Lsup*sinTheta*sinTheta*(1+5*alpha*muW)/1000;
  const lower=2.5*c.Rbt*b*h0/1000, upper=3.5*c.Rbt*b*h0/1000;
  const Qu=Math.max(lower,Math.min(upper,base)); const pass=Q<=Qu;
  return {ok:true,workflow:'5574-corbel',inputs:{grade,b,h0,L1,Lsup,Q,Asw,sw,Es},ratioL1H0:ratio,sinTheta,alpha,muW,baseQuKn:base,lowerQuKn:lower,upperQuKn:upper,QuKn:Qu,utilization:Q/Qu,pass,
    steps:[`Phụ lục H: L1/h0=${ratio.toFixed(3)}≤0,9.`,`sinθ=h0/√(h0²+L1²)=${sinTheta.toFixed(4)}; α=Es/Eb=${alpha.toFixed(4)}; μw=Asw/(b·sw)=${muW.toFixed(5)}.`,`H.1: Q_R=0,8Rb·b·Lsup·sin²θ·(1+5αμw)=${base.toFixed(2)} kN.`,`H.1 khống chế: 2,5Rbt·b·h0=${lower.toFixed(2)} kN ≤ Q_R ≤ 3,5Rbt·b·h0=${upper.toFixed(2)} kN → Qu=${Qu.toFixed(2)} kN.`,`Q=${Q.toFixed(2)} kN → ${pass?'ĐẠT':'KHÔNG ĐẠT'}.`],
    provenance:['TCVN 5574:2018 · Phụ lục H · H.1 · trang chuẩn 171-172 / PDF 169-170',...c.sources],warnings:['Ngoài H.1 còn phải kiểm ứng suất nén tại vùng truyền tải không vượt Rb,loc và cấu tạo cốt ngang theo tiêu chuẩn.']};
}


function fixedPointXi5574(fn, initial=0.5){
  let x=Math.max(0,Math.min(1,Number.isFinite(initial)?initial:0.5));
  for(let i=0;i<200;i++){
    const next=fn(x);
    if(!Number.isFinite(next)) return null;
    const y=Math.max(0,Math.min(1,next));
    if(Math.abs(y-x)<1e-13) return y;
    x=y;
  }
  return x;
}

export function calcAnnularColumn5574(input={}){
  const grade=String(input.grade||'B30').toUpperCase(),steel=String(input.steel||'CB400-V').toUpperCase();
  const c=lookup5574Concrete(grade),st=lookup5574Steel(steel); if(!c||!st)return {ok:false,missing:['Cấp bê tông/thép Verified.']};
  const r1=num(input.r1),r2=num(input.r2),rs=num(input.rs),AsTot=num(input.AsTot),N=num(input.N),M=num(input.M),bars=num(input.bars),uniform=input.uniform!==false,missing=[];
  if(!(r1>0&&r2>r1))missing.push('0<r1<r2 (mm)'); if(!(r1/r2>0.5))missing.push('Phụ lục F.1 yêu cầu r1/r2>0,5.'); if(!(rs>r1&&rs<r2))missing.push('rs phải nằm giữa r1 và r2.'); if(!(AsTot>0))missing.push('As,tot (mm²)'); if(!(N>=0))missing.push('N (kN)'); if(!(M>=0))missing.push('M (kN.m, đã kể uốn dọc)'); if(!(bars>=7))missing.push('Số thanh dọc tối thiểu 7.'); if(!uniform)missing.push('Cốt thép phải phân bố đều theo chu vi.'); if(missing.length)return {ok:false,missing};
  const A=Math.PI*(r2*r2-r1*r1),rm=(r1+r2)/2,Nn=N*1000;
  const xi=(Nn+st.Rs*AsTot)/(c.Rb*A+(st.Rsc+1.7*st.Rs)*AsTot); // F.1
  let branch,xiUse,MuNmm;
  const common=(x)=>(c.Rb*A*rm+st.Rs*AsTot*rs)*Math.sin(Math.PI*x)/Math.PI;
  if(xi<=0.15){
    branch='F.3/F.4'; xiUse=(Nn+0.75*st.Rs*AsTot)/(c.Rb*A+st.Rs*AsTot);
    MuNmm=common(xiUse)+0.295*st.Rs*AsTot*rs;
  } else if(xi<0.6){
    branch='F.2'; xiUse=xi;
    MuNmm=common(xi)+st.Rs*AsTot*rs*(1-1.7*xi)*(0.2+1.3*xi);
  } else {
    branch='F.5/F.6'; xiUse=Nn/(c.Rb*A+st.Rs*AsTot); MuNmm=common(xiUse);
  }
  const Mu=MuNmm/1e6,utilization=Mu>0?M/Mu:Infinity;
  return {ok:true,workflow:'5574-annular-column',inputs:{grade,steel,r1,r2,rs,AsTot,N,M,bars,uniform},Amm2:A,rmMm:rm,xiCir:xi,xiUsed:xiUse,branch,MuKnM:Mu,utilization,pass:utilization<=1,
    steps:[`F.1: ξcir=${xi.toFixed(6)} → nhánh ${branch}.`,`Bán kính trung bình rm=${rm.toFixed(2)} mm; A=${A.toFixed(1)} mm².`,`${branch}: Mu=${Mu.toFixed(3)} kN.m.`,`M=${M.toFixed(3)} kN.m → M/Mu=${utilization.toFixed(4)} → ${utilization<=1?'ĐẠT':'KHÔNG ĐẠT'}.`],
    provenance:['TCVN 5574:2018 · Phụ lục F.1 · F.1-F.6 · trang chuẩn 166 / PDF 164',...c.sources,...st.sources],warnings:['M phải được xác định có kể đến ảnh hưởng uốn dọc cấu kiện trước khi dùng Phụ lục F.']};
}

export function calcCircularColumn5574(input={}){
  const grade=String(input.grade||'B30').toUpperCase(),steel=String(input.steel||'CB400-V').toUpperCase();
  const c=lookup5574Concrete(grade),st=lookup5574Steel(steel); if(!c||!st)return {ok:false,missing:['Cấp bê tông/thép Verified.']};
  const allowed=new Set(['CB240-T','CB300-T','CB300-V','CB400-V']); if(!allowed.has(steel))return {ok:false,missing:['Phụ lục F.2 chỉ áp dụng cốt thép từ CB400-V trở xuống.']};
  const r=num(input.r),rs=num(input.rs),AsTot=num(input.AsTot),N=num(input.N),M=num(input.M),bars=num(input.bars),uniform=input.uniform!==false,missing=[];
  if(!(r>0))missing.push('r (mm)'); if(!(rs>0&&rs<r))missing.push('0<rs<r (mm)'); if(!(AsTot>0))missing.push('As,tot (mm²)'); if(!(N>=0))missing.push('N (kN)'); if(!(M>=0))missing.push('M (kN.m, đã kể uốn dọc)'); if(!(bars>=7))missing.push('Số thanh dọc tối thiểu 7.'); if(!uniform)missing.push('Cốt thép phải phân bố đều theo chu vi.'); if(missing.length)return {ok:false,missing};
  const A=Math.PI*r*r,Nn=N*1000,RbA=c.Rb*A,RsAs=st.Rs*AsTot,threshold=0.77*RbA+0.645*RsAs,low=Nn<=threshold;
  const rhs=low?(x)=>(Nn+RbA*Math.sin(2*Math.PI*x)/(2*Math.PI))/(RbA+RsAs):(x)=>(Nn+RsAs+RbA*Math.sin(2*Math.PI*x)/(2*Math.PI))/(RbA+2.55*RsAs);
  const init=Math.max(0,Math.min(1,Nn/(RbA+RsAs))),xi=fixedPointXi5574(rhs,init); if(xi==null)return {ok:false,missing:['Không hội tụ nghiệm ξcir của F.9/F.10.']};
  const phi=low?Math.min(1,Math.max(0,1.6*(1-1.55*xi)*xi)):0;
  const MuNmm=(2/3)*RbA*r*Math.pow(Math.sin(Math.PI*xi),3)/Math.PI+RsAs*(Math.sin(Math.PI*xi)/Math.PI+phi)*rs;
  const Mu=MuNmm/1e6,utilization=Mu>0?M/Mu:Infinity;
  return {ok:true,workflow:'5574-circular-column',inputs:{grade,steel,r,rs,AsTot,N,M,bars,uniform},Amm2:A,conditionF8:low,thresholdNKn:threshold/1000,xiCir:xi,phi,MuKnM:Mu,utilization,pass:utilization<=1,
    steps:[`F.8: N=${N.toFixed(2)} kN ${low?'≤':'>'} ${ (threshold/1000).toFixed(2)} kN → giải ${low?'F.9':'F.10'}.`,`${low?'F.9':'F.10'}: ξcir=${xi.toFixed(8)}; φ=${phi.toFixed(6)}.`,`F.7: Mu=${Mu.toFixed(3)} kN.m.`,`M=${M.toFixed(3)} kN.m → M/Mu=${utilization.toFixed(4)} → ${utilization<=1?'ĐẠT':'KHÔNG ĐẠT'}.`],
    provenance:['TCVN 5574:2018 · Phụ lục F.2 · F.7-F.10 · trang chuẩn 167-168 / PDF 165-166',...c.sources,...st.sources],warnings:['M phải được xác định có kể đến ảnh hưởng uốn dọc cấu kiện trước khi dùng Phụ lục F.']};
}

export const TCVN5574_ANNEX_INDEX = Object.freeze([
  {annex:'A',status:'INDEXED',type:'NORMATIVE_DATA',title:'Quan hệ giữa các cường độ chịu nén của bê tông',standardPage:149,pdfPage:147},
  {annex:'B',status:'INDEXED',type:'REFERENCE_MODEL',title:'Các biểu đồ biến dạng của bê tông',standardPage:150,pdfPage:148},
  {annex:'C',status:'INDEXED',type:'REFERENCE_DATA',title:'Hướng dẫn áp dụng một số loại cốt thép',standardPage:154,pdfPage:152},
  {annex:'D',status:'VERIFIED_BRANCH',type:'NUMERIC',title:'Tính toán chi tiết đặt sẵn',standardPage:160,pdfPage:158},
  {annex:'E',status:'VERIFIED_METHOD',type:'METHOD',title:'Tính toán hệ kết cấu',standardPage:163,pdfPage:161},
  {annex:'F',status:'VERIFIED',type:'NUMERIC',title:'Cột tiết diện vành khuyên và tròn',standardPage:166,pdfPage:164},
  {annex:'G',status:'VERIFIED',type:'NUMERIC',title:'Tính toán chốt bê tông',standardPage:169,pdfPage:167},
  {annex:'H',status:'VERIFIED',type:'NUMERIC',title:'Tính toán công xôn ngắn',standardPage:171,pdfPage:169},
  {annex:'I',status:'INDEXED',type:'REFERENCE_METHOD',title:'Tính toán kết cấu bán lắp ghép',standardPage:174,pdfPage:172},
  {annex:'K',status:'INDEXED',type:'REFERENCE_MODEL',title:'Cốt thép hạn chế biến dạng ngang – mô hình phi tuyến',standardPage:177,pdfPage:175},
  {annex:'L',status:'VERIFIED_PARTIAL',type:'NORMATIVE_DATA',title:'Hệ số mô men kháng uốn đàn dẻo',standardPage:179,pdfPage:177},
  {annex:'M',status:'VERIFIED_PARTIAL',type:'NORMATIVE_LIMITS',title:'Độ võng và chuyển vị của kết cấu',standardPage:181,pdfPage:179},
  {annex:'N',status:'INDEXED',type:'NORMATIVE_DATA',title:'Nhóm chế độ làm việc của cần trục',standardPage:192,pdfPage:190},
]);

// ---- v1.22.0: Annex D / L / M verified branches ----
export function calcEmbeddedPlateAnchorsD5574(input={}){
  const grade=String(input.grade||'B30').toUpperCase(), steel=String(input.steel||'CB400-V').toUpperCase();
  const c=lookup5574Concrete(grade), s=lookup5574Steel(steel); if(!c||!s)return {ok:false,missing:['Cấp bê tông/thép Verified.']};
  const M=num(input.M),N=num(input.N??0),Q=num(input.Q),z=num(input.z),nan=num(input.nan),Aan=num(input.Aan),Qan0=num(input.Qan0),topCast=Boolean(input.topCast);
  const missing=[]; if(M==null)missing.push('M (kN.m)'); if(Q==null)missing.push('Q (kN)'); if(!(z>0))missing.push('z (mm)'); if(!(nan>=1))missing.push('nan'); if(!(Aan>0))missing.push('Aan,j (mm²)'); if(!(Qan0>0))missing.push('Qan,j,0 từ CT (D.5) có provenance'); if(missing.length)return {ok:false,missing};
  const Nan=M*1000/z+N/nan; let Np=M*1000/z-N/nan; if(topCast)Np=0; if(Nan<0)Np=N;
  const Qan=Math.max(0,(Q-0.3*Np)/nan); const Nan0=s.Rs*Aan/1000; const util=Qan/Qan0+Nan/Nan0;
  return {ok:true,workflow:'5574-annex-d-embedded',inputs:{grade,steel,M,N,Q,z,nan,Aan,Qan0,topCast},NanKn:Nan,QanKn:Qan,NprimeKn:Np,Nan0Kn:Nan0,Qan0Kn:Qan0,utilization:util,pass:util<=1,
    steps:[`D.2: Nan,j = M/z + N/nan = ${Nan.toFixed(3)} kN.`,`D.4: N'an = ${Np.toFixed(3)} kN${topCast?' (mặt trên khi đổ bê tông → 0)':''}.`,`D.3: Qan,j = (Q−0,3N'an)/nan = ${Qan.toFixed(3)} kN.`,`D.6: Nan,j,0 = Rs·Aan,j = ${Nan0.toFixed(3)} kN.`,`D.1: Qan,j/Qan,j,0 + Nan,j/Nan,j,0 = ${util.toFixed(4)} → ${util<=1?'ĐẠT':'KHÔNG ĐẠT'}.`],
    warnings:['CT (D.5) chưa được tự máy hóa trong pass này do biểu thức PDF extraction không đủ rõ; Qan,j,0 bắt buộc nhập từ nguồn có provenance.'],
    provenance:['TCVN 5574:2018 · Phụ lục D.1 · CT (D.1)-(D.6) · trang chuẩn 160-161 / PDF 158-159',...c.sources,...s.sources]};
}

export function calcInclinedAnchorD75574(input={}){
  const steel=String(input.steel||'CB400-V').toUpperCase(),s=lookup5574Steel(steel); if(!s)return {ok:false,missing:['Thép Verified.']};
  const Q=num(input.Q),Nprime=num(input.Nprime??0),angle=num(input.angle??20); if(!(Q>0))return {ok:false,missing:['Q (kN)']}; if(angle<15||angle>30)return {ok:false,missing:['Góc neo xiên phải trong 15°–30° theo D.2.']};
  const AanInc=Math.max(0,(Q-0.3*Nprime)*1000/s.Rs); return {ok:true,workflow:'5574-annex-d-inclined',AanIncMm2:AanInc,steps:[`D.7: Aan,inc=(Q−0,3N'an)/Rs=${AanInc.toFixed(3)} mm².`],provenance:['TCVN 5574:2018 · Phụ lục D.2 · CT (D.7) · trang chuẩn 162 / PDF 160',...s.sources]};
}

export function lookupAnnexLGamma5574(input={}){
  const type=String(input.type||'rectangle'); const bf=num(input.bf),b=num(input.b),hf=num(input.hf),h=num(input.h);
  let gamma=null,rule=''; if(type==='rectangle'){gamma=1.30;rule='Bảng L.1 mục 1';}
  else if(type==='t-compression'){gamma=1.30;rule='Bảng L.1 mục 2';}
  else if(type==='t-tension'){
    if(!(bf>0&&b>0&&hf>=0&&h>0))return {ok:false,missing:['bf, b, hf, h cho chữ T cánh chịu kéo.']};
    gamma=(bf<=2*b||hf/h>=0.2)?1.25:1.20; rule=bf<=2*b?'Bảng L.1 mục 3a':hf/h>=0.2?'Bảng L.1 mục 3b':'Bảng L.1 mục 3c';
  } else return {ok:false,missing:['Pass v1.22 chỉ VERIFIED các mục 1–3 Bảng L.1; hình dạng khác vẫn INDEXED/REVIEW.']};
  return {ok:true,workflow:'5574-annex-l-gamma',inputs:{type,bf,b,hf,h},gamma,rule,provenance:['TCVN 5574:2018 · Phụ lục L · Bảng L.1 · trang chuẩn 179 / PDF 177']};
}



export function calcAnnexMVerticalLimit5574(input={}){
  const type=String(input.type||'generic'),L=num(input.L),a=num(input.a),roomHeight=num(input.roomHeight),group=String(input.group||'A1-A6').toUpperCase();
  const lin=(x,x1,y1,x2,y2)=>y1+(x-x1)*(y2-y1)/(x2-x1);
  let fu=null,rule='';
  if(type==='crane-floor'){ if(!(L>0))return {ok:false,missing:['L (m)']}; fu=L*1000/250; rule='Bảng M.1 mục 1: L/250'; }
  else if(type==='crane-cabin'){ if(!(L>0))return {ok:false,missing:['L (m)']}; const den=/A8/.test(group)?600:/A7/.test(group)?500:400; fu=L*1000/den; rule=`Bảng M.1 mục 1: L/${den}`; }
  else if(type==='visible-roof-floor'){
    if(!(L>0))return {ok:false,missing:['L (m)']}; const lowRoom=roomHeight!=null&&roomHeight<=6, x24=lowRoom?12:24, x36=lowRoom?24:36;
    const pts=[[1,1000/120],[3,3000/150],[6,6000/200],[x24,x24*1000/250],[x36,x36*1000/300]];
    if(L<=1) fu=L*1000/120; else if(L>=x36) fu=L*1000/300; else { for(let i=0;i<pts.length-1;i++){if(L>=pts[i][0]&&L<=pts[i+1][0]){fu=lin(L,pts[i][0],pts[i][1],pts[i+1][0],pts[i+1][1]);break;}} }
    rule=`Bảng M.1 mục 2a${lowRoom?' (chiều cao phòng ≤6 m)':''}; nội suy tuyến tính`;
  }
  else if(type==='detachable-finishes'){ if(!(L>0))return {ok:false,missing:['L (m)']}; fu=L*1000/150; rule='Bảng M.1 mục 2c: L/150'; }
  else if(type==='suspended-hoist-floor'){ if(!(L>0&&a>0))return {ok:false,missing:['L, a (m)']}; fu=Math.min(L*1000/300,a*1000/150); rule='Bảng M.1 mục 2d: min(L/300,a/150)'; }
  else if(type==='suspended-hoist-cabin'){ if(!(L>0&&a>0))return {ok:false,missing:['L, a (m)']}; fu=Math.min(L*1000/400,a*1000/200); rule='Bảng M.1 mục 2d: min(L/400,a/200)'; }
  else if(type==='free-slab-stair'){ fu=0.7; rule='Bảng M.1 mục 4: 0,7 mm'; }
  else if(type==='lintel-wall-panel'){ if(!(L>0))return {ok:false,missing:['L (m)']}; fu=L*1000/200; rule='Bảng M.1 mục 5: L/200'; }
  else return calcAnnexMGenericLimit5574({span:L||num(input.span),cantilever:Boolean(input.cantilever)});
  return {ok:true,workflow:'5574-annex-m-vertical-limit',inputs:{type,L,a,roomHeight,group},fuMm:fu,rule,provenance:['TCVN 5574:2018 · Phụ lục M.4.2.1 · Bảng M.1 · trang chuẩn 186-187 / PDF 184-185']};
}
export function calcAnnexMPsychophysicalDeflection5574(input={}){
  const p=num(input.p),p1=num(input.p1),q=num(input.q),nHz=num(input.n),bcoef=num(input.b); if([p,p1,q,nHz,bcoef].some(v=>v==null)||nHz<=0||bcoef<=0)return {ok:false,missing:['p, p1, q (kPa), n (Hz), b theo Bảng M.2']};
  const g=9.81, fu=1000*g*(p+p1+q)/(30*nHz*nHz*bcoef*(p1+q));
  return {ok:true,workflow:'5574-annex-m-psychophysical',inputs:{p,p1,q,n:nHz,b:bcoef},fuMm:fu,steps:[`M.2: fu=${fu.toFixed(3)} mm.`],provenance:['TCVN 5574:2018 · Phụ lục M.4.2.2 · CT (M.2), Bảng M.2 · trang chuẩn 188 / PDF 186']};
}

export function calcAnnexMGenericLimit5574(input={}){
  const span=num(input.span),cantilever=Boolean(input.cantilever); if(!(span>0))return {ok:false,missing:['span (m)']}; const fu=span*1000/(cantilever?75:150);
  return {ok:true,workflow:'5574-annex-m-generic-limit',inputs:{span,cantilever},fuMm:fu,steps:[`M.4.1.3: fu=${span} m/${cantilever?75:150}=${fu.toFixed(3)} mm.`],provenance:['TCVN 5574:2018 · Phụ lục M.4.1.3 · trang chuẩn 185 / PDF 183']};
}

export function calcAnnexMCraneHorizontalLimit5574(input={}){
  const group=String(input.group||'A1-A3').toUpperCase(),member=String(input.member||'indoor-column'),h=num(input.h),L=num(input.L); const g=group.includes('A7')||group.includes('A8')?'A7-A8':group.includes('A4')||group.includes('A5')||group.includes('A6')?'A4-A6':'A1-A3';
  const den={ 'A1-A3':{indoor:500,outdoor:1500,beam:500},'A4-A6':{indoor:1000,outdoor:2000,beam:1000},'A7-A8':{indoor:2000,outdoor:2500,beam:2000}}[g];
  let raw=null; if(/beam|dam|dầm|brake/.test(member)){if(!(L>0))return {ok:false,missing:['L (m)']};raw=L*1000/den.beam;} else {if(!(h>0))return {ok:false,missing:['h (m)']};raw=h*1000*(/outdoor|ngoai|ngoài/.test(member)?1/den.outdoor:1/den.indoor);} const fu=Math.max(6,raw);
  return {ok:true,workflow:'5574-annex-m-crane-horizontal',inputs:{group:g,member,h,L},fuMm:fu,rawMm:raw,group:g,steps:[`Bảng M.3: fu=max(6 mm, ${raw.toFixed(3)} mm)=${fu.toFixed(3)} mm.`],provenance:['TCVN 5574:2018 · Phụ lục M.4.3.1 · Bảng M.3 · trang chuẩn 189 / PDF 187']};
}

export function calcAnnexMStructuralDrift5574(input={}){
  const type=String(input.type||'multistory'),connection=String(input.connection||'soft'),hs=num(input.hs),h=num(input.h); let fu=null,rule='';
  if(type==='multistory'){if(!(h>0))return {ok:false,missing:['h (m) chiều cao nhà']};fu=h*1000/500;rule='Bảng M.4 mục 1: h/500';}
  else if(type==='story-brick'){if(!(hs>0))return {ok:false,missing:['hs (m)']};fu=hs*1000/(connection==='rigid'?500:300);rule=`Bảng M.4 mục 2a: hs/${connection==='rigid'?500:300}`;}
  else if(type==='story-ceramic'){if(!(hs>0))return {ok:false,missing:['hs (m)']};fu=hs*1000/700;rule='Bảng M.4 mục 2b: hs/700';}
  else if(type==='single-story'){
    if(!(hs>0))return {ok:false,missing:['hs (m)']}; let den;if(hs<=6)den=150;else if(hs<=15)den=150+(hs-6)*(200-150)/9;else if(hs<30)den=200+(hs-15)*(300-200)/15;else den=300;fu=hs*1000/den;rule=`Bảng M.4 mục 3, nội suy: hs/${den.toFixed(3)}`;
  } else return {ok:false,missing:['type không thuộc nhánh Verified M.4 hiện tại.']};
  return {ok:true,workflow:'5574-annex-m-drift',inputs:{type,connection,hs,h},fuMm:fu,rule,provenance:['TCVN 5574:2018 · Phụ lục M.4.4.1 · Bảng M.4 · trang chuẩn 190 / PDF 188']};
}
