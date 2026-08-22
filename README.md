# HNL Pile Standards AI v1.2 Pro Audit

Ứng dụng web/PWA cho kỹ sư cọc: tải một hoặc nhiều PDF tiêu chuẩn, đọc PDF, tìm đúng trang, hỏi đáp theo nguồn, tra bảng, tính toán, so sánh tài liệu và tạo checklist nghiệm thu.

## Bản v1.2 đã sửa sâu

- Sửa lỗi tìm kiếm cốt lõi làm nhiều nút `Tra cứu / Hỏi đáp / So sánh` gần như không hoạt động đúng với tài liệu đầu tiên.
- Tách rõ `Tra cứu cục bộ` và `AI`, không gọi chế độ tìm kiếm từ khóa là AI offline.
- AI online có 2 cách dùng:
  - **Trực tiếp (BYOK):** người dùng nhập API key của chính mình; key chỉ lưu trong `sessionStorage` của tab hiện tại, không nằm trong GitHub.
  - **HNL Bridge:** giữ key ngoài frontend, phù hợp khi chạy backend/local bridge.
- Ollama offline hỗ trợ trực tiếp khi chạy localhost và hỗ trợ qua HNL Bridge.
- Citation được hiển thị thành nút; bấm vào mở đúng PDF/trang.
- Thêm tra nhanh Bảng 1 của TCVN 7888:2014 khi chính PDF TCVN 7888:2014 đã được nạp làm nguồn.
- Calculator mới tự tính diện tích tiết diện vành khăn từ `D` và `t`, tính dài hạn, ngắn hạn và 80% ngắn hạn theo Phụ lục B.
- Checklist nghiệm thu lưu trạng thái cục bộ, có sao chép và reset.
- Chặn PDF trùng bằng SHA-256.
- Cảnh báo PDF scan có ít lớp text.
- Tối ưu PDF viewer: cache PDFDocument, hủy render cũ, zoom ± và nhập số trang.
- Service Worker chuyển HTML sang network-first để tránh GitHub Pages giữ giao diện/source cũ sau khi cập nhật.
- Logo HNL đã bỏ phần caro/không cần thiết bên ngoài và xuất icon sạch 64/192/512 px.
- Giao diện desktop/mobile viết lại theo kiểu workstation kỹ thuật, chữ rõ hơn, panel gọn hơn.
- Có nút **Chẩn đoán ứng dụng** trong Cài đặt.

## Các chức năng

1. Tải 1 hoặc nhiều PDF.
2. Lưu PDF và text phân tích bằng IndexedDB trên máy người dùng.
3. Chọn nhiều tài liệu làm nguồn bằng checkbox.
4. Trình đọc PDF theo trang, zoom và điều hướng.
5. Tóm tắt cục bộ hoặc tóm tắt bằng AI.
6. Hỏi đáp RAG có nguồn trang.
7. Tra nhanh từ khóa và tra Bảng 1 TCVN 7888:2014.
8. Calculator sức kháng nén theo vật liệu.
9. So sánh nhiều tiêu chuẩn.
10. Checklist nghiệm thu.
11. Gemini / OpenAI / Claude / Grok / Ollama.
12. PWA và GitHub Pages.

## Chạy frontend

```bash
npm install
npm run dev
```

## Kiểm tra logic

```bash
npm test
npm run build
```

Bộ test hiện kiểm tra công thức, bảng tra, tìm kiếm, citation, wiring của các nút chính và logic cập nhật Service Worker.

## AI trực tiếp trên GitHub Pages

Vào `Cài đặt` → chọn nhà cung cấp → `Trực tiếp` → nhập API key của **chính người dùng**. Key chỉ nằm trong phiên tab hiện tại (`sessionStorage`) và không được commit lên repository.

Một số nhà cung cấp/trình duyệt có thể chặn CORS. Khi đó chuyển sang `HNL Bridge`.

## HNL Bridge

```bash
cp bridge/.env.example bridge/.env
npm run bridge
```

Điền key cần dùng trong `bridge/.env`. Không commit `.env` lên GitHub.

## GitHub Pages

Repository → `Settings` → `Pages` → `Source: GitHub Actions`, sau đó push nhánh `main`.

Workflow: `.github/workflows/pages.yml`.

## Giới hạn hiện tại

- Chưa OCR tự động cho PDF scan chỉ có hình.
- Bảng/công thức phức tạp vẫn phải đối chiếu trang PDF gốc.
- Tra bảng TCVN 7888:2014 chỉ bật khi tài liệu tương ứng đã được nạp.
- Tên model mặc định là gợi ý; nếu tài khoản API không hỗ trợ, sửa tên model trong Cài đặt.
- GitHub Pages là frontend tĩnh; Bridge không chạy bên trong GitHub Pages.

## v1.2 — Fix nút nhấn / tương tác

- Chuyển toàn bộ nút động sang event delegation để không mất handler khi giao diện render lại.
- Nút gợi ý trong Hỏi đáp bấm là gửi câu hỏi ngay.
- Enter gửi câu hỏi; Shift+Enter xuống dòng.
- Nút bấm thiếu dữ liệu sẽ hiện cảnh báo thay vì im lặng.
- Tra bảng, tính toán, so sánh có phản hồi trạng thái rõ ràng.
- Checklist có fallback sao chép.
- Cache PWA tăng lên `hnl-pile-ai-v1.2.0` để tránh giữ JS cũ sau khi deploy.
- Xem `docs/AUDIT_V1.2.md`.
