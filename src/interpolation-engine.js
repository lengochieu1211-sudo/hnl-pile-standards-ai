// HNL v1.25.3 — shared strict interpolation engine.
// Goal: one deterministic policy for HNL Calculation Engine and Excel exporters.
// No silent extrapolation. Plateau/clamp is allowed ONLY where the standard explicitly says so.

function n(v){
  if(v===null||v===undefined||String(v).trim()==='') return null;
  const x=Number(v); return Number.isFinite(x)?x:null;
}
function close(a,b,tol=1e-12){ return Math.abs(a-b)<=tol*Math.max(1,Math.abs(a),Math.abs(b)); }

export function linear1DStrict({x,xs,ys,low='error',high='error',label='bảng'}){
  x=n(x);
  if(x==null) throw new Error(`${label}: giá trị tra không hợp lệ.`);
  if(!Array.isArray(xs)||!Array.isArray(ys)||xs.length<2||xs.length!==ys.length) throw new Error(`${label}: dữ liệu bảng không hợp lệ.`);
  const lo=xs[0], hi=xs.at(-1);
  if(x<lo && !close(x,lo)){
    if(low==='plateau') return {value:ys[0],mode:'BOUNDARY-PLATEAU',x,x1:lo,x2:lo,y1:ys[0],y2:ys[0],t:0,boundary:'low'};
    throw new Error(`${label}: ${x} nhỏ hơn phạm vi bảng (${lo}). Không ngoại suy.`);
  }
  if(x>hi && !close(x,hi)){
    if(high==='plateau') return {value:ys.at(-1),mode:'BOUNDARY-PLATEAU',x,x1:hi,x2:hi,y1:ys.at(-1),y2:ys.at(-1),t:0,boundary:'high'};
    throw new Error(`${label}: ${x} lớn hơn phạm vi bảng (${hi}). Không ngoại suy.`);
  }
  for(let i=0;i<xs.length;i++) if(close(x,xs[i])){
    if(ys[i]===null||ys[i]===undefined) throw new Error(`${label}: ô tại ${x} không có giá trị; không nội suy qua ô trống.`);
    return {value:ys[i],mode:'EXACT',x,x1:xs[i],x2:xs[i],y1:ys[i],y2:ys[i],t:0};
  }
  for(let i=0;i<xs.length-1;i++) if(x>xs[i]&&x<xs[i+1]){
    const y1=ys[i],y2=ys[i+1];
    if(y1===null||y1===undefined||y2===null||y2===undefined) throw new Error(`${label}: khoảng ${xs[i]}–${xs[i+1]} có ô trống; không được nội suy.`);
    const t=(x-xs[i])/(xs[i+1]-xs[i]);
    return {value:y1+t*(y2-y1),mode:'LINEAR-1D',x,x1:xs[i],x2:xs[i+1],y1,y2,t};
  }
  throw new Error(`${label}: không xác định được khoảng nội suy.`);
}

export function bilinear2DStrict({x,y,xs,ys,grid,lowX='error',highX='error',lowY='error',highY='error',label='bảng 2D'}){
  if(!Array.isArray(grid)||grid.length!==xs.length||grid.some(r=>!Array.isArray(r)||r.length!==ys.length)) throw new Error(`${label}: ma trận dữ liệu không hợp lệ.`);

  // Locate the requested y bracket FIRST.  Do not evaluate unrelated columns.
  // This matters for sparse tables such as TCVN 10304 Bảng 8: a valid cell at
  // IL=0,3 must not fail only because IL=0,5/0,6 are blank at the same depth.
  const yAxis=linear1DStrict({x:y,xs:ys,ys:ys,low:lowY,high:highY,label});
  const j1=ys.findIndex(v=>close(v,yAxis.x1));
  const j2=ys.findIndex(v=>close(v,yAxis.x2));
  if(j1<0||j2<0) throw new Error(`${label}: không xác định được cột nội suy.`);

  const lower=linear1DStrict({x,xs,ys:grid.map(r=>r[j1]),low:lowX,high:highX,label});
  const upper=j2===j1 ? lower : linear1DStrict({x,xs,ys:grid.map(r=>r[j2]),low:lowX,high:highX,label});
  const ty=Number(yAxis.t||0);
  const value=j1===j2 ? lower.value : lower.value+ty*(upper.value-lower.value);

  let mode;
  if(j1===j2){
    mode=lower.mode;
    if(yAxis.mode==='BOUNDARY-PLATEAU' && lower.mode==='EXACT') mode='BOUNDARY-PLATEAU';
  }else{
    const xLinear=lower.mode==='LINEAR-1D'||upper.mode==='LINEAR-1D';
    const xPlateau=lower.mode==='BOUNDARY-PLATEAU'||upper.mode==='BOUNDARY-PLATEAU';
    mode=xLinear?'BILINEAR-2D':(xPlateau?'BILINEAR-2D':'LINEAR-1D');
  }
  return {
    value, mode, x, y,
    xBracket:{x1:lower.x1,x2:lower.x2,t:lower.t,mode:lower.mode},
    yBracket:{y1:yAxis.x1,y2:yAxis.x2,t:yAxis.t,mode:yAxis.mode},
    lowerValue:lower.value, upperValue:upper.value
  };
}
export function exactOrEdgeBand({x,points,values,lowBand=false,highBand=false,label='bảng rời rạc'}){
  x=n(x); if(x==null) throw new Error(`${label}: giá trị tra không hợp lệ.`);
  if(points.length!==values.length) throw new Error(`${label}: dữ liệu không hợp lệ.`);
  if(lowBand && x<=points[0]) return {value:values[0],mode:close(x,points[0])?'EXACT':'EDGE-BAND',x,point:points[0],boundary:'low'};
  if(highBand && x>=points.at(-1)) return {value:values.at(-1),mode:close(x,points.at(-1))?'EXACT':'EDGE-BAND',x,point:points.at(-1),boundary:'high'};
  const i=points.findIndex(p=>close(x,p));
  if(i>=0){ if(values[i]==null) throw new Error(`${label}: mốc ${points[i]} không áp dụng cho nhánh này.`); return {value:values[i],mode:'EXACT',x,point:points[i]}; }
  throw new Error(`${label}: tiêu chuẩn không ghi nội suy cho giá trị ${x}; cần mốc đúng bảng hoặc nhập hệ số có provenance.`);
}
