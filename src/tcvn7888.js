// Bảng tra nhanh số liệu Bảng 1 TCVN 7888:2014. Chỉ dùng khi người dùng đã tải tiêu chuẩn tương ứng.
const rows = [
  [300,60,'A',24.5,4,99.1,'6–13'],[300,60,'AB',30.0,6,111.0,'6–13'],[300,60,'B',34.3,8,125.6,'6–13'],[300,60,'C',39.2,10,136.4,'6–13'],
  [350,60,'A',34.3,4,118.7,'6–15'],[350,60,'B',49.0,8,150.1,'6–15'],[350,60,'C',58.9,10,162.8,'6–15'],
  [400,65,'A',54.0,4,148.1,'6–16'],[400,65,'AB',64.0,6,176.0,'6–16'],[400,65,'B',73.6,8,187.4,'6–16'],[400,65,'C',88.3,10,204.0,'6–16'],
  [450,70,'A',73.6,4,180.5,'6–16'],[450,70,'B',107.9,8,227.6,'6–16'],[450,70,'C',122.6,10,248.2,'6–16'],
  [500,80,'A',103.0,4,228.6,'6–20'],[500,80,'AB',125.0,6,271.0,'6–20'],[500,80,'B',147.2,8,288.4,'6–20'],[500,80,'C',166.8,10,313.9,'6–20'],
  [600,90,'A',166.8,4,311.0,'6–24'],[600,90,'AB',206.0,6,362.0,'6–24'],[600,90,'B',245.2,8,392.4,'6–24'],[600,90,'C',284.5,10,427.7,'6–24'],
  [700,100,'A',264.9,4,406.1,'6–30'],[700,100,'AB',319.0,6,437.0,'6–30'],[700,100,'B',372.8,8,512.1,'6–30'],[700,100,'C',441.4,10,557.2,'6–30'],
  [800,110,'A',392.4,4,512.1,'6–30'],[800,110,'AB',471.0,6,595.0,'6–30'],[800,110,'B',539.6,8,646.5,'6–30'],[800,110,'C',637.6,10,704.4,'6–30'],
  [900,120,'A',539.6,4,631.0,'6–30'],[900,120,'B',735.8,8,797.0,'6–30'],[900,120,'C',833.8,10,867.0,'6–30'],
  [1000,130,'A',735.8,4,762.2,'6–30'],[1000,130,'AB',883.0,6,774.0,'6–30'],[1000,130,'B',1030.0,8,961.4,'6–30'],[1000,130,'C',1177.0,10,1047.0,'6–30'],
  [1100,140,'A',932.0,4,905.0,'6–30'],[1100,140,'B',1324.0,8,1142.0,'6–30'],[1100,140,'C',1521.0,10,1244.0,'6–30'],
  [1200,150,'A',1177.0,4,1059.0,'6–30'],[1200,150,'AB',1412.0,6,1292.0,'6–30'],[1200,150,'B',1668.0,8,1337.0,'6–30'],[1200,150,'C',1962.0,10,1457.0,'6–30']
].map(([diameter,thickness,loadClass,crackMoment,effectiveStress,shearResistance,lengthRange]) => ({
  diameter, thickness, loadClass, crackMoment, effectiveStress, shearResistance, lengthRange
}));

export const tcvn7888Rows = rows;
export const diameters7888 = [...new Set(rows.map(r => r.diameter))];

