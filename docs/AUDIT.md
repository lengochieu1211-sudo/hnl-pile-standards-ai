# Audit v1.0

## Đã kiểm tra
- `node --check` toàn bộ JavaScript frontend, AI Bridge và Vite config: đạt cú pháp.
- Không có API key hard-code trong source.
- PDF được lưu cục bộ bằng IndexedDB.
- GitHub Pages chỉ deploy frontend; AI Bridge tách riêng.
- Chế độ khóa nguồn mặc định bật.
- TCVN 7888:2014 được dùng làm căn cứ cho checklist mẫu và calculator Phụ lục B; PDF gốc không được đóng gói vào repo public.

## Cần kiểm tra sau khi `npm install`
Môi trường tạo ZIP này không truy cập được npm registry nên chưa chạy được Vite build thực tế. GitHub Actions sẽ cài dependencies từ npm khi repository có mạng. Nếu phiên bản package thay đổi/không còn tồn tại, cập nhật version trong `package.json`.

## Giới hạn v1.0
- PDF scan ảnh chưa có OCR.
- Chưa highlight trực tiếp đoạn text trên trang PDF.
- RAG cục bộ dùng lexical search, chưa dùng embedding/vector database.
- Công thức/bảng PDF phức tạp cần người dùng đối chiếu trang gốc.
- Online AI cần API key riêng của từng nhà cung cấp; không mặc định miễn phí.

## v1.0.1 – GitHub Actions build fix
- Đã xử lý lỗi setup-node yêu cầu lock file khi bật `cache: npm`.
- Workflow hiện không dùng npm cache khi repository chưa có `package-lock.json`.
- Node 22 vẫn được sử dụng cho Vite 7.
