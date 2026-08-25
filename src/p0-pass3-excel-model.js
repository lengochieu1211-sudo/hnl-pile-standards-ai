// HNL v1.25.7 P0 Pass 3 — independent formula-model mirror for Excel parity tests.
// This module intentionally does NOT call calculateRockEndBearing10304,
// calculateBoredPile10304 or calculateSptPile10304. It reproduces the workbook
// calculation graph from raw inputs while sharing only locked table lookups.
import { calculatePileGeometry } from './pile-geometry-engine.js';
import { splitBoreholeInterval, findLayerAtDepth } from './borehole-engine.js';
import { lookupQb10304, lookupFi10304 } from './pile-workflows.js';
import {
  lookupRockKs10304, lookupTable6GammaRf10304, lookupTable7Alphas10304,
  lookupTable8Qb10304, lookupSptTipResistance10304, lookupSptShaftResistance10304,
  sptEta10304, sptTipWindow10304, averageMeasuredSptN10304
} from './tcvn10304-table-engine.js';

const num=v=>{ if(v===null||v===undefined||String(v).trim()==='') return null; const n=Number(v); return Number.isFinite(n)?n:null; };
function geometry(input={}){
  const L=num(input.lengthM)??(num(input.tipDepthM)!=null&&num(input.headDepthM)!=null?Math.abs(num(input.tipDepthM)-num(input.headDepthM)):null);
  if(input.shape==='circle'||num(input.diameterM)!=null) return calculatePileGeometry({shape:'circle',diameterM:input.diameterM,lengthM:L,tipInnerDiameterM:input.tipInnerDiameterM,massInnerDiameterM:input.massInnerDiameterM});
  if(input.shape==='square'||num(input.sideM)!=null) return calculatePileGeometry({shape:'square',sideM:input.sideM,lengthM:L,tipInnerSideM:input.tipInnerSideM,massInnerSideM:input.massInnerSideM});
  const a=num(input.areaM2),u=num(input.perimeterM); return {areaM2:a,tipAreaM2:a,perimeterM:u,lengthM:L,diameterM:num(input.diameterM),sideM:num(input.sideM)};
}
function layersOf(rows=[]){return (rows||[]).map((r,i)=>({...r,index:Number(r.index)||i+1,top:num(r.top),bottom:num(r.bottom),soilGroup:r.soilGroup||'clay',sandType:r.sandType||'',soilClass:r.soilClass||(r.soilGroup==='sand'?'sand':'clay'),IL:num(r.IL),fiOverride:num(r.fiOverride),phiDeg:num(r.phiDeg),gammaKnM3:num(r.gammaKnM3),gammaEffectiveKnM3:num(r.gammaEffectiveKnM3),sptN:num(r.sptN),cuKpa:num(r.cuKpa),Sr:num(r.Sr)})).filter(x=>x.top!=null&&x.bottom!=null&&x.bottom>x.top).sort((a,b)=>a.top-b.top);}
function averageGamma(layers,tip){let s=0,h=0;for(const l of layers){const a=Math.max(0,l.top),b=Math.min(tip,l.bottom);if(b<=a)continue;const g=num(l.gammaKnM3);if(g==null)return null;s+=g*(b-a);h+=b-a;}return h>0?s/h:null;}
function gammaRR(input={}){const manual=num(input.gammaRR);if(manual!=null)return manual;const mode=String(input.tipConstruction||'general');const map={general:1,'blasted-enlarged':1.3,'jet-grout-pdt':1.3,'mechanical-enlarged-dry':.5,'mechanical-enlarged-underwater':.3,'dry-inspected':1,'wash-inspected':.9};if(map[mode]==null)throw new Error('7.2.3: chưa xác định γR,R theo phương pháp tạo mũi.');return map[mode];}
function layerRepresentativeN(points,layer){if(layer?.sptN!==null&&layer?.sptN!==undefined&&String(layer.sptN).trim()!==''&&Number.isFinite(Number(layer.sptN)))return {value:Number(layer.sptN),source:'REPORT-LAYER-REPRESENTATIVE',used:[]};const eps=1e-9,used=(points||[]).map((p,i)=>({index:i+1,depthM:Number(p.depthM),N:Number(p.N)})).filter(p=>Number.isFinite(p.depthM)&&Number.isFinite(p.N)&&p.N>=0&&p.depthM>=layer.top-eps&&p.depthM<layer.bottom-eps);if(!used.length)return {value:null,source:'MISSING-MEASURED-LAYER-N',used:[]};return {value:used.reduce((sum,p)=>sum+p.N,0)/used.length,source:'DERIVED-MEASURED-LAYER-MEAN',used};}

