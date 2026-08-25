#!/usr/bin/env python3
from __future__ import annotations
import argparse, csv, hashlib, json, re, zipfile
from pathlib import Path
from xml.etree import ElementTree as ET
from collections import Counter, defaultdict

NS_MAIN={"m":"http://schemas.openxmlformats.org/spreadsheetml/2006/main"}
CELL_RE=re.compile(r"^([A-Z]{1,3})(\d+)$")
REF_RE=re.compile(r"(?:(?:'((?:[^']|'')+)'|([A-Za-z_][A-Za-z0-9_ .\-]*))!)?(\$?)([A-Z]{1,3})(\$?)(\d+)")
FUNC_RE=re.compile(r"(?<![A-Z0-9_\.])([A-Z_][A-Z0-9_\.]*)\s*\(",re.I)
SHEET_REF_RE=re.compile(r"(?:'((?:[^']|'')+)'|([A-Za-z_][A-Za-z0-9_ .\-]*))!")

def c2n(c):
    n=0
    for ch in c.upper():
        n=n*26+ord(ch)-64
    return n

def n2c(n):
    s=""
    while n:
        n,r=divmod(n-1,26); s=chr(65+r)+s
    return s

def shift_formula(formula, master_ref, target_ref):
    mm=CELL_RE.match(master_ref); tm=CELL_RE.match(target_ref)
    dc=c2n(tm.group(1))-c2n(mm.group(1))
    dr=int(tm.group(2))-int(mm.group(2))
    def repl(m):
        sheet=m.group(1) or m.group(2)
        abs_c=m.group(3)=="$"; abs_r=m.group(5)=="$"
        cc=c2n(m.group(4)); rr=int(m.group(6))
        if not abs_c: cc+=dc
        if not abs_r: rr+=dr
        pref=""
        if sheet is not None:
            pref=("'" + sheet + "'!" if m.group(1) is not None else sheet+"!")
        return pref+("$" if abs_c else "")+n2c(cc)+("$" if abs_r else "")+str(rr)
    return REF_RE.sub(repl,formula)

def relative_ref_token(abs_col, col, abs_row, row, base_col, base_row):
    c=c2n(col); r=int(row)
    ct=f"C{c}" if abs_col else ("C" if c==base_col else f"C[{c-base_col:+d}]")
    rt=f"R{r}" if abs_row else ("R" if r==base_row else f"R[{r-base_row:+d}]")
    return rt+ct

def normalize_formula(formula, cell_ref):
    cm=CELL_RE.match(cell_ref)
    bc,br=c2n(cm.group(1)),int(cm.group(2))
    def repl(m):
        sheet=m.group(1) or m.group(2)
        tok=relative_ref_token(m.group(3)=="$",m.group(4),m.group(5)=="$",m.group(6),bc,br)
        pref=""
        if sheet is not None:
            pref=("'" + sheet.replace("''","'") + "'!" if m.group(1) is not None else sheet+"!")
        return pref+tok
    x=REF_RE.sub(repl,formula)
    return re.sub(r"\s+","",x).upper()

def fingerprint(norm):
    return hashlib.sha256(norm.encode()).hexdigest()[:20]

def sheet_refs(formula):
    out=[]
    for m in SHEET_REF_RE.finditer(formula):
        s=(m.group(1) or m.group(2))
        if s: out.append(s.replace("''","'"))
    return sorted(set(out))

def functions(formula):
    return sorted(set(x.upper() for x in FUNC_RE.findall(formula)))

def classify(formula, funcs, refs):
    u=formula.upper()
    # exact workbook-specific evidence first
    if "NHOMCOC" in funcs:
        return "STATUS", ["NHOMCOC_VBA_UDF"]
    if any(x in funcs for x in ["VLOOKUP","INDEX","MATCH","XLOOKUP","HLOOKUP","SUMIFS","COUNTIFS"]):
        return "JOIN", ["LOOKUP_JOIN"]
    # Column-independent semantic patterns
    if re.search(r"\bIFERROR\s*\(\s*[^,]+/[^,]+",u) or re.search(r"\b1\s*/",u):
        return "UTILIZATION", ["RATIO_OR_RECIPROCAL"]
    if any(t in u for t in ['"NOT OK"','"OK"','"PASS"','"FAIL"','"BLOCK"']):
        return "STATUS", ["STATUS_TEXT"]
    if "FZ" in u or any(x in u for x in ["FX","FY","MX","MY","MZ"]):
        return "ACTION", ["ACTION_TOKEN"]
    if any(x in u for x in ["RD","RPILE","CAPACITY","PCOC","SCT"]):
        return "CAPACITY", ["CAPACITY_TOKEN"]
    return "UNCLASSIFIED", []

