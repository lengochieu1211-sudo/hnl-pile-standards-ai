# HNL Pile Standards AI v1.25.7 — Input Recognition Final Fix

## Lỗi người dùng báo
Câu hỏi đã có dữ liệu nhưng giao diện vẫn báo thiếu, ví dụ:
`Cường độ sức kháng mũi thiết kế (q_b): 31468,0 kPa`.

## Nguyên nhân
Engineering Number Extractor chỉ cho phép alias đứng sát dấu `:` / `=`. Khi alias được trình bày trong ngoặc như `(q_b):`, ký tự `)` nằm giữa alias và dấu `:`, nên `q_b` không được nhận diện và validator báo thiếu sai.

## Sửa
- Generic Engineering Number Extractor chấp nhận alias có ngoặc đóng `)` hoặc `]` trước dấu gán.
- Giữ nguyên raw text/LaTeX trong textarea; chuẩn hóa chỉ chạy ở lớp parser/tính toán.
- Toàn bộ quyền xuất Excel dùng chung `canExportEngineeringResult`; không còn nhánh `result.ok || result.methodOnly` làm lệch trạng thái.
- Bổ sung regression cho chính dạng `(q_b): 31468,0 kPa` và TEST CASE cọc chống ngàm đá.

## Kết quả exact test case
- Workflow: `10304-end-bearing`
- `q_b`: 31468 kPa được nhận diện.
- `result.ok = true`
- `canExport = true`
- Không còn cảnh báo thiếu `q_b` khi `q_b` đã có trong đề.

## Gate thực chạy
- `node --test tests/*.test.mjs`: **294/294 PASS**.
- Version Gate: **PASS v1.25.7**.
- Search Brain: **PASS**, normalized SHA-256 `f9b65e5e6fb61dcca233a4fe43950e3174c73536f2fa83452da3041fbd0021d2`.
- Full Table Golden: **1.130/1.130 PASS**.

## Giới hạn còn tách riêng
TEST CASE này hiện có thể dùng trực tiếp `q_b` đã được cung cấp. Logic tự suy `RQD -> K_s -> R_c,m,n -> q_b` chưa được coi là VERIFIED nếu chưa có bảng/nguồn chính thức đã số hóa và benchmark. Không được dùng giá trị đối chiếu của phần mềm cũ để giả làm bảng tra tiêu chuẩn.

## Dependency/build
ZIP nguồn ban đầu không có `package-lock.json`/`node_modules`, vì vậy sandbox không xác nhận `npm ci`, Excel smoke hoặc Web build. Khi cập nhật vào repo local, giữ `package-lock.json` v1.25.7 hiện có của repo rồi chạy CI `npm ci -> test -> Golden -> build`.
