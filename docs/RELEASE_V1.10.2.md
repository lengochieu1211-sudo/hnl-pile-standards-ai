# HNL Pile Standards AI v1.10.2 — Runtime Acceptance · NPH Table 2 · Verified Source Guard

## Trọng tâm

- Hoàn thiện Bảng 2 NPH theo TCVN 7888:2014 trang 12.
- Khóa đúng edition cho mọi công cụ/công thức gắn nhãn Verified.
- Giữ calculator input qua render và làm rõ provenance của số liệu bảng so với nhập tay.
- Lịch sử tính có nút mở trang nguồn.
- Khóa điều kiện áp dụng Phụ lục B: PC σcu ≥ 60 MPa; PHC/NPH σcu ≥ 80 MPa trong cả máy tính chuyên dụng và công thức Verified.
- Không thay đổi `src/search.js`; search brain v1.9.23 và Golden Test “cọc chống” được giữ nguyên.

## Bảng 2 NPH đã hard-code sau đối chiếu

D thân cọc hỗ trợ: 300, 400, 450, 500, 600, 700, 800, 900, 1000 mm. Mỗi đường kính chỉ có cấp A/B/C. `Dk,max`, `t`, kích thước đốt, mômen uốn nứt, ứng suất hữu hiệu và khả năng bền cắt được lưu cùng source page 12.

## An toàn Verified

Tên file `notes-7888.pdf` hoặc `TCVN 7888:2008.pdf` không còn đủ để bật thư viện công thức Verified. PDF đổi tên vẫn được nhận diện nếu phần text đầu tài liệu xác nhận rõ `TCVN 7888:2014`.

## Build

Build Web/Windows thực tế vẫn phụ thuộc dependency được cài trên runner. Workflow giữ Version Gate → Test → Build Desktop → Verify Setup/Portable → Smoke Test Portable → Upload.
