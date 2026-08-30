# HNL v1.27.0 — Master System Audit & Golden Certification

## Mục tiêu

Không sửa lỗi đơn lẻ. Mọi sai lệch phải được đưa vào **Gap Matrix P0 → P1 → P2**, xác định nguyên nhân gốc, sửa theo cụm và bổ sung gate/regression để không tái diễn.

## Phạm vi

1. Version / release identity / Service Worker / build metadata.
2. Search Brain lock và source synchronization.
3. Calculation Engine / production registry / router / export safety gate.
4. TCVN 10304 Golden: tables, workflows, DCE reference, SPT PDF decision, settlement, multi-borehole.
5. TCVN 5574 material + integrated Rsoil/Rmaterial.
6. Excel Production: công thức, compatibility, dropdown, tiếng Việt, provenance, native chart.
7. Web build + Pages deploy gate.
8. Windows Desktop + NSIS + Portable + DCE path + Excel runtime.
9. Cross-workflow: geometry, gamma factors, governing resistance, edition isolation, DCE authority separation.
10. Negative/failure handling và BLOCK semantics.

## Quy tắc mức độ

- **P0** — an toàn/logic/release blocker. Mở P0 thì dừng promotion.
- **P1** — production quality/correctness coverage. Phải đóng trước `PRODUCTION VERIFIED`.
- **P2** — coverage/usability/maintainability. Làm sau P0/P1; mục `DEFERRED` chỉ mở khi scope cho phép.

## Luồng CI

`npm ci → Version → Release Sync → Source Sync → Web Boundary → 574 → Full Table Golden → Workflow Golden → Material → DCE → SPT Decision → Material E2E → Multi-borehole → Excel Runtime → Excel Production → Master Gap Matrix → Web → Windows EXE → RC Final → Pages`

## Promotion rule

- Pass 8.3 / Master Audit: `--enforce-p0`.
- RC Final: `--enforce-all`.
- Không gọi `PRODUCTION VERIFIED` chỉ vì một workflow hoặc một Actions xanh.

## Scope control hiện tại

- **Raw SPT pass tiếp theo: DEFERRED** theo quyết định hiện tại.
- **VBA Advanced: DEFERRED** cho đến khi `.xlsx` formula-only ổn định.
