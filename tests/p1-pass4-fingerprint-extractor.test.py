import json, subprocess, sys, tempfile
from pathlib import Path

root = Path(__file__).resolve().parents[1]
tool = root/"tools"/"tm_sct_coc_formula_fingerprint.py"
fixture = Path("/mnt/data/HNL_P1_Pass4_TM_SCT_Coc_Pattern_REVIEW_v5.xlsx")

with tempfile.TemporaryDirectory() as td:
    p = subprocess.run(
        [sys.executable, str(tool), str(fixture), "--sheet", "IMPORTED_CHECK", "--out-dir", td],
        text=True, capture_output=True
    )
    assert p.returncode == 0, p.stderr
    s = json.loads((Path(td)/"tm-sct-coc-fingerprint-summary.json").read_text(encoding="utf-8"))
    assert s["formulaCellCount"] > 0
    assert s["uniqueFingerprints"] > 0
    assert sum(s["blockCounts"].values()) == s["formulaCellCount"]
print("fingerprint extractor self-test PASS")