// Bảng 2 TCVN 7888:2014 — NPH. Các giá trị dưới đây được đối chiếu trực tiếp
// với trang 12 của tiêu chuẩn. Ký hiệu cọc theo dạng Dk-D (mm).
const nphRows = [
  ['450-300',300,450,60,75,'A',24.5,4,99.1],['450-300',300,450,60,75,'B',34.3,8,125.6],['450-300',300,450,60,75,'C',39.2,10,136.4],
  ['550-400',400,550,65,75,'A',54.0,4,148.1],['550-400',400,550,65,75,'B',73.6,8,187.4],['550-400',400,550,65,75,'C',88.3,10,204.0],
  ['600-450',450,600,70,75,'A',73.6,4,180.5],['600-450',450,600,70,75,'B',107.9,8,227.6],['600-450',450,600,70,75,'C',122.6,10,248.2],
  ['650-500',500,650,80,75,'A',103.0,4,228.6],['650-500',500,650,80,75,'B',147.2,8,288.4],['650-500',500,650,80,75,'C',166.8,10,313.9],
  ['800-600',600,800,90,100,'A',166.8,4,311.0],['800-600',600,800,90,100,'B',245.2,8,392.4],['800-600',600,800,90,100,'C',284.5,10,427.7],
  ['900-700',700,900,100,100,'A',264.9,4,406.1],['900-700',700,900,100,100,'B',372.8,8,512.1],['900-700',700,900,100,100,'C',441.4,10,557.2],
  ['1000-800',800,1000,110,100,'A',392.4,4,512.1],['1000-800',800,1000,110,100,'B',539.6,8,646.5],['1000-800',800,1000,110,100,'C',637.6,10,704.4],
  ['1100-900',900,1100,120,100,'A',735.8,4,762.2],['1100-900',900,1100,120,100,'B',1030.0,8,961.4],['1100-900',900,1100,120,100,'C',1177.0,10,1047.0],
  ['1200-1000',1000,1200,130,100,'A',1177.0,4,1059.0],['1200-1000',1000,1200,130,100,'B',1668.0,8,1337.0],['1200-1000',1000,1200,130,100,'C',1962.0,10,1457.0]
].map(([designation,diameter,noduleDiameterMax,thickness,noduleSize,loadClass,crackMoment,effectiveStress,shearResistance]) => ({
  designation, diameter, noduleDiameterMax, thickness, noduleSize, loadClass, crackMoment, effectiveStress, shearResistance,
  table:'Bảng 2', page:12
}));

export const nph7888Rows = nphRows;
export const diametersNph7888 = [...new Set(nphRows.map(r => r.diameter))];

export function lookup7888(diameter, loadClass) {
  const D = Number(diameter);
  const cls = String(loadClass || '').toUpperCase();
  return rows.find(r => r.diameter === D && r.loadClass === cls) || null;
}

export function lookupNph7888(diameter, loadClass) {
  const D = Number(diameter);
  const cls = String(loadClass || '').toUpperCase();
  return nphRows.find(r => r.diameter === D && r.loadClass === cls) || null;
}

export function lookupPileType7888(diameter, loadClass, pileType = 'PHC') {
  return String(pileType || '').toUpperCase() === 'NPH'
    ? lookupNph7888(diameter, loadClass)
    : lookup7888(diameter, loadClass);
}

export function classesForDiameter7888(diameter) {
  const D = Number(diameter);
  return rows.filter(r => r.diameter === D).map(r => r.loadClass);
}

export function classesForPileType7888(diameter, pileType = 'PHC') {
  const type = String(pileType || 'PHC').toUpperCase();
  if (type === 'NPH') {
    const D = Number(diameter);
    return nphRows.filter(r => r.diameter === D).map(r => r.loadClass);
  }
  return classesForDiameter7888(diameter);
}

export function diametersForPileType7888(pileType = 'PHC') {
  return String(pileType || '').toUpperCase() === 'NPH' ? diametersNph7888 : diameters7888;
}

const TCVN_7888_2014_RE = /TCVN\s*7888\s*[:\-]?\s*2014/i;
export function isTcvn7888_2014Document(doc) {
  if (!doc) return false;
  const identity = `${doc.standard || ''} ${doc.name || ''}`;
  if (TCVN_7888_2014_RE.test(identity)) return true;
  // A renamed PDF can still unlock verified tools only when its own extracted
  // content explicitly identifies the correct edition. Never accept a bare
  // “7888” filename because it can be TCVN 7888:2008 or an unrelated note.
  const headText = (doc.pages || []).slice(0, 8).map(p => String(p?.text || '')).join(' ');
  return TCVN_7888_2014_RE.test(headText);
}