export function evaluateRockExcelModel10304(input={}){
  const g=geometry(input),A=num(input.areaM2)??num(g.tipAreaM2)??num(g.areaM2),RcN=num(input.rockCompressiveStrengthKpa)??num(input.RcN),rqd=num(input.rqdPercent)??num(input.rqd),gammaG=num(input.gammaG)??1.4,Ld=num(input.embedmentLengthM)??num(input.Ld)??0,df=num(input.embeddedOuterDiameterM)??num(input.df)??num(input.diameterM)??num(input.sideM),floor=num(input.minimumQbKpa);
  if(!(A>0&&RcN>0&&rqd!=null&&gammaG>0)) throw new Error('Rock Excel model: thiếu A/Rc,n/RQD/γg.');
  if(Ld>=.5&&!(df>0)) throw new Error('Rock Excel model: thiếu df.');
  const ks=lookupRockKs10304(rqd),RmKpa=RcN*ks.value/gammaG,embedmentFactor=Ld<.5?1:Math.min(1+.4*Ld/df,3),qbBeforeCapKpa=RmKpa*embedmentFactor,qbCapKpa=Math.min(qbBeforeCapKpa,20000),qbKpa=floor==null?qbCapKpa:Math.max(qbCapKpa,floor),RkKn=qbKpa*A,gammaK=num(input.gammaK),RdKn=gammaK&&gammaK>0?RkKn/gammaK:null,gammaN=num(input.gammaN),NdMaxKn=RdKn!=null&&gammaN&&gammaN>0?RdKn/gammaN:null;
  return {A,Ks:ks.value,RmKpa,embedmentFactor,qbBeforeCapKpa,qbCapKpa,qbKpa,RkKn,gammaK,RdKn,gammaN,NdMaxKn,designFinal:floor!=null};
}

export function evaluateBoredExcelModel10304(input={}){
  const g=geometry(input),A=num(input.areaM2)??num(g.tipAreaM2)??num(g.areaM2),u=num(input.perimeterM)??num(g.perimeterM),tipDepth=num(input.tipDepthM)??num(input.lengthM),shaftStart=num(input.shaftStartDepthM)??0,maxSegment=num(input.maxSegmentM)??2,layers=layersOf(input.layers);
  if(!(A>0&&u>0&&tipDepth>0&&layers.length&&maxSegment>0&&maxSegment<=2))throw new Error('Bored Excel model: input không hợp lệ.');
  const tip=findLayerAtDepth(layers,tipDepth,{boundaryPolicy:'deeper'})||findLayerAtDepth(layers,tipDepth,{boundaryPolicy:'shallower'});if(!tip)throw new Error('Bored Excel model: không có lớp mũi.');
  const embedment=tipDepth-tip.top;if(embedment<2-1e-9)throw new Error('Bored Excel model: ngàm lớp chịu lực <2 m.');
  let qbKpa=num(input.qbOverride),qbCtKpa=null,qbCapKpa=null;
  if(qbKpa==null&&tip.soilGroup!=='sand'){if(tip.IL==null)throw new Error('Bored Excel model: mũi đất dính thiếu IL.');qbKpa=lookupTable8Qb10304({depthM:tipDepth,IL:tip.IL}).value;}
  else if(qbKpa==null){const phi=num(input.tipPhiDeg)??tip.phiDeg,d=num(input.baseDiameterM)??num(input.diameterM)??num(input.sideM),gp=num(input.tipEffectiveGammaKnM3)??tip.gammaEffectiveKnM3??tip.gammaKnM3,g1=num(input.averageGammaAboveTipKnM3)??averageGamma(layers,tipDepth);if(phi==null||!(d>0)||gp==null||g1==null)throw new Error('Bored Excel model: mũi cát thiếu φ/d/γ.');const a=lookupTable7Alphas10304({phi,hdRatio:tipDepth/d,dM:d}),c=input.tipCoreRetained===true?1:.75;qbCtKpa=c*a.alpha4*(a.alpha1*gp*d+a.alpha2*a.alpha3*g1*tipDepth);qbCapKpa=lookupQb10304({depthM:tipDepth,soilGroup:'sand',sandType:tip.sandType||'coarse'}).value;qbKpa=Math.min(qbCtKpa,qbCapKpa);}
  const grr=gammaRR(input),methodCaseId=input.methodCaseId||'bored-64a-64b',segments=shaftStart>=tipDepth?[]:splitBoreholeInterval(layers,{startDepthM:shaftStart,endDepthM:tipDepth,maxSegmentM:maxSegment}),segmentResults=[];
  for(const seg of segments){if(input.enlargedTipDiameterM&&seg.soilGroup==='sand'&&seg.bottom>tipDepth-1.5*Number(input.enlargedTipDiameterM)+1e-9)continue;const fi=lookupFi10304({avgDepthM:seg.avgDepthM,soilGroup:seg.soilGroup,sandType:seg.sandType,IL:seg.IL,override:seg.fiOverride}),rf=lookupTable6GammaRf10304({caseId:methodCaseId,soil:seg.soilClass||seg.soilGroup}),resistanceKn=u*rf.value*fi.value*seg.hM;segmentResults.push({...seg,fiKpa:fi.value,gammaRf:rf.value,resistanceKn});}
  const gammaC=num(input.gammaC)??((tip.soilGroup!=='sand'&&tip.Sr!=null&&tip.Sr<.85)||input.loess===true?.8:1),tipResistanceKn=grr*qbKpa*A,sideResistanceKn=segmentResults.reduce((s,x)=>s+x.resistanceKn,0),RkKn=gammaC*(tipResistanceKn+sideResistanceKn),gammaK=num(input.gammaK),RdKn=gammaK&&gammaK>0?RkKn/gammaK:null,gammaN=num(input.gammaN),NdMaxKn=RdKn!=null&&gammaN&&gammaN>0?RdKn/gammaN:null;
  return {A,u,tipDepthM:tipDepth,shaftStartDepthM:shaftStart,maxSegmentM:maxSegment,tipLayer:tip,embedmentInBearingLayerM:embedment,qbKpa,qbCtKpa,qbCapKpa,gammaRR:grr,gammaC,tipResistanceKn,segmentResults,sideResistanceKn,RkKn,gammaK,RdKn,gammaN,NdMaxKn,methodCaseId};
}

