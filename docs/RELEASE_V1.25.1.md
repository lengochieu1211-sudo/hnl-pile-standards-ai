# HNL Pile Standards AI v1.25.1

## Lean Export + Formula-Only Production

## Gate
- Một đề bài chỉ xuất workbook của workflow liên quan.
- Không đưa sheet Golden Test vào workbook người dùng trừ khi exporter workflow chủ động có benchmark phục vụ đối chiếu nội bộ của chính workflow.
- Kết quả tính phải là công thức Excel liên kết input/bảng tra.
- Không chép `payload.result` thành giá trị chết trong sheet Production.
- REVIEW/INDEXED không được xuất số học.
- Image provenance chỉ thêm khi có dữ liệu ảnh đã xác nhận.

## Kiến trúc
`exportUnifiedEngineeringWorkbook()` là cổng duy nhất từ UI, nhưng dispatch sang generator công thức chuyên biệt:
7888 → `export7888WorkflowWorkbook`
10304 driven → `exportDrivenPileWorkflowWorkbook`
10304 còn lại → `export10304AdvancedWorkflowWorkbook`
5574 → `export5574WorkflowWorkbook`
