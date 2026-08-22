# HNL Pile Standards AI v1.4 — Full Library RAG

Ứng dụng web/PWA hỗ trợ kỹ sư đọc, tra cứu, hỏi đáp và kiểm tra tiêu chuẩn cọc từ PDF, thư mục, ZIP, hình ảnh và dữ liệu text. Bản v1.4 sửa trọng tâm lỗi của v1.3: **hỏi đáp/tìm kiếm nhiều PDF nhưng chỉ lấy một phần trang**.

## Thay đổi quan trọng v1.4

- **Mặc định tra cứu TOÀN BỘ thư viện đã tải**, không còn chỉ dùng PDF đang mở.
- Có 3 phạm vi rõ ràng: **Toàn bộ tài liệu / Chỉ tài liệu đã tick / Chỉ PDF đang mở**.
- Mỗi câu hỏi và mỗi lượt tìm kiếm **chấm điểm toàn bộ chunk của toàn bộ trang trước**, sau đó mới giới hạn số đoạn gửi cho AI.
- Tab **Tra cứu** dùng tìm kiếm cấp trang: quét mọi trang có lớp chữ, rồi mới xếp hạng tối đa 100 trang liên quan để hiển thị.
- RAG cân bằng theo tài liệu: một PDF có nhiều từ khóa không được chiếm hết context; mỗi PDF liên quan được giữ quota kết quả.
- Tự bổ sung trang trước/sau của hit chính để không mất nội dung điều khoản/bảng bị ngắt qua trang.
- Hiển thị rõ: `X/Y trang đã lấy chữ`, số ký tự, và thống kê lần tìm gần nhất đã quét bao nhiêu trang/chunk.
- Thêm **Tóm tắt toàn bộ nguồn**.
- Tăng số context RAG lên 40 đoạn cho câu thường và 56 đoạn cho câu tổng hợp rộng; vẫn quét toàn bộ corpus trước khi chọn context.
- Chunk cache giúp tránh cắt lại toàn bộ tài liệu ở mọi lần hỏi.
- **Model picker động**: Gemini / OpenAI / Claude / Grok / Ollama có nút `↻ Model` để lấy danh sách model khả dụng của tài khoản/máy; vẫn cho phép nhập model thủ công.
- Ollama lấy model thực tế từ `/api/tags`.
- HNL Bridge có endpoint `/api/models/:provider` để lấy model từ key lưu phía server.
- Giữ các tính năng v1.3: Offline AI Ollama, PDF/ZIP/thư mục/ảnh/text, RAR/7Z ở Local, Gemini API, calculator/checklist TCVN 7888, citation mở đúng trang.
- PWA cache nâng lên `hnl-pile-ai-v1.4.0`.

## Cách hỏi để app tìm trong toàn bộ PDF

Ở Thư viện → **Phạm vi hỏi đáp / tìm kiếm** → chọn `Toàn bộ tài liệu đã tải`.

Sau đó tab **Hỏi đáp** hoặc **Tra cứu** sẽ quét tất cả trang có lớp chữ trong tất cả file. Kết quả AI chỉ nhận những đoạn liên quan nhất vì không thể nhét hàng nghìn trang vào một request, nhưng việc lựa chọn các đoạn đó được thực hiện **sau khi đã chấm điểm toàn bộ trang**.

Ví dụ khi có 20 PDF và 1.200 trang, app sẽ báo dạng:

`Đã quét 1.186/1.200 trang có lớp chữ · 4.320 đoạn · 20 tài liệu`

Nếu một PDF là scan ảnh, số trang có chữ có thể thấp hơn số trang thực tế. Đây là giới hạn OCR, không phải giới hạn tìm kiếm.

## AI Offline

1. Cài Node.js LTS và Ollama.
2. Chạy `offline/INSTALL_OFFLINE_MODELS.bat`.
3. Chạy `offline/START_HNL_OFFLINE_AI.bat`.
4. Mở `http://127.0.0.1:8787/?offline=1`.
5. Cài đặt → `HNL Offline AI · Ollama` → `↻ Model` để lấy tất cả model đang cài trên máy.

## Gemini API key

1. Mở Google AI Studio → API Keys: `https://aistudio.google.com/apikey`.
2. Create API key → copy key.
3. Trong app: Cài đặt → Google Gemini → Trực tiếp → dán key.
4. Bấm `↻ Model` để lấy danh sách model mà key đó dùng được.
5. Bấm `Kiểm tra kết nối`.

API key ở chế độ trực tiếp chỉ được giữ trong `sessionStorage` của tab, không ghi vào source GitHub.

## Chạy GitHub Pages

Workflow `.github/workflows/pages.yml` dùng Node 22 → `npm install` → `npm run build` → deploy Pages.

GitHub → Settings → Pages → Source phải chọn **GitHub Actions**.

## Kiểm tra

```bash
npm test
npm run build
```

Bản source này có 17 test logic/wiring, gồm test bắt buộc tìm được nội dung ở trang rất muộn (trang 114/120) và giữ kết quả từ nhiều PDF.

## Giới hạn cần hiểu đúng

- **PDF scan ảnh:** nếu không có lớp text thì tra cứu chữ không thể tự biết nội dung trang đó. App sẽ báo số trang text thực tế. Cần OCR/AI Vision để biến trang scan thành text trước khi full-text search.
- AI không được gửi nguyên hàng nghìn trang vào một request; app quét toàn bộ corpus rồi chọn context liên quan. Đây là RAG đúng cách.
- RAR/7Z chỉ tự bung ở HNL Local khi máy có `tar`/7-Zip.
- Kết quả kỹ thuật phải mở citation và kiểm tra trang tiêu chuẩn gốc, đặc biệt với bảng/công thức.
