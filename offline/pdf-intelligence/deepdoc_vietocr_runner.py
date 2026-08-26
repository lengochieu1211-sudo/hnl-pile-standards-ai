#!/usr/bin/env python3
"""HNL shadow adapter runner for an EXTERNAL deepdoc_vietocr clone.

No DeepDoc/VietOCR source or model is bundled here. The external repository path
must be supplied with --deepdoc-home / HNL_DEEPDOC_HOME.
"""
from __future__ import annotations

import argparse
import json
import os
import sys
import time
from pathlib import Path


def emit(payload, output_json=None):
    text = json.dumps(payload, ensure_ascii=False, indent=2)
    if output_json:
        Path(output_json).parent.mkdir(parents=True, exist_ok=True)
        Path(output_json).write_text(text + "\n", encoding="utf-8")
    else:
        sys.stdout.write(text + "\n")


def _is_lfs_pointer(path: Path):
    if not path.exists() or not path.is_file():
        return False
    try:
        if path.stat().st_size > 1024:
            return False
        head = path.read_bytes()[:256]
        return b"git-lfs.github.com/spec" in head
    except Exception:
        return False


def repo_probe(home: Path):
    required = [
        home / "module" / "__init__.py",
        home / "module" / "ocr.py",
        home / "module" / "layout_recognizer.py",
        home / "module" / "table_structure_recognizer.py",
        home / "requirements.txt",
    ]
    required_models = [
        home / "onnx" / "det.onnx",
        home / "onnx" / "layout.onnx",
        home / "onnx" / "tsr.onnx",
        home / "vietocr" / "weight" / "vgg_seq2seq.pth",
    ]
    missing = [str(p.relative_to(home)) for p in required + required_models if not p.exists()]
    lfs_pointers = [str(p.relative_to(home)) for p in required_models if _is_lfs_pointer(p)]

    dependency_modules = {
        "numpy": "numpy",
        "cv2": "opencv-python",
        "onnxruntime": "onnxruntime",
        "torch": "torch",
        "PIL": "Pillow",
        "pdfplumber": "pdfplumber",
        "huggingface_hub": "huggingface_hub",
        "shapely": "shapely",
        "pyclipper": "pyclipper",
        "ruamel.yaml": "ruamel.yaml",
        "cachetools": "cachetools",
    }
    missing_python = []
    import importlib.util
    for module_name, package_name in dependency_modules.items():
        try:
            found = importlib.util.find_spec(module_name) is not None
        except Exception:
            found = False
        if not found:
            missing_python.append(package_name)

    code = None
    message = "External deepdoc_vietocr runtime is structurally ready."
    if missing:
        code = "DEEPOCR_EXTERNAL_REPO_INCOMPLETE"
        message = "Missing: " + ", ".join(missing)
    elif lfs_pointers:
        code = "DEEPOCR_GIT_LFS_MODELS_NOT_PULLED"
        message = "Git LFS model pointers detected: " + ", ".join(lfs_pointers) + ". Run git lfs pull in the external clone."
    elif missing_python:
        code = "DEEPOCR_PYTHON_DEPENDENCIES_MISSING"
        message = "Missing Python packages: " + ", ".join(missing_python)

    available = code is None
    return {
        "available": available,
        "code": code,
        "message": message,
        "deepdocHome": str(home),
        "missing": missing,
        "lfsPointers": lfs_pointers,
        "missingPythonPackages": missing_python,
        "licenseState": "REVIEW_EXTERNAL_REPO_NO_ROOT_LICENSE_VERIFIED",
        "bundlesThirdPartyCode": False,
        "targetRuntime": "windows-desktop-first",
    }


def selected_pages(page_count: int, spec: str | None):
    if not spec:
        return list(range(1, page_count + 1))
    result = []
    for token in spec.split(","):
        token = token.strip()
        if not token:
            continue
        if "-" in token:
            left, right = token.split("-", 1)
            a, b = int(left), int(right)
            result.extend(range(min(a, b), max(a, b) + 1))
        else:
            result.append(int(token))
    return sorted({p for p in result if 1 <= p <= page_count})


def bbox_from_quad(quad):
    pts = list(quad)
    xs = [float(p[0]) for p in pts]
    ys = [float(p[1]) for p in pts]
    return [min(xs), min(ys), max(xs), max(ys)]


