#!/usr/bin/env python3
"""Extract cached behavioral evidence for DCE pile UDFs from the reference XLSM.

This script never executes the proprietary XLL. It reads formulas + cached values
from the XLSM OOXML package so the evidence is reproducible without Excel/DCE.
Usage:
  python scripts/audit/extract-dce-udf-behavioral.py <xlsm> <output.json>
"""
from __future__ import annotations
import hashlib, json, math, re, sys, zipfile
import xml.etree.ElementTree as ET
from pathlib import Path

NS={'m':'http://schemas.openxmlformats.org/spreadsheetml/2006/main',
    'r':'http://schemas.openxmlformats.org/officeDocument/2006/relationships'}
RID='{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id'

def sha256(path: Path) -> str:
    h=hashlib.sha256()
    with path.open('rb') as f:
        for chunk in iter(lambda:f.read(1024*1024),b''): h.update(chunk)
    return h.hexdigest()

def workbook_reader(path: Path):
    z=zipfile.ZipFile(path)
    shared=[]
    if 'xl/sharedStrings.xml' in z.namelist():
        root=ET.fromstring(z.read('xl/sharedStrings.xml'))
        for si in root:
            shared.append(''.join(t.text or '' for t in si.iter('{%s}t'%NS['m'])))
    wb=ET.fromstring(z.read('xl/workbook.xml'))
    rels=ET.fromstring(z.read('xl/_rels/workbook.xml.rels'))
    relmap={x.attrib['Id']:x.attrib['Target'] for x in rels}
    sheet_paths={}
    for s in wb.find('m:sheets',NS):
        target=relmap[s.attrib[RID]]
        if target.startswith('/'): target=target.lstrip('/')
        elif not target.startswith('xl/'): target='xl/'+target
        sheet_paths[s.attrib['name']]=target
    cache={}
    def sheet(name):
        if name in cache:return cache[name]
        root=ET.fromstring(z.read(sheet_paths[name])); out={}
        for c in root.findall('.//m:c',NS):
            ref=c.attrib['r']; typ=c.attrib.get('t')
            f=c.find('m:f',NS); v=c.find('m:v',NS)
            formula=f.text if f is not None else None
            value=v.text if v is not None else None
            if typ=='s' and value is not None: value=shared[int(value)]
            elif typ=='inlineStr': value=''.join(t.text or '' for t in c.iter('{%s}t'%NS['m']))
            elif typ=='b' and value is not None: value=value=='1'
            elif value is not None:
                try:
                    value=float(value)
                    if value.is_integer(): value=int(value)
                except ValueError: pass
            out[ref]={'value':value,'formula':formula,'type':typ}
        cache[name]=out; return out
    return z,sheet

def v(sh,ref): return sh.get(ref,{}).get('value')
def f(sh,ref): return sh.get(ref,{}).get('formula')
def numeric(x): return isinstance(x,(int,float)) and math.isfinite(float(x))

def find_profile(profile,z):
    hit=None
    for p in profile:
        if z+1e-9>=p['topDepthM']: hit=p
        else: break
    return hit