export function evaluateSptExcelModel10304(input={}){
  const g=geometry(input),A=num(input.areaM2)??num(g.tipAreaM2)??num(g.areaM2),u=num(input.perimeterM)??num(g.perimeterM),tipDepth=num(input.tipDepthM)??num(input.lengthM),shaftStart=num(input.shaftStartDepthM)??0,pileType=input.pileType||'bored',layers=layersOf(input.layers),points=input.sptPoints||[],d=num(input.diameterM)??num(input.sideM);
  if(!(A>0&&u>0&&tipDepth>0&&d>0&&layers.length))throw new Error('SPT Excel model: input không hợp lệ.');
  const tip=findLayerAtDepth(layers,tipDepth,{boundaryPolicy:'deeper'})||findLayerAtDepth(layers,tipDepth,{boundaryPolicy:'shallower'});if(!tip)throw new Error('SPT Excel model: không có lớp mũi.');
  const eta=sptEta10304({pileType,closedTip:input.closedTip!==false,lengthM:num(input.lengthM),innerDiameterM:num(input.innerDiameterM),eta:input.eta});let tipN=null,tipNAudit=null,tipCu=tip.cuKpa;
  if(tip.soilGroup==='sand'||pileType==='screw'){const w=sptTipWindow10304({pileType,tipDepthM:tipDepth,diameterM:d});tipNAudit=averageMeasuredSptN10304(points,w);tipN=tipNAudit.value;}else if(tipCu==null&&tip.sptN!=null)tipCu=6.25*tip.sptN;
  const qb=lookupSptTipResistance10304({pileType,soilGroup:tip.soilGroup,N:tipN??tip.sptN,cuKpa:tipCu,eta:eta.value});const clipped=layers.map(l=>({...l,top:Math.max(l.top,shaftStart),bottom:Math.min(l.bottom,tipDepth)})).filter(l=>l.bottom>l.top+1e-12),segmentResults=[];
  for(const l of clipped){const nRep=layerRepresentativeN(points,l),N=nRep.value,r=lookupSptShaftResistance10304({pileType,soilGroup:l.soilGroup,N,cuKpa:l.cuKpa}),hM=l.bottom-l.top,resistanceKn=r.value*hM*u;segmentResults.push({...l,hM,NUsed:N,NSource:nRep.source,NMeasuredPoints:nRep.used,unitResistanceKpa:r.value,resistanceKn});}
  const RubKn=qb.value*A,RufKn=segmentResults.reduce((s,x)=>s+x.resistanceKn,0),RkKn=RubKn+RufKn,gammaK=num(input.gammaK),RdKn=gammaK&&gammaK>0?RkKn/gammaK:null,gammaN=num(input.gammaN),NdMaxKn=RdKn!=null&&gammaN&&gammaN>0?RdKn/gammaN:null;
  return {A,u,pileType,eta:eta.value,tipDepthM:tipDepth,shaftStartDepthM:shaftStart,tipLayer:tip,tipN,tipNAudit,qbKpa:qb.value,RubKn,segmentResults,RufKn,RkKn,gammaK,RdKn,gammaN,NdMaxKn,sptDataPolicy:{decision:'PDF-DECISION-LOCKED',tipN:'MEASURED-WINDOW-ARITHMETIC-MEAN; CAP-100',shaftN:'REPORT-LAYER-REPRESENTATIVE / DERIVED-MEASURED-LAYER-MEAN',shaftBoundary:'HALF-OPEN [top,bottom)',continuousInterpolation:false,partitionedD56:true}};
}
