# HNL Pile Standards AI v1.24.0 — Image-to-Engineering Audit

## Phạm vi
- Baseline: v1.23.0 ZIP Full E2E Golden Audit.
- Không sửa `src/search.js`.
- Mục tiêu: Text + ảnh → OCR hint/Vision → structured engineering input → user confirmation → deterministic engine → Excel.

## Root cause trước sửa
1. Ảnh đã được gửi vào AI Vision, nhưng `solveEngineeringQuestion(question)` chạy từ text chat trước khi dữ liệu trong ảnh được cấu trúc.
2. Gemini/OpenAI/Ollama có thể nhìn thấy số trong ảnh nhưng Calculation Engine không có guarantee dùng cùng số.
3. Không có confirmation gate cho số OCR/Vision mờ.
4. Ô chat chưa có attachment/paste/drop riêng.
5. Cụm “tiết diện trong ảnh” có thể match nhầm regex `tiet dien tron` của workflow tiết diện tròn.
6. AI answer Excel chip còn loại TCVN 7888 trong `messageHtml` dù exporter đã hỗ trợ.
7. Excel workflow chưa lưu provenance của các giá trị lấy từ ảnh đã được người dùng xác nhận.

## Sửa
- `src/image-engineering.js`: schema, prompt chống prompt-in-image, parse JSON, confidence, provenance, canonicalization.
- `src/main.js`: ảnh đính kèm, paste/drop, OCR cục bộ, Vision extraction, review UI, edit/confirm, extra image context, provenance trong engineering metadata.
- `src/styles.css`: attachment strip + confirmation panel responsive.
- `src/engineering-router.js`: boundary fix cho `tiet dien tron`.
- `src/excel-export.js`: thêm sheet `08_NGUON_ANH` cho mọi workbook engineering và ghi đúng nguồn ảnh/xác nhận; không giả là giá trị tra tiêu chuẩn.
- `tests/v1.24.0.test.mjs`: Golden Image cho cả 3 tiêu chuẩn.

## Safety
- Không có field ảnh nào vào Calculation Engine trước `Xác nhận & tính`.
- Low confidence/null được đánh dấu; prompt cấm suy đoán chữ số khuất/mờ.
- OCR cục bộ chỉ là hint, không phải nguồn truth.
- AI Vision không tính số; deterministic engine vẫn là nguồn số học duy nhất.
- Excel kế thừa provenance ảnh đã xác nhận từ message engineering metadata.

## Hạn chế kiểm thử cần công bố
- Live Vision accuracy với Gemini/OpenAI/Ollama: **NOT RUN** trong sandbox hiện tại vì không có provider/model Vision được xác thực bằng API.
- Unit/integration Golden Image dùng structured Vision mock + ảnh fixture thật để kiểm pipeline, router, safety gate và deterministic math.
- Regression cuối: **250/250 PASS, 0 FAIL**.
- Version Gate: **PASS v1.24.0**.
- Search Brain Guard: **PASS**, normalized SHA-256 `f9b65e5e6fb61dcca233a4fe43950e3174c73536f2fa83452da3041fbd0021d2`.
- `.gitattributes` vẫn ép `src/search.js text eol=lf`; Windows/Linux line endings không làm FAIL giả.
- Secret scan các pattern Gemini/OpenAI/GitHub token: **0 file hit**.
- `npm run build:web`: **BLOCKED**, exit 127 vì `vite: not found` trong sandbox hiện tại; không ghi PASS.
- Windows Setup/Portable EXE: **NOT RUN** trong sandbox; phải chạy GitHub Actions Windows sau khi source được đẩy lên repo.

## Golden Image v1.24.0
1. **TCVN 7888:2014** — ảnh PHC D600-B, L=20 m, σcu=80 MPa → confirmation → workflow `7888-material` → `Ra dài hạn = 3007.581286966663 kN`, `Pmax = 4812.130059146661 kN`.
2. **TCVN 10304:2025** — ảnh cọc vuông 400×400, L=12 m, đóng, hai lớp sét IL=0,5/0,3 → confirmation → `10304-driven` → giữ đúng IL theo từng lớp và trả numeric Rk.
3. **TCVN 5574:2018** — ảnh B30, CB400-V, b=300, h0=550, As=1800, M=200 → confirmation → `5574-bending-rect` → numeric Mu.

Các fixture PNG dùng để smoke-test live Vision đã nằm tại `tests/fixtures/image-golden-*.png`. Chúng chỉ là bộ đầu vào kiểm thử; **không được dùng để tuyên bố độ chính xác Vision live khi chưa chạy provider thật**.
