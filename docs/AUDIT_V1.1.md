# Audit chuyên sâu v1.1

## 1. Lỗi logic nghiêm trọng đã tìm thấy

### Search/RAG
Bản cũ dùng:

```js
docs.flatMap(buildChunks)
```

`Array.flatMap` truyền thêm `index` và `array` vào callback. Vì `buildChunks(doc, chunkSize, overlap)` nhận tham số thứ 2 là `chunkSize`, tài liệu đầu tiên nhận `chunkSize = 0`, tài liệu thứ hai nhận `chunkSize = 1`... Điều này làm chunk bị cắt sai và kết quả tìm kiếm/RAG hỏng. Đây là nguyên nhân trực tiếp khiến nhiều nút có vẻ bấm được nhưng không cho kết quả đúng.

Đã sửa thành:

```js
docs.flatMap(doc => buildChunks(doc))
```

### AI trên GitHub Pages
Bản cũ mặc định gọi `http://127.0.0.1:8787` dù web đang chạy trên GitHub Pages. Người dùng không chạy Bridge thì Hỏi AI/Tóm tắt AI/So sánh AI không thể hoạt động.

Bản mới:
- `Tra cứu cục bộ`: chạy ngay, không API.
- `Trực tiếp BYOK`: gọi API bằng key của người dùng trong session tab.
- `HNL Bridge`: tùy chọn nâng cao.

### Model mặc định
Bản cũ có một số tên model mang tính placeholder/không đảm bảo tồn tại. Bản mới thay bằng tên gợi ý phổ biến hơn và cho phép sửa trực tiếp trong UI.

### Cache GitHub Pages
Service Worker cũ dùng cache-first cho cả `index.html` và giữ cache name v1. Sau deploy mới, trình duyệt có thể tiếp tục chạy source cũ.

Bản mới:
- Cache `v1.1.0`.
- Navigation/HTML dùng network-first.
- Vite assets hash dùng cache-first + refresh nền.
- Khi đăng ký SW dùng `updateViaCache: 'none'`.

## 2. Audit nút chức năng

| Nhóm | Nút | Handler | Trạng thái |
|---|---|---|---|
| Thư viện | Thêm PDF | `uploadPdfs` | OK |
| Thư viện | Chọn tất cả | chọn `state.selected` | OK |
| Thư viện | Bỏ chọn | clear `state.selected` | OK |
| Thư viện | Mở PDF | `openDoc` | OK |
| Thư viện | Xóa PDF | `removeDoc` | OK |
| PDF | Trang trước/sau | `jumpPage` | OK |
| PDF | Nhập số trang | `jumpPage` | OK |
| PDF | Zoom +/- | `setZoom` | OK |
| PDF | Reset zoom | `setZoom(1.08)` | OK |
| Tóm tắt | Tóm tắt cục bộ/AI | `aiSummary` | OK |
| Hỏi đáp | Gửi | `askQuestion` | OK |
| Hỏi đáp | Gợi ý câu hỏi | điền composer | OK |
| Citation | Mở nguồn | `bindSourceButtons` | OK |
| Tra cứu | Tìm trong PDF | `runLookup` | OK |
| Tra cứu | Tra Bảng 1 | `runTableLookup` | OK |
| Tính | Nạp Bảng 1 | `fillCalcFrom7888` | OK |
| Tính | Tính kết quả | `runCalc` | OK |
| So sánh | So sánh nguồn | `runCompare` | OK |
| Checklist | Tick từng dòng | `updateChecklist` | OK + lưu |
| Checklist | Sao chép | `copyChecklist` | OK |
| Checklist | Reset | `resetChecklist` | OK |
| Checklist | Mở rộng AI | `aiChecklist` | OK |
| Cài đặt | Lưu | `updateSettingsFromForm` | OK |
| Cài đặt | Test kết nối | `testConnection` | OK |
| Cài đặt | Chẩn đoán | `runDiagnostics` | OK |

## 3. Test tự động

`npm test`: 9/9 test pass tại thời điểm đóng gói.

Đã kiểm tra:
- diện tích tiết diện vành khăn;
- công thức sức kháng nén;
- D600-B của Bảng 1;
- các cấp tải không có AB;
- search + citation;
- local summary;
- wiring các nút chính;
- citation → PDF;
- logic Service Worker không giữ cache cũ.

## 4. Kiểm tra với TCVN 7888:2014 thực tế

Đã dùng lớp text của PDF mẫu để kiểm tra các truy vấn:
- “vết nứt bề mặt cọc 0,05 mm” → ưu tiên trang 14;
- “hồ sơ nghiệm thu” → ưu tiên trang 26/27;
- “vị trí kê cọc 0,21L” → ưu tiên trang 28;
- “sức kháng nén dọc trục” → ưu tiên trang 32.

Với câu hỏi dạng `D600 cấp B`, app có thêm hit chuyên dụng từ Bảng 1 để tránh vấn đề bảng PDF bị tách text theo cột.

## 5. Điểm còn giới hạn

1. PDF scan chưa OCR.
2. AI trực tiếp phụ thuộc CORS/chính sách API của từng nhà cung cấp.
3. Không nên dùng kết quả AI thay cho kiểm tra bản tiêu chuẩn gốc.
4. HNL Bridge phải chạy ở một máy/backend riêng; GitHub Pages không chạy Node server.

## 6. Bổ sung sau khi xem video thao tác thực tế

- Sửa race condition của PDF.js khi người dùng đổi tab/trang/zoom nhanh. Task render cũ không còn có thể xóa trạng thái của task render mới; giảm tình trạng vùng PDF trắng tạm thời hoặc không vẽ lại.
- Nút hiển thị phần trăm zoom nay thực sự **fit theo chiều rộng vùng xem**, thay vì chỉ reset cứng về 108%.
- Tra cứu dạng `D600 cấp B` được nhận diện chuyên dụng trong cả Hỏi đáp và Tra cứu, lấy số liệu cấu trúc từ Bảng 1 khi TCVN 7888:2014 đang được chọn làm nguồn.
- Trên mobile, app mở mặc định ở Thư viện để người dùng tải/chọn PDF trước, tránh vào thẳng Trợ lý khi chưa có nguồn.
- Tóm tắt ưu tiên tài liệu đang mở thay vì vô tình lấy PDF đầu tiên trong danh sách đã tick.
- Logo HNL được làm lại từ ảnh gốc: cắt bỏ nền caro, bóng/khung thừa bên ngoài và chuẩn hóa icon 64/192/512 px nền trong suốt quanh biểu tượng.
