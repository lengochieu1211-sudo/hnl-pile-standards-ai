# HNL P4 · Production Promotion Evidence Gate · v1.27

Baseline source: `main@42139bb2bc889eb329c7fc1813f50c1124b26472`  
Product version: **1.27.0**  
Current P4 state: **SHADOW_ONLY / REVIEW-first**

## Mục tiêu của pass

Pass này **không** bật quyền ghi production và **không** nối P4 trực tiếp vào Calculation Engine. Mục tiêu là đóng bằng chứng còn thiếu để quyết định một promotion có kiểm soát cho **Excel export sau REVIEW** mà vẫn giữ Calculation Engine mutation = false.

## Evidence đã có

- P4 source/original-source selftest: PASS 8/8.
- P4 safety/runtime tests: PASS 18/18.
- Runtime Golden trên Chromium/Windows: PASS 5/5.
- Full regression hiện được khóa ở 592 = 574 baseline + 18 P4.
- Web/Desktop/RC Final v1.27.0 đã được chứng nhận trên `main@42139bb2...`.
- Search Brain `1.9.23` vẫn LOCKED.
- `productionMutationAllowed=false` và `calculationEngineMutationAllowed=false` vẫn là hard barrier trong P4 packet/export plan.

## Khoảng trống phải đóng trước khi promotion

1. **Current-main evidence**  
   Runtime Golden lịch sử P4 có source SHA `f40fb68e...`; cần evidence mới gắn với current branch/main ancestry `42139bb2...` hoặc exact promotion head, không chỉ tái dùng evidence cũ.

2. **Explicit confirmation contract**  
   Phải định nghĩa machine-readable contract cho việc người dùng xác nhận OCR/Vision: xác nhận cái gì, nguồn nào, page/bbox nào, giá trị nào, thời điểm nào; không được chỉ dựa vào một boolean không có provenance.

3. **Failure-mode matrix**  
   Gate phải chứng minh HOLD/BLOCK đúng cho ít nhất: confidence thấp, nhiều giá trị cùng ký hiệu, sourceSha thiếu/stale, bbox/page thiếu, provenance không đầy đủ, formula độc hại/external, input mapping không an toàn, P3.2 chỉ BENCHMARKED.

4. **Scope separation**  
   Nếu promotion được phép, phạm vi tối đa của pass này là `REVIEW_PRODUCTION_EXPORT`: người dùng review/xác nhận rồi mới xuất workbook production. `calculationEngineMutationAllowed` vẫn phải **false**. Quyền ghi Calculation Engine là một engineering pass riêng.

5. **No bootstrap from P3.2**  
   P3.2 vẫn **BENCHMARKED**. Không được dùng trạng thái P3.2 để tự nâng P4 thành VERIFIED.

6. **Exact-head certification**  
   Promotion chỉ được xem xét trên exact PR head khi audit gate, P4 Runtime Golden, exact 592 regression, build Web/Desktop, Search Brain lock và provenance checks đều `completed / success`.

## Promotion state đề xuất

Không dùng chuyển đổi nhị phân `SHADOW_ONLY -> PRODUCTION`.

Mục tiêu an toàn hơn:

- `SHADOW_ONLY`: hiện tại.
- `REVIEW_PRODUCTION_EXPORT`: có thể xuất workbook production **sau xác nhận có provenance**, nhưng không mutate Calculation Engine.
- `CALCULATION_ENGINE_ELIGIBLE`: **ngoài phạm vi pass này**, chỉ mở sau engineering verification riêng.

## Hard locks

- Không sửa `src/search.js`.
- Không sửa Calculation Engine modules.
- Không hạ exact test count 592.
- Không đổi `P4_PROMOTION_STATE` cho tới khi promotion audit báo `READY` trên exact head.
- Queued/in_progress không tính PASS.

## Gate outcome ban đầu

**HOLD** — Runtime Golden đã đủ để tiếp tục audit, nhưng chưa đủ bằng chứng để bật production authority.