def workbook_sheet_targets(z):
    wb=ET.fromstring(z.read("xl/workbook.xml"))
    rel=ET.fromstring(z.read("xl/_rels/workbook.xml.rels"))
    relmap={}
    for x in rel:
        t=x.attrib.get("Target","")
        if t.startswith("/"): t=t.lstrip("/")
        elif not t.startswith("xl/"): t="xl/"+t
        relmap[x.attrib["Id"]]=t
    out={}
    for sh in wb.find("m:sheets",NS_MAIN):
        rid=sh.attrib["{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id"]
        out[sh.attrib["name"]]=relmap[rid]
    return out

def extract(path,sheet):
    with zipfile.ZipFile(path) as z:
        target=workbook_sheet_targets(z)[sheet]
        root=ET.fromstring(z.read(target))
        masters={}
        for c in root.findall(".//m:c",NS_MAIN):
            f=c.find("m:f",NS_MAIN)
            if f is not None and f.attrib.get("t")=="shared" and f.text:
                masters[f.attrib["si"]]={"cell":c.attrib["r"],"formula":f.text,"ref":f.attrib.get("ref")}
        rows=[]
        for c in root.findall(".//m:c",NS_MAIN):
            f=c.find("m:f",NS_MAIN)
            if f is None: continue
            formula=f.text or ""
            shared_si=f.attrib.get("si") if f.attrib.get("t")=="shared" else None
            shared_master=False
            if f.attrib.get("t")=="shared":
                if formula:
                    shared_master=True
                else:
                    m=masters[shared_si]
                    formula=shift_formula(m["formula"],m["cell"],c.attrib["r"])
            v=c.find("m:v",NS_MAIN)
            norm=normalize_formula(formula,c.attrib["r"])
            funcs=functions(formula)
            refs=sheet_refs(formula)
            block,reasons=classify(formula,funcs,refs)
            rows.append({
                "cell":c.attrib["r"],
                "formula":formula,
                "normalizedFormula":norm,
                "fingerprint":fingerprint(norm),
                "cachedValue":None if v is None else v.text,
                "sharedSi":shared_si,
                "sharedMaster":shared_master,
                "functions":funcs,
                "dependencySheets":refs,
                "block":block,
                "classificationReasons":reasons
            })
        return rows,masters

def summarize(rows,masters):
    groups=defaultdict(list)
    for r in rows: groups[r["fingerprint"]].append(r)
    fps=[]
    for fp,items in sorted(groups.items(),key=lambda kv:(-len(kv[1]),kv[0])):
        bc=Counter(x["block"] for x in items)
        fps.append({
            "fingerprint":fp,"count":len(items),
            "blockMajority":bc.most_common(1)[0][0],
            "blockCounts":dict(bc),
            "sampleCells":[x["cell"] for x in items[:12]],
            "normalizedFormula":items[0]["normalizedFormula"],
            "functions":sorted(set(f for x in items for f in x["functions"])),
            "dependencySheets":sorted(set(s for x in items for s in x["dependencySheets"]))
        })
    return {
        "formulaCellCount":len(rows),
        "uniqueFingerprints":len(fps),
        "sharedFormulaGroups":len(masters),
        "sharedFormulaFollowers":sum(1 for r in rows if r["sharedSi"] is not None and not r["sharedMaster"]),
        "blockCounts":dict(Counter(r["block"] for r in rows)),
        "functionCounts":dict(Counter(f for r in rows for f in r["functions"])),
        "fingerprints":fps
    }

def main():
    ap=argparse.ArgumentParser()
    ap.add_argument("workbook"); ap.add_argument("--sheet",default="TM SCT Coc"); ap.add_argument("--out-dir",required=True)
    a=ap.parse_args()
    path=Path(a.workbook); out=Path(a.out_dir); out.mkdir(parents=True,exist_ok=True)
    rows,masters=extract(path,a.sheet); s=summarize(rows,masters)
    (out/"tm-sct-coc-cell-inventory.json").write_text(json.dumps(rows,ensure_ascii=False,indent=2),encoding="utf-8")
    with (out/"tm-sct-coc-cell-inventory.csv").open("w",newline="",encoding="utf-8-sig") as f:
        w=csv.writer(f); w.writerow(["cell","block","fingerprint","cachedValue","sharedSi","functions","dependencySheets","formula","normalizedFormula"])
        for r in rows:
            w.writerow([r["cell"],r["block"],r["fingerprint"],r["cachedValue"],r["sharedSi"]," | ".join(r["functions"])," | ".join(r["dependencySheets"]),r["formula"],r["normalizedFormula"]])
    (out/"tm-sct-coc-fingerprints.json").write_text(json.dumps(s["fingerprints"],ensure_ascii=False,indent=2),encoding="utf-8")
    compact={k:v for k,v in s.items() if k!="fingerprints"}
    compact.update({"sheet":a.sheet,"workbook":path.name,"workbookSha256":hashlib.sha256(path.read_bytes()).hexdigest()})
    (out/"tm-sct-coc-fingerprint-summary.json").write_text(json.dumps(compact,ensure_ascii=False,indent=2),encoding="utf-8")
    print(json.dumps(compact,ensure_ascii=False,indent=2))
if __name__=="__main__": main()
