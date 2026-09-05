// HNL v1.25.7 P0 Pass 3 — numeric production status registry.
// A standard workflow label is not enough to unlock numeric production:
// raw-profile implementations must also satisfy the end-to-end PDF/Engine/Excel gate.
export const PRODUCTION_STATUS = Object.freeze({
  LOCKED:'LOCKED', VERIFIED:'VERIFIED', REVIEW:'REVIEW', LEGACY:'LEGACY', REFERENCE:'REFERENCE', VERIFIED_PRELIMINARY:'VERIFIED_PRELIMINARY'
});

export const PRODUCTION_STATUS_REGISTRY = Object.freeze({
  'pile-geometry':{status:'LOCKED',productionNumeric:true,source:'Deterministic geometry · P0 Pass 1'},
  'borehole':{status:'LOCKED',productionNumeric:true,source:'Deterministic layer geometry · P0 Pass 1'},
  'interpolation-10304':{status:'LOCKED',productionNumeric:true,source:'TCVN 10304:2025 table policies + boundary Golden'},
  '10304-driven':{status:'LOCKED',productionNumeric:true,source:'7.2.2.1 · CT (9) · Bảng 2–4'},
  '10304-end-bearing-rock':{status:'LOCKED',productionNumeric:true,source:'7.2.1 · CT (5)–(8) · Bảng 1 · P0 Pass 3 E2E'},
  '10304-bored-raw':{status:'LOCKED',productionNumeric:true,source:'7.2.3 · CT (13)–(16) · Bảng 3,6,7,8 · P0 Pass 3 E2E'},
  '10304-cpt':{status:'VERIFIED',productionNumeric:true,source:'7.3.4 · CT (25)–(29) · Bảng 15–16 · P5.2 CPT Golden + applicability gate'},
  '10304-spt-raw':{status:'LOCKED',productionNumeric:true,source:'Phụ lục D · D.1–D.6 · Bảng D.1 · SPT PDF Decision Pass · measured tip window + layer-representative shaft N; no continuous DCE interpolation'},
  '10304-spt-summary-explicit':{status:'VERIFIED',productionNumeric:true,source:'V26 · Phụ lục D/Bảng D.1 · user-supplied N̄ tip + Ns for declared shaft interval · coefficients/caps delegated to LOCKED table engine · Formula Guard'},
  '5574-pile-material-near-centered-rect':{status:'LOCKED',productionNumeric:true,source:'TCVN 5574:2018 · 8.1.2.4.3 · CT (49)–(50) · Bảng 16 · P1 Pass 1'},
  'pile-capacity-integrated-square':{status:'LOCKED',productionNumeric:true,source:'P1 Material E2E · Rpile=min(Rd,10304, Nu,5574) · both child branches LOCKED + geometry/basis gates'},
  'pile-capacity-multiborehole-square':{status:'LOCKED',productionNumeric:true,source:'P1 Pass 2 · Multi-Borehole HK×{Mechanical,SPT} · batch min over independently LOCKED child workflows + common Rmaterial'},

  'xlsm-sct-vatlieu':{status:'REFERENCE',productionNumeric:false,source:'10.1 DCE_SctCoc_10304 2025.xlsm · SCT VatLieu · bugged benchmark only'},
  'xll-GetKsFromRQD':{status:'REFERENCE',productionNumeric:false,source:'DCE Excel.dll signature + XLSM cached RQD=30→Ks=0.24 characterized; Production replaced by direct PDF Bảng 1 implementation'},
  'xll-NoiSuySPT':{status:'REFERENCE',productionNumeric:false,source:'DCE Excel.dll signature + 51 cached diagnostic depths characterized as LINEAR-1D reference; SPT PDF Decision Pass explicitly rejects it as a normative Production requirement'},
  'xll-qb_SPT2025':{status:'REFERENCE',productionNumeric:false,source:'DCE Excel.dll signature + cached qb behavior characterized; Production uses independent Appendix D implementation'},
  'xll-flu_SPT2025':{status:'REFERENCE',productionNumeric:false,source:'DCE Excel.dll signature + cached f/cumulative integration behavior characterized; Production uses independent Appendix D implementation'},
  'xll-GetQbBang8':{status:'REFERENCE',productionNumeric:false,source:'DCE Excel.dll signature; no direct workbook call, indirect Qb_CocMaSatCMD diagnostics benchmark PDF Bảng 8 only'},
  'xll-TinhGammaqbCMS':{status:'REVIEW',productionNumeric:false,source:'DCE Excel.dll signature + cached EQ tuples characterized; missing independent Điều/Công thức/Bảng/Trang provenance'},
  'xll-TinhGammafiCMS':{status:'REVIEW',productionNumeric:false,source:'DCE Excel.dll signature + cached EQ tuples characterized; missing independent Điều/Công thức/Bảng/Trang provenance'},
  '10304-seismic-eq':{status:'REVIEW',productionNumeric:false,source:'XLSM/XLL EQ logic not yet independently verified'},
  '10304-2014':{status:'LEGACY',productionNumeric:false,source:'TCVN 10304:2014 legacy data'}
});

export function productionStatusFor(id=''){
  return PRODUCTION_STATUS_REGISTRY[id] || {status:'REVIEW',productionNumeric:false,source:'Unregistered numeric workflow'};
}
export function isProductionNumericAllowed(id=''){
  const s=productionStatusFor(id); return s.productionNumeric===true && (s.status==='LOCKED'||s.status==='VERIFIED');
}
