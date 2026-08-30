# HNL Pile Standards AI v1.27.0

Release date: **2026-08-30**  
Certification Stage: **MASTER_SYSTEM_AUDIT**  
Golden Baseline: **1.25.7**  
Search Brain: **1.9.23 LOCKED**

## Release scope

1. App Version chính thức thống nhất **1.27.0** cho Web, Desktop, PWA, EXE và build metadata.
2. P4 PDF/Image → Excel Intelligence đã được merge vào main nhưng tiếp tục **SHADOW_ONLY / REVIEW-first**; OCR/Vision chưa người dùng xác nhận không được đi thẳng vào Calculation Engine.
3. Excel Production: tên sheet và dropdown user-facing bằng tiếng Việt; mã kỹ thuật nội bộ giữ trong **99_MA_NOI_BO** ở trạng thái veryHidden.
4. Excel legacy compatibility: workbook Production được hậu xử lý để loại LET/XLOOKUP/LAMBDA/SWITCH/IFS khỏi các workflow đã được runtime-certify; công thức legacy vốn không cần đổi được giữ nguyên.
5. Master Audit **--enforce-all** phải PASS; release-sync, source-sync, regression, Full Table Golden, workflow/material/DCE/SPT/E2E/Multi-borehole Golden và Excel smoke đều là release gate.

## Safety / provenance

- Không sửa Search Brain v1.9.23.
- Không sửa Calculation Engine trong pass Excel compatibility/version promotion.
- P3.2 vẫn là **BENCHMARKED**, không được ghi thành full formula/table VERIFIED.
- P4_PROMOTION_STATE vẫn **SHADOW_ONLY**; release v1.27.0 không đồng nghĩa tự động cho phép production mutation từ dữ liệu OCR/Vision.

## Version policy

Chỉ **appVersion = 1.27.0** là version sản phẩm hiện hành. Golden Baseline, Search Brain version và các Pass/P-stage là danh tính bằng chứng hoặc nhãn kiểm toán, không phải version ứng dụng song song.
