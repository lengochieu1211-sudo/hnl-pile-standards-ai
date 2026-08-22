# HNL Pile Standards AI v1.7.0 — Local Intelligence Engine

**Cập nhật ứng dụng:** 22/08/2026 22:55 GMT+7  
**Phiên bản:** v1.7.0

Ứng dụng web/PWA dành cho đọc, tra cứu, hỏi đáp và kiểm tra tiêu chuẩn cọc từ nhiều PDF, thư mục, file nén, hình ảnh và dữ liệu text. Bản v1.7 nâng trọng tâm **AI cục bộ** bằng Hybrid Semantic RAG thay vì chỉ đổi sang model lớn hơn.

## AI cục bộ v1.7 thông minh hơn như thế nào

Luồng mới:

`Toàn bộ trang → tìm từ khóa/cấu trúc → semantic embedding → rerank → cân bằng nhiều PDF → thêm trang lân cận → Ollama trả lời có citation`.

Trong **Cài đặt → HNL Offline AI · Ollama** có:

- `Auto`: tự dùng nhanh/chuyên sâu; khi chạy Local + Bridge sẽ dùng semantic rerank.
- `Hybrid Semantic`: luôn ưu tiên keyword + vector embedding.
- `Deep Lexical`: quét sâu theo cấu trúc tiêu chuẩn, không phụ thuộc embedding.
- `Nhanh`: giảm lượng context để phản hồi nhanh.
- Model embedding mặc định: `bge-m3`; máy nhẹ có thể dùng `nomic-embed-text`.

Nếu semantic embedding bị lỗi hoặc chưa cài model, app **tự fallback** về Deep/lexical RAG để hỏi đáp vẫn hoạt động.

## Cài AI Offline

1. Cài Node.js LTS và Ollama.
2. Chạy `offline/INSTALL_OFFLINE_MODELS.bat`.
3. Chọn cấu hình:
   - Máy nhẹ: `qwen3:4b + gemma3:4b + nomic-embed-text`
   - Cân bằng: `qwen3:8b + gemma3:4b + bge-m3`
   - Máy mạnh: `qwen3:14b + gemma3:4b + bge-m3`
4. Chạy `offline/START_HNL_OFFLINE_AI.bat`.
5. Mở `http://127.0.0.1:8787/?offline=1`.
6. Cài đặt → HNL Offline AI → HNL Bridge → chế độ `Auto` hoặc `Hybrid Semantic`.

## Chẩn đoán Local

Nút **Chạy chẩn đoán** sẽ kiểm tra thêm:

- Ollama có chạy hay không và version.
- Số model đã cài.
- Model embedding khuyến nghị đã cài chưa.
- Tổng RAM máy.
- NVIDIA GPU/VRAM nếu `nvidia-smi` khả dụng.
- Gợi ý model text/vision theo tài nguyên máy.

## Dữ liệu đầu vào

- PDF nhiều file.
- ZIP trực tiếp trên Chrome/Edge.
- RAR, 7Z, TAR, TGZ/TAR.GZ, GZ, BZ2, XZ qua HNL Local.
- Archive có mật khẩu.
- Đọc cả thư mục.
- Ảnh JPG/PNG/WebP/BMP/GIF.
- TXT/MD/CSV/JSON/XML/HTML/YAML.

## Tìm kiếm toàn thư viện

Chọn **Phạm vi hỏi đáp / tìm kiếm → Toàn bộ tài liệu đã tải**. App chấm điểm toàn bộ các trang có text trước khi lấy context. Với Hybrid Semantic, các ứng viên mạnh nhất tiếp tục được embedding/rerank cục bộ.

## Công thức

- Giữ calculator đã xác minh cho TCVN 7888:2014.
- Thư viện Tính tiếp tục quét công thức trên toàn bộ PDF có lớp text.
- Công thức OCR/extraction không rõ tử-mẫu, chỉ số hoặc ký hiệu sẽ ở trạng thái **Cần kiểm tra**, không tự tính để tránh kết quả sai.

## Gemini API key

Google AI Studio → API Keys → Create API key → copy key → Cài đặt → Gemini → Trực tiếp → dán key → `↻ Model` → Kiểm tra kết nối.

API key ở chế độ trực tiếp chỉ giữ trong `sessionStorage` của tab, không ghi vào source GitHub.

## GitHub Pages

Workflow `.github/workflows/pages.yml` dùng Node 22 → `npm install` → `npm run build` → deploy Pages. Trong GitHub: **Settings → Pages → Source = GitHub Actions**.

## Kiểm thử bản đóng gói

- `npm test`: **26/26 PASS**.
- `node --check`: các file JS/Bridge chính PASS.
- Vite build chưa chạy được trong môi trường đóng gói do chưa có `node_modules` và `npm install` bị timeout; GitHub Actions sẽ cài dependency trước khi build.

Xem chi tiết tại `docs/RELEASE_V1.7.md`.
