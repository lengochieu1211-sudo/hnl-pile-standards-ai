# HNL Pile Standards AI v1.12.2

## Math / LaTeX rendering fix
- Sửa lỗi AI trả công thức kiểu `\\[ ... $$` hoặc `$$ ... \\]` làm hiện ký tự thô.
- Chuẩn hóa delimiter trước khi render.
- Render display/inline math không phụ thuộc CDN để dùng được Web + Windows Offline.
- Hỗ trợ ký hiệu Hy Lạp, subscript/superscript, `\\sum`, `\\cdot`, `\\times`, `\\frac`, `\\sqrt`.
- Prompt AI yêu cầu cặp `$$ ... $$` cho công thức riêng dòng và `\\( ... \\)` cho inline.
- Không thay đổi `src/search.js`.
