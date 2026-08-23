# Full Audit v1.9.23

Nguồn audit: `HNL-Pile-Standards-AI-v1.9.22-Full-Runtime-Audit.zip` do người dùng cung cấp.

## Lỗi đã xác nhận và sửa

1. **Đọc PDF native tự quay về Cân bằng**
   - Root cause: `nativePdfModeInput` chỉ tồn tại trong draft form, chưa commit ngay vào `state.settings.nativePdfMode` khi `change`; một render khác sẽ dựng select từ state cũ (`balanced`).
   - Fix: change handler commit ngay vào state + settingsDraft + localStorage, cập nhật badge/summary tại chỗ.

2. **PDF 71,3 MB không thể gửi native trực tiếp cho Gemini**
   - Gemini document processing giới hạn PDF 50 MB/1.000 trang. Source cũ loại file khỏi native plan nhưng thông báo quá chung, gây cảm giác mode đã tự đổi.
   - Fix: giữ nguyên lựa chọn `native`; chỉ đánh dấu file vượt giới hạn và báo fallback rõ ràng. Không thay mode người dùng.

3. **False-negative “cọc chống” trên PDF ảnh / text-layer bất thường**
   - Thêm `scanPdfTextForPhrase()` đọc lại PDF.js text items trực tiếp từ Blob gốc với 3 biểu diễn: geometry rows, spaced items, compact glyphs.
   - Fresh scan chỉ chạy khi exact phrase trong index không tìm thấy, tránh làm nặng mọi truy vấn.
   - Fresh pages được trộn vào `searchDocs` rồi chạy lại exact-body / TOC resolver.
   - Nếu text layer vẫn hoàn toàn không thấy và PDF native không khả dụng, thêm **Visual TOC Locator**: chỉ gửi tối đa 10 trang đầu/mục lục dạng ảnh cho AI để định vị mục kỹ thuật; sau đó pipeline OCR/Vision chỉ đọc 4–6 trang đích/lân cận. Không Vision toàn bộ 124 trang.

4. **AI/Model bị trùng điều khiển**
   - Xóa `ai-quickbar` provider/model/refresh ở đầu panel.
   - `AI & kết nối` trong tab Cài đặt là nguồn điều khiển duy nhất.
   - Đầu panel chỉ còn summary read-only để biết Provider/Model/Kết nối và bấm mở Cài đặt.
   - Xóa handler/dead IDs `quickProviderSelect`, `openQuickModelPicker`, `refreshModelsQuick`.

5. **Khối Đọc PDF native quá dài**
   - Đổi thành compact overview + `Xem chi tiết PDF native`.
   - `details[data-persist-detail]` được UI State Guard giữ trạng thái qua render.

## Kiểm thử

- Version Gate: PASS (`v1.9.23`).
- Regression: **108/108 PASS, 0 FAIL**.
- JS/MJS/CJS syntax: PASS toàn bộ file trong `src`, `bridge`, `electron`, `scripts`, `tests`.
- Workflow YAML: `pages.yml` PASS parse; `desktop-win.yml` PASS parse.
- Secret scan: không phát hiện API key có dạng thực trong source.

## Chưa thể xác nhận trong môi trường audit

- Không có `node_modules`, vì vậy chưa chạy được `vite build`/Electron build tại đây.
- Không có API key thật nên chưa gọi live Gemini/OpenAI.
- Không có máy Windows/Ollama thật nên chưa tải model nhiều GB hoặc build Setup/Portable thực tế.

## Hành vi mong đợi sau deploy

- Chọn `Toàn tài liệu` -> state lưu ngay; mở tab khác/render lại vẫn là `Toàn tài liệu`.
- PDF >50 MB -> mode vẫn là `Toàn tài liệu`; UI báo `vượt giới hạn native -> fallback trang mục tiêu`, không tự đổi thành Cân bằng.
- Hỏi `cọc chống là gì` -> exact index -> fresh PDF.js -> TOC -> visual TOC locator -> targeted OCR/Vision; chỉ sau tất cả tầng này mới được kết luận thiếu căn cứ.
