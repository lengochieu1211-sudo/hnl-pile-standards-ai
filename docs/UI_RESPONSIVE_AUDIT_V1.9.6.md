# HNL Pile Standards AI v1.9.6 — Fluid Responsive Layout Audit

## Mục tiêu
Không để panel Thư viện hoặc Trợ lý biến mất do thiếu chiều ngang. Trên desktop, 3 vùng tự co theo viewport. Panel chỉ ẩn khi người dùng chủ động bấm thu gọn hoặc Focus Reader. Dưới 880 px, giao diện chuyển sang điều hướng 3 tab Thư viện / PDF / Trợ lý.

## Thay đổi
- Tách chiều rộng người dùng (`--left-user-w`, `--right-user-w`) khỏi chiều rộng hiệu lực responsive.
- Dùng `min()/max()` để panel co theo viewport nhưng vẫn giữ ngưỡng đọc được.
- Viewer giữ tối thiểu 340 px, 320 px ở desktop hẹp, 300 px ở 881–980 px.
- Splitter bám đúng mép panel sau khi co tự động.
- Không có media query desktop nào tự đặt `display:none` cho sidebar/assistant.
- Header, metadata, document rows, toolbar và tab đều có `min-width:0`, ellipsis/wrap để tránh đè nhau.
- 881–980 px vẫn giữ đủ 3 cột; <=880 px chuyển sang mobile nav chứ không làm mất chức năng.
- Panel thu gọn thủ công vẫn có nút phục hồi ngoài panel và nút Reset layout.

## Kiểm tra logic
- Nút mở/đóng panel vẫn dùng state explicit, không gắn với resize.
- Resize không thay đổi `leftCollapsed/rightCollapsed`.
- Chiều rộng người dùng được lưu, nhưng viewport nhỏ chỉ tạm co; khi phóng cửa sổ lại, kích thước mong muốn được phục hồi.
