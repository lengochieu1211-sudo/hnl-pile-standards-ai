# HNL Pile Standards AI v1.9.9 — Full Logic/UI/Version Audit

## Gate bắt buộc
1. Version package/README/changelog/release phải trùng.
2. Test logic phải PASS.
3. Web build phải tạo build-info đúng version.
4. Desktop build phải tạo đủ Setup + Portable.

## Model safety
- Không có thao tác refresh/test nào được đổi model.
- Không model nào (Text/Vision/Embedding) được đổi nếu người dùng chưa OK.
- API key không được lưu khi chỉ đang gõ.
- Fallback không được dùng catalog chưa xác minh.

## UI responsive
- Desktop không tự ẩn panel do resize.
- Mobile chuyển view bằng tab, không xóa chức năng.
- Header/tabs/model picker dùng min-width:0, ellipsis/wrap để tránh chồng lấn.

## Windows
- NSIS và Portable có artifactName riêng.
- Workflow verify đủ hai EXE trước upload.