def normalize_layout(region):
    bbox = region.get("bbox")
    if bbox is None:
        bbox = [region.get("x0", 0), region.get("top", 0), region.get("x1", 0), region.get("bottom", 0)]
    return {
        "type": str(region.get("type", region.get("label", "unknown"))),
        "bbox": [float(x) for x in bbox],
        "score": float(region.get("score", 0.0)) if region.get("score") is not None else None,
    }


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--deepdoc-home", default=os.environ.get("HNL_DEEPDOC_HOME", ""))
    parser.add_argument("--probe", action="store_true")
    parser.add_argument("--input")
    parser.add_argument("--output-json")
    parser.add_argument("--pages", default="")
    parser.add_argument("--threshold", type=float, default=0.5)
    parser.add_argument("--dpi", type=int, default=216)
    parser.add_argument("--no-tsr", action="store_true")
    args = parser.parse_args()

    home = Path(args.deepdoc_home).expanduser().resolve() if args.deepdoc_home else None
    if home is None:
        emit({"available": False, "code": "HNL_DEEPDOC_HOME_NOT_SET", "message": "--deepdoc-home is required."}, args.output_json)
        return 2
    probe = repo_probe(home)
    if args.probe:
        emit(probe, args.output_json)
        return 0 if probe["available"] else 3
    if not probe["available"]:
        emit(probe, args.output_json)
        return 3
    if not args.input:
        emit({"available": False, "code": "INPUT_REQUIRED", "message": "--input is required."}, args.output_json)
        return 2

    # External dependency boundary: import only from the user-provided clone.
    sys.path.insert(0, str(home))
    os.environ.setdefault("CUDA_VISIBLE_DEVICES", "")

    try:
        import numpy as np
        import pdfplumber
        from PIL import Image
        from module.ocr import OCR
        from module import LayoutRecognizer, TableStructureRecognizer
    except Exception as exc:
        emit({"available": False, "code": "DEEPOCR_IMPORT_FAILED", "message": repr(exc), "deepdocHome": str(home)}, args.output_json)
        return 4

    input_path = Path(args.input).resolve()
    started = time.perf_counter()
    images = []
    page_numbers = []
    source_page_count = 1

    if input_path.suffix.lower() == ".pdf":
        with pdfplumber.open(str(input_path)) as pdf:
            source_page_count = len(pdf.pages)
            wanted = selected_pages(source_page_count, args.pages)
            for page_number in wanted:
                # Match DeepDoc's own IO path: rasterize PDF pages before OCR/layout.
                page_img = pdf.pages[page_number - 1].to_image(resolution=args.dpi).annotated.convert("RGB")
                images.append(page_img)
                page_numbers.append(page_number)
    else:
        source_page_count = 1
        images = [Image.open(str(input_path)).convert("RGB")]
        page_numbers = [1]

    layout_recognizer = LayoutRecognizer("layout")
    ocr = OCR()
    tsr = None if args.no_tsr else TableStructureRecognizer()
    pages_out = []

    for image, page_number in zip(images, page_numbers):
        np_image = np.array(image)
        raw_ocr = list(ocr(np_image))
        ocr_lines = []
        for box, text_meta in raw_ocr:
            text = text_meta[0] if text_meta else ""
            if not text:
                continue
            ocr_lines.append({
                "text": str(text),
                "bbox": bbox_from_quad(box),
                # Current repo's TextRecognizer emits 1.0 for every recognition.
                "score": float(text_meta[1]) if len(text_meta) > 1 else 1.0,
                "scoreSemantics": "synthetic-current-deepdoc-vietocr",
            })

        layouts = [normalize_layout(r) for r in layout_recognizer.forward([image], thr=float(args.threshold))[0]]
        table_structures = []
        if tsr is not None:
            for region in layouts:
                if region["type"].lower() != "table" or not region["bbox"]:
                    continue
                x0, y0, x1, y1 = [max(0, int(round(v))) for v in region["bbox"]]
                if x1 <= x0 or y1 <= y0:
                    continue
                crop = image.crop((x0, y0, x1, y1))
                components = tsr([crop], thr=float(args.threshold))[0]
                table_structures.append({
                    "bbox": region["bbox"],
                    "components": [normalize_layout(c) for c in components],
                })

        pages_out.append({
            "page": page_number,
            "width": image.width,
            "height": image.height,
            "text": "\n".join(line["text"] for line in ocr_lines),
            "ocrLines": ocr_lines,
            "layouts": layouts,
            "tableStructures": table_structures,
        })

    payload = {
        "available": True,
        "engine": "deepdoc-vietocr-external",
        "sourcePageCount": source_page_count,
        "processedPages": page_numbers,
        "threshold": args.threshold,
        "dpi": args.dpi,
        "elapsedMs": round((time.perf_counter() - started) * 1000, 3),
        "pages": pages_out,
        "meta": {
            "deepdocHome": str(home),
            "thirdPartyBundled": False,
            "recognizerConfidenceUsable": False,
            "licenseState": "REVIEW_EXTERNAL_REPO_NO_ROOT_LICENSE_VERIFIED",
        },
    }
    emit(payload, args.output_json)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
