# HNL Pile Standards AI v1.9.5

## UI
- Sửa tab Cài đặt bị khuất trong panel phải.
- Tabs dùng grid 4 cột (3 cột ở desktop hẹp) nên toàn bộ 7 mục luôn thấy.
- Header và tabs cố định, panel-body mới là vùng cuộn.
- Có nút ⚙ mở Cài đặt trực tiếp.

## Windows EXE
Workflow `.github/workflows/desktop-win.yml` chạy tự động khi push nhánh `main`, khi push tag `v*`, hoặc chạy thủ công. Sau build thành công, Artifacts có cả NSIS Setup và Portable EXE.
