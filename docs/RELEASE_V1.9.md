# HNL Pile Standards AI v1.9.0 — Reader Pro

## Mục tiêu
Làm trình đọc PDF dễ thao tác hơn cho tiêu chuẩn kỹ thuật dài, đặc biệt khi vừa đọc PDF vừa hỏi AI.

## Thay đổi chính
- Continuous PDF viewer với IntersectionObserver/lazy rendering.
- Render task độc lập theo canvas, tránh trang này hủy render trang khác.
- Single-page mode vẫn giữ để máy yếu dùng nhẹ hơn.
- Mouse drag pan, Ctrl+wheel zoom, keyboard navigation.
- Search current PDF + next/previous match.
- Page scrubber/range, current-page sync theo vùng nhìn.
- Focus mode, collapse left/right panels, resize panels.
- Responsive toolbar và sticky status bar trên mobile.
- PWA cache v1.9.0.

## Không thay đổi logic kỹ thuật
RAG, AI Formula Scanner, Ollama/online AI, archive import và calculator vẫn giữ logic v1.8; Reader Pro chỉ thay lớp UX/PDF rendering để giảm rủi ro hồi quy.
