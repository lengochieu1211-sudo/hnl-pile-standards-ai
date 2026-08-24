# HNL Pile Standards AI v1.25.2

## Lean Workbook Audit + True Recalculation
- Một workflow → một workbook lean, chỉ chứa sheet liên quan.
- Kết quả tính là công thức Excel, không chép số HNL thành kết quả chết.
- TCVN 7888 tra Bảng 1/2 động theo Loại/Cấp/D.
- TCVN 5574 D/L/M không mang sheet Benchmark QA vào file người dùng.
- REVIEW/INDEXED vẫn khóa numeric export.

## Gate
`npm test` phải PASS trước GitHub/build.
Build Web/Windows phải chạy lại sau khi dependencies được cài sạch.
