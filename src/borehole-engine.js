// HNL P0 XLSM reverse-engineering — deterministic borehole/profile engine.
// Scope: normalize layers, resolve a layer at depth, and split a shaft interval.
// It intentionally contains NO hidden XLL table/soil-resistance formulas.

export const BOREHOLE_ENGINE_STATUS = Object.freeze({
  status:'VERIFIED',
  scope:'DETERMINISTIC_PROFILE_GEOMETRY',
  basis:'Interval arithmetic independently implemented and regression tested; no XLL/VBA dependency.'
});

function finite(v){
  if(v===null||v===undefined||String(v).trim()==='') return null;
  const n=Number(v); return Number.isFinite(n)?n:null;
}

export function normalizeBoreholeLayers(layers=[]){
  return (Array.isArray(layers)?layers:[]).map((raw,i)=>{
    const top=finite(raw.top ?? raw.topDepthM ?? raw.fromDepthM);
    const bottom=finite(raw.bottom ?? raw.bottomDepthM ?? raw.toDepthM);
    return {...raw,index:raw.index??i+1,top,bottom};
  }).filter(x=>x.top!=null&&x.bottom!=null&&x.bottom>x.top)
    .sort((a,b)=>a.top-b.top || a.bottom-b.bottom);
}

// boundaryPolicy='deeper': at an exact internal boundary, select the layer below.
// boundaryPolicy='shallower': retain legacy/upper-layer interpretation.
export function findLayerAtDepth(layers=[],depthM,{boundaryPolicy='deeper',tolerance=1e-9}={}){
  const z=finite(depthM); if(z==null) return null;
  const xs=normalizeBoreholeLayers(layers);
  if(!xs.length) return null;
  if(boundaryPolicy==='shallower') return xs.find(x=>z>=x.top-tolerance&&z<=x.bottom+tolerance)||null;
  for(let i=0;i<xs.length;i++){
    const x=xs[i]; const last=i===xs.length-1;
    if(z>=x.top-tolerance && (z<x.bottom-tolerance || (last&&z<=x.bottom+tolerance))) return x;
  }
  return null;
}

export function splitBoreholeInterval(layers=[],{
  startDepthM=0,
  endDepthM,
  maxSegmentM=2
}={}){
  const start=finite(startDepthM)??0, end=finite(endDepthM), maxSeg=finite(maxSegmentM);
  if(end==null || !(end>start)) throw new Error('Khoảng phân tích địa tầng cần endDepthM > startDepthM.');
  if(!(maxSeg>0)) throw new Error('maxSegmentM phải > 0.');
  const xs=normalizeBoreholeLayers(layers); const out=[];
  for(const layer of xs){
    const top=Math.max(start,layer.top), bottom=Math.min(end,layer.bottom);
    if(!(bottom>top+1e-12)) continue;
    let z=top, segmentIndex=1;
    while(z<bottom-1e-9){
      const z2=Math.min(bottom,z+maxSeg);
      out.push({...layer,parentIndex:layer.index,segmentIndex,top:z,bottom:z2,hM:z2-z,avgDepthM:(z+z2)/2});
      z=z2; segmentIndex++;
    }
  }
  return out;
}

export function boreholeCoverageAudit(layers=[],{startDepthM=0,endDepthM}={}){
  const start=finite(startDepthM)??0, end=finite(endDepthM);
  if(end==null||end<start) return {ok:false,gaps:[],coveredM:0,requestedM:0};
  const segs=splitBoreholeInterval(layers,{startDepthM:start,endDepthM:end,maxSegmentM:Math.max(end-start,1)});
  const intervals=segs.map(x=>[x.top,x.bottom]).sort((a,b)=>a[0]-b[0]);
  const gaps=[]; let cursor=start, covered=0;
  for(const [a,b] of intervals){
    if(a>cursor+1e-9) gaps.push({top:cursor,bottom:a,hM:a-cursor});
    const aa=Math.max(a,cursor); if(b>aa) covered+=b-aa;
    cursor=Math.max(cursor,b);
  }
  if(cursor<end-1e-9) gaps.push({top:cursor,bottom:end,hM:end-cursor});
  return {ok:gaps.length===0,gaps,coveredM:covered,requestedM:end-start,verification:BOREHOLE_ENGINE_STATUS};
}
