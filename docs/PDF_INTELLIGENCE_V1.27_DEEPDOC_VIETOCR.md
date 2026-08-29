# HNL v1.27.0 — DeepDoc + VietOCR Shadow Adapter

## Mục tiêu

Đánh giá `hoaivannguyen/deepdoc_vietocr` như một engine **OCR tiếng Việt + layout + table structure** cho PDF scan/mixed của HNL. Đây là shadow track, không thay Production PDF.js, Search Brain hay Calculation Engine.

## Nguồn tham khảo đã audit

Repo ngoài: `hoaivannguyen/deepdoc_vietocr`.

README mô tả:
- OCR: text detection kiểu DeepDoc/Paddle OCR ONNX, recognition được thay bằng VietOCR.
- Layout Recognizer: Text, Title, Image, Image Caption, Table, Table Caption, Header, Footer, Reference, Equation.
- Table Structure Recognizer: Column, Row, Column header, Projected row header, Spanning cell.
- CPU/ONNX là đường chạy mục tiêu.

HNL KHÔNG copy source/model repo này vào gói. Adapter chỉ gọi một clone ngoài thông qua `HNL_DEEPDOC_HOME`.

## Cảnh báo confidence

Ở source hiện tại, `TextRecognizer.__call__()` trả `(text, 1.0)` cho từng kết quả VietOCR. Vì vậy HNL đánh dấu:

`recognizerConfidenceUsable = false`

Không được dùng score 1.0 này làm confidence thật để tự VERIFIED công thức/bảng/số liệu.

## License boundary

Root repo được audit không thấy `LICENSE` trong listing. Nhiều file DeepDoc/InfiniFlow có header Apache-2.0, nhưng điều đó chưa đủ để HNL kết luận toàn bộ repo/model/weights có cùng license.

Trạng thái HNL:

`REVIEW_EXTERNAL_REPO_NO_ROOT_LICENSE_VERIFIED`

Do đó P0/P2:
- không vendor `module/`, `onnx/`, `vietocr/`, weights hoặc model;
- không redistribute third-party code/model;
- chỉ benchmark qua clone ngoài do người phát triển cài riêng.

## File HNL

- `src/pdf-intelligence/deepdoc-vietocr-adapter.js`
  - Node/Desktop-only.
  - Controlled unavailable state khi chưa cài clone/Python.
  - Gọi runner qua subprocess, temp PDF, JSON result.
  - Không cho production mutation.

- `offline/pdf-intelligence/deepdoc_vietocr_runner.py`
  - Import external repo bằng `--deepdoc-home`.
  - Raster PDF theo trang được chọn.
  - OCR tiếng Việt.
  - Layout detection.
  - TSR chỉ trong vùng được nhận diện là Table.
  - Trả page/bbox/text/layout/table structure JSON để HNL lưu provenance.

- `scripts/deepdoc-vietocr-selftest.mjs`
  - Kiểm contract và controlled-missing-runtime.

- `scripts/pdf-intelligence-deepdoc-benchmark.mjs`
  - HNL PDF.js chạy trước.
  - Mặc định chỉ gửi `pagesNeedingOcr` sang DeepDoc/VietOCR.
  - `--force-all` chỉ dùng benchmark, không phải Production policy.

## Cài engine ngoài để benchmark

Không chạy trong v1.26 release branch. Trên branch v1.27 riêng:

```bash
git clone https://github.com/hoaivannguyen/deepdoc_vietocr.git <THU_MUC_NGOAI_HNL>
cd <THU_MUC_NGOAI_HNL>
python -m venv .venv
# activate .venv
pip install -r requirements.txt
```

Sau đó trỏ HNL tới clone ngoài:

Windows PowerShell:

```powershell
$env:HNL_DEEPDOC_HOME="D:\AI\deepdoc_vietocr"
$env:HNL_PYTHON="D:\AI\deepdoc_vietocr\.venv\Scripts\python.exe"
```

Linux/macOS:

```bash
export HNL_DEEPDOC_HOME=/opt/ai/deepdoc_vietocr
export HNL_PYTHON=/opt/ai/deepdoc_vietocr/.venv/bin/python
```

## Selftest

```bash
node scripts/deepdoc-vietocr-selftest.mjs
python offline/pdf-intelligence/deepdoc_vietocr_runner.py --probe --deepdoc-home "$HNL_DEEPDOC_HOME"
```

## Benchmark corpus

```bash
node scripts/pdf-intelligence-deepdoc-benchmark.mjs \
  --dir ./benchmark-pdfs \
  --probe "cọc chống" \
  --probe "TCVN 10304:2025" \
  --probe "Bảng 6"
```

Output:

`artifacts/pdf-intelligence/deepdoc-vietocr-shadow.json`

## Routing policy

Production hiện tại vẫn là:

`PDF.js native → current HNL OCR/Vision fallback`

Shadow benchmark:

`PDF.js native classification → pagesNeedingOcr ONLY → DeepDoc/VietOCR OCR + Layout + TSR → evidence JSON`

Không OCR lại trang PDF.js đã đánh giá tốt trừ khi dùng `--force-all` trong benchmark.

## P2 Golden acceptance trước khi nối UI/runtime

1. >= 6 PDF thật, gồm text + scan + mixed.
2. Có ít nhất một TCVN tiếng Việt scan khó.
3. So đúng số trang nguồn 100%.
4. Các probe kỹ thuật: `cọc chống`, số điều, số bảng, TCVN code không regression.
5. Audit số liệu: số thập phân, dấu phẩy/chấm, đơn vị kPa/MPa/kN/mm/m.
6. Table Golden: hàng/cột/header/spanning cell trên bảng thật.
7. Equation regions không được tự coi là formula parsed/VERIFIED.
8. OCR confidence synthetic 1.0 không được dùng làm confidence thật.
9. Windows CPU benchmark RAM/thời gian phải đạt ngưỡng chấp nhận.
10. License/model provenance phải CLOSED trước redistribution.
11. Search Brain v1.9.23 hash không đổi.
12. Calculation/Excel Golden hiện hành vẫn xanh.

## Pass tiếp theo

- P3: region-selective OCR từ vùng người dùng kéo chọn.
- P4: Layout → Điều/Bảng/Công thức chunker.
- P5: provenance `fingerprint → page → bbox → engine → OCR/native`.
- P6: Formula image/Math OCR benchmark riêng.
- P7: Windows sidecar lifecycle + installer optional component.
- P8: promotion decision; chỉ promote từng capability đã Golden, không promote nguyên engine một lần.

## Git LFS model gate

Repo dùng Git LFS cho các model ONNX/weights. Chỉ `git clone` chưa chắc đã có model thật. Runner kiểm các file `onnx/det.onnx`, `onnx/layout.onnx`, `onnx/tsr.onnx`, `vietocr/weight/vgg_seq2seq.pth`; nếu phát hiện nội dung pointer `git-lfs.github.com/spec`, HNL trả:

`DEEPOCR_GIT_LFS_MODELS_NOT_PULLED`

Cách khắc phục trong clone ngoài:

```bash
git lfs install
git lfs pull
```

Không được coi runtime `available` trước khi model thật và Python dependencies đều sẵn sàng.