def main():
    if len(sys.argv)<3:
        raise SystemExit('Usage: extract-dce-udf-behavioral.py <xlsm> <output.json>')
    xlsm=Path(sys.argv[1]).resolve(); out=Path(sys.argv[2]).resolve()
    z,sheet=workbook_reader(xlsm)
    spt=sheet('SPT 10304-2025')

    # SPT measured points, ending at the last numeric pair in the source range.
    spt_points=[]
    for r in range(19,109):
        zz,nn=v(spt,f'O{r}'),v(spt,f'P{r}')
        if numeric(zz) and numeric(nn): spt_points.append({'cellDepth':f'O{r}','cellN':f'P{r}','depthM':float(zz),'N':float(nn)})

    # Soil layers are represented by start elevations in H11:H27.
    starts=[]
    for r in range(11,28):
        zz=v(spt,f'H{r}')
        if numeric(zz): starts.append((r,float(zz),v(spt,f'I{r}')))
    soil_layers=[]
    for i,(r,top,kind) in enumerate(starts):
        bottom=starts[i+1][1] if i+1<len(starts) else 100.0
        soil_layers.append({'sourceRow':r,'topDepthM':top,'bottomDepthM':bottom,
                            'dceSoilGroup':kind,'soilGroup':'clay' if kind=='Đất dính' else 'sand'})

    # Diagnostic rows expose Cao độ, NoiSuySPT, qb/f and cumulative flu.
    diagnostics=[]
    for r in range(35,109):
        zval=v(spt,f'B{r}')
        if not numeric(zval): continue
        diagnostics.append({
            'row':r,'depthM':float(zval),'layerName':v(spt,f'C{r}'),'dceSoilGroup':v(spt,f'D{r}'),
            'NInterpolated':v(spt,f'E{r}'),
            'qbSandKpa':v(spt,f'F{r}'),'qbClayKpa':v(spt,f'G{r}'),
            'segmentLengthM':v(spt,f'I{r}'),'fSandKpa':v(spt,f'J{r}'),'fClayKpa':v(spt,f'K{r}'),
            'fluCumulativeKn':v(spt,f'L{r}'),
            'formulaN':f(spt,f'E{r}'),'formulaFlu':f(spt,f'L{r}')
        })

    # One direct GetKsFromRQD observation exists in the workbook.
    rock=sheet('7.2.1-10304-Cọc Chống')
    rock_obs={'inputCell':'F37','outputCell':'F38','RQD':v(rock,'F37'),'Ks':v(rock,'F38'),'formula':f(rock,'F38')}

    # Indirect Bảng 8 observations through Qb_CocMaSatCMD(...,"qb").
    bored_eq=sheet('7.2.3-10304-Có moi đất EQ')
    table8=[]
    for r in range(43,160):
        zval=v(bored_eq,f'B{r}'); q=v(bored_eq,f'F{r}'); form=f(bored_eq,f'F{r}')
        if not numeric(zval) or not numeric(q) or not form or 'Qb_CocMaSatCMD' not in form: continue
        # Resolve IL from the source profile H:O at the row containing z.
        prof=[]
        for rr in range(12,26):
            top=v(bored_eq,f'H{rr}')
            if numeric(top): prof.append({'topDepthM':float(top),'IL':v(bored_eq,f'K{rr}'),'soil':v(bored_eq,f'I{rr}')})
        p=find_profile(prof,float(zval))
        if p and p.get('IL') is not None and str(p.get('soil','')).lower().find('sét')>=0:
            table8.append({'row':r,'depthM':float(zval),'IL':float(p['IL']),'qbKpa':float(q),'cell':f'F{r}','formula':form})
    # Keep a compact but boundary-spanning set, including exact/mid values.
    wanted=[]
    seen=set()
    for obs in table8:
        key=(obs['depthM'],obs['IL'])
        if key not in seen and obs['depthM'] in (4.0,5.0,6.0,9.0,10.0,11.0,12.0):
            wanted.append(obs);seen.add(key)
    table8=wanted

    # EQ gamma behavioral observations: resolve the seven UDF inputs from workbook profile.
    eq_cases=[]
    configs=[
        ('7.2.2-10304-Không moi đất EQ',41,'F','K',{'detail':'O','IL':'K','ground':'N'},23),
        ('7.2.3-10304-Có moi đất EQ',43,'E','J',{'detail':'Q','IL':'K','ground':'P'},25),
    ]
    for sname,start,gqcol,gfcol,cols,pend in configs:
        sh=sheet(sname); profile=[]
        for rr in range(12,pend+1):
            top=v(sh,f'H{rr}')
            if numeric(top):
                profile.append({'topDepthM':float(top),'soilDetail':v(sh,f"{cols['detail']}{rr}"),
                                'IL':v(sh,f"{cols['IL']}{rr}"),'groundType':v(sh,f"{cols['ground']}{rr}")})
        for r in range(start,170):
            zval=v(sh,f'B{r}'); gq=v(sh,f'{gqcol}{r}'); gf=v(sh,f'{gfcol}{r}')
            if not (numeric(zval) and numeric(gq) and numeric(gf)): continue
            p=find_profile(profile,float(zval)) or {}
            eq_cases.append({'sheet':sname,'row':r,'depthM':float(zval),'agR_G':v(sh,'D19'),
                             'loaiCat':p.get('soilDetail'),'tinhChat':p.get('soilDetail'),'IL':p.get('IL'),
                             'pileType':v(sh,'D12'),'groundType':p.get('groundType'),'spectrumType':v(sh,'D20'),
                             'gammaQb':float(gq),'gammaFi':float(gf),
                             'cellGammaQb':f'{gqcol}{r}','cellGammaFi':f'{gfcol}{r}',
                             'formulaGammaQb':f(sh,f'{gqcol}{r}'),'formulaGammaFi':f(sh,f'{gfcol}{r}')})
    # Deduplicate behavioral input/output tuples, retain source cells for traceability.
    dedup={}
    for c in eq_cases:
        key=json.dumps([c[k] for k in ('agR_G','loaiCat','tinhChat','IL','pileType','groundType','spectrumType','gammaQb','gammaFi')],ensure_ascii=False)
        if key not in dedup:
            dedup[key]={**c,'sources':[]}
            for x in ('sheet','row','cellGammaQb','cellGammaFi','formulaGammaQb','formulaGammaFi'): dedup[key].pop(x,None)
        dedup[key]['sources'].append({'sheet':c['sheet'],'row':c['row'],'gammaQbCell':c['cellGammaQb'],'gammaFiCell':c['cellGammaFi']})
    eq_unique=list(dedup.values())

    # Count actual UDF formula references in the workbook for audit scope.
    udf_names=['NoiSuySPT','GetKsFromRQD','qb_SPT2025','flu_SPT2025','GetQbBang8','TinhGammaqbCMS','TinhGammafiCMS','qbEQ_SPT2025','fluEQ_SPT2025']
    counts={name:0 for name in udf_names}
    formulas_by_sheet={}
    for sname in ['SPT 10304-2025','SPT 10304-2025 EQ','7.2.1-10304-Cọc Chống','7.2.2-10304-Không moi đất','7.2.2-10304-Không moi đất EQ','7.2.3-10304-Có moi đất','7.2.3-10304-Có moi đất EQ']:
        sh=sheet(sname); local={name:0 for name in udf_names}
        for cell in sh.values():
            formula=cell.get('formula') or ''
            for name in udf_names:
                n=formula.count('_xll.'+name)
                counts[name]+=n;local[name]+=n
        formulas_by_sheet[sname]={k:v for k,v in local.items() if v}

    result={
      'schema':'HNL_DCE_UDF_BEHAVIORAL_EVIDENCE_V1','hnlVersion':'1.25.7',
      'principle':'XLSM/XLL evidence is reference only; TCVN PDF remains normative authority.',
      'source':{'xlsm':str(xlsm),'xlsmSha256':sha256(xlsm)},
      'udfSignatures':{
        'NoiSuySPT':'NoiSuySPT(CaoDo, Range, MuiCoc, DKCoc, dDuoi, dTren)',
        'qb_SPT2025':'qb_SPT2025(LoaiCoc, DKNgoaiCoc, DKTrongCoc, CaoDo, MuiCoc, RangeDat, RangeSPT)',
        'flu_SPT2025':'flu_SPT2025(LoaiCoc, DKNgoaiCoc, DKTrongCoc, ChuViCoc, DauCoc, MuiCoc, RangeDat, RangeSPT, LayDauCoc, LayMuiCoc, OptionLay, sstlay, PhanTo)',
        'GetKsFromRQD':'GetKsFromRQD(RQD)',
        'GetQbBang8':'GetQbBang8(IL11, h22)',
        'TinhGammaqbCMS':'TinhGammaqbCMS(agR_G, loaiCat, tinhChat, Il, loaicoc, LoaiDatNen, LoaiPho)',
        'TinhGammafiCMS':'TinhGammafiCMS(agR_G, loaiCat, tinhChat, Il, loaicoc, LoaiDatNen, LoaiPho)'
      },
      'udfCallCounts':counts,'udfCallCountsBySheet':formulas_by_sheet,
      'sptScenario':{
        'sheet':'SPT 10304-2025','pileTypeDce':v(spt,'D10'),'shape':v(spt,'D11'),
        'diameterM':v(spt,'D12'),'innerTipDiameterM':v(spt,'D13'),'shaftStartDepthM':v(spt,'D15'),
        'tipDepthM':v(spt,'D16'),'segmentSizeM':v(spt,'D17'),'lengthM':v(spt,'D18'),
        'areaM2':v(spt,'D19'),'perimeterM':v(spt,'D20'),
        'QbKn':v(spt,'D21'),'fluAtHeadKn':v(spt,'D22'),'fluAtTipKn':v(spt,'D23'),'RkKn':v(spt,'D24'),
        'gammaN':v(spt,'D26'),'gammaK':v(spt,'D27'),'selfWeightKn':v(spt,'D29'),'finalWorkbookKn':v(spt,'D31'),
        'formulas':{k:f(spt,cell) for k,cell in {'Qb':'D21','fluAtHead':'D22','fluAtTip':'D23','Rk':'D24'}.items()},
        'soilLayers':soil_layers,'sptPoints':spt_points,'diagnostics':diagnostics
      },
      'rockKsDirectObservation':rock_obs,
      'table8IndirectObservations':table8,
      'eqGammaUniqueObservations':eq_unique,
      'evidenceStatus':{
        'signatures':'WHITE_BOX_CONTRACT_FROM_DCE_EXCEL_DLL',
        'cachedWorkbookBehavior':'RUNTIME_CACHED_REFERENCE',
        'exactProtectedMethodBody':'PARTIAL_WHITE_BOX_PROTECTED',
        'productionAuthority':'TCVN_PDF_AND_HNL_GOLDEN_ONLY'
      }
    }
    out.parent.mkdir(parents=True,exist_ok=True)
    out.write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf-8')
    print(f'Wrote {out}')
    print(json.dumps({'diagnosticRows':len(diagnostics),'sptPoints':len(spt_points),'eqUnique':len(eq_unique),'table8Indirect':len(table8),'udfCallCounts':counts},ensure_ascii=False,indent=2))

if __name__=='__main__': main()
