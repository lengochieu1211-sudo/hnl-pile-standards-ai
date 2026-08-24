# HNL Pile Standards AI v1.25.0 — Unified Production Excel Exporter

## Mục tiêu
Khóa một chuẩn Excel Production duy nhất cho toàn bộ workflow kỹ thuật của TCVN 7888:2014, TCVN 10304:2025 và TCVN 5574:2018.

## Thay đổi
- Template chuẩn: `public/templates/HNL-Engineering-Calculator-Production-v1.25.0-FULL-VI.xlsx`.
- AI/Calculation Engine gọi `exportUnifiedEngineeringWorkbook()` cho mọi workflow 7888/10304/5574 đủ điều kiện.
- Workbook giữ tiếng Việt có dấu, biểu đồ, Golden Test, provenance và sheet dữ liệu ảnh.
- Lần xuất hiện tại được chèn vào đúng sheet workflow dưới dạng audit trail deterministic.
- REVIEW/INDEXED bị khóa numeric export; Search Brain không thay đổi.

## Build gate
Phải chạy `npm test`, `npm run build:web`, sau đó Windows Setup/Portable trước Release Candidate.
