# HNL Pile Standards AI v1.0

Ứng dụng web/PWA định hướng kỹ sư cọc: tải một hoặc nhiều PDF tiêu chuẩn, đọc PDF, tra cứu theo trang, tóm tắt, hỏi đáp RAG có citation, so sánh nhiều tiêu chuẩn, checklist nghiệm thu và tính toán hỗ trợ.

## Có sẵn trong bản v1.0
- Logo HNL làm nhận diện chính.
- Upload nhiều PDF.
- PDF.js trích xuất text từng trang.
- Lưu thư viện cục bộ bằng IndexedDB.
- Trình đọc PDF tích hợp.
- Chọn 1 hoặc nhiều tài liệu làm nguồn.
- Tra nhanh theo từ khóa.
- Hỏi đáp chỉ theo tài liệu với nguồn `Tên tiêu chuẩn · Trang X`.
- Tóm tắt cục bộ không cần AI.
- AI offline qua Ollama.
- Gemini, OpenAI/ChatGPT API, Claude, Grok qua HNL AI Bridge.
- So sánh nhiều tài liệu.
- Calculator sức kháng nén dọc trục theo cấu trúc công thức Phụ lục B của TCVN 7888:2014.
- Checklist mẫu hồ sơ nghiệm thu TCVN 7888:2014.
- Responsive desktop/mobile.
- Workflow GitHub Pages.

## Chạy thử frontend
```bash
npm install
npm run dev
```
Mở địa chỉ Vite hiển thị trên màn hình, thường là `http://localhost:5173`.

## AI offline với Ollama
1. Cài Ollama.
2. Tải model, ví dụ:
```bash
ollama pull qwen3:8b
```
3. Nếu trình duyệt bị CORS khi Bridge gọi Ollama, cấu hình Ollama cho phép nguồn local theo tài liệu Ollama của máy bạn.
4. Chạy HNL AI Bridge:
```bash
cp bridge/.env.example bridge/.env
npm run bridge
```
5. Trong ứng dụng chọn `Offline · Ollama`.

## AI online an toàn
Không nhập/commit API key vào frontend GitHub Pages.

Tạo `bridge/.env` từ `bridge/.env.example`, điền key dịch vụ cần dùng rồi chạy:
```bash
npm run bridge
```
Ứng dụng mặc định gọi Bridge ở `http://127.0.0.1:8787`.

> GitHub Pages chỉ host frontend tĩnh. Muốn người khác dùng AI online mà không chạy Bridge trên máy, cần deploy Bridge lên một backend riêng và đặt biến môi trường ở backend đó. Không đưa secret vào repo public.

## Đưa lên GitHub Pages
1. Tạo repository mới.
2. Upload toàn bộ source.
3. Nhánh chính tên `main`.
4. GitHub → Settings → Pages → Source chọn **GitHub Actions**.
5. Push source. Workflow `.github/workflows/pages.yml` sẽ build và deploy.

## Về PDF tiêu chuẩn
Source không kèm file PDF tiêu chuẩn. Người dùng tự tải tài liệu mình có quyền sử dụng vào ứng dụng. Việc này tránh đưa tài liệu có giới hạn phân phối lên repository public.

## Lưu ý kỹ thuật
- RAG v1.0 đang dùng tìm kiếm từ khóa có trọng số, ưu tiên ổn định và chạy hoàn toàn cục bộ.
- Với PDF scan không có lớp text, bản v1.0 chưa OCR tự động.
- Bảng/công thức phức tạp vẫn cần kiểm tra trang PDF gốc.
- Model mặc định chỉ là gợi ý và có thể thay đổi theo nhà cung cấp; có thể sửa tên model trong Cài đặt.

## PWA
Bản build có `manifest.webmanifest` và service worker để có thể cài như ứng dụng web. Các tài nguyên đã mở sẽ được cache; PDF người dùng được giữ trong IndexedDB cục bộ.

### Sửa lỗi GitHub Pages v1.0.1
Nếu bản v1.0 báo `Dependencies lock file is not found` ở bước `actions/setup-node@v4`, dùng workflow trong v1.0.1. Bản này đã bỏ `cache: npm` cho đến khi repository có `package-lock.json`.
