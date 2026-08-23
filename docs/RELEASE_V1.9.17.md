# HNL Pile Standards AI v1.9.17

## AI key / model state
- API key theo provider được giữ trong memory + session và dùng chung cho Test Connection, Models API và Chat.
- Bridge mode cũng cho nhập key phiên; nếu để trống mới fallback key cấu hình ở Bridge.
- Text model phía trên/Cài đặt tiếp tục dùng một state; mọi đổi provider/model cần xác nhận.
- Gemini catalog dự phòng luôn có nhãn “Không xác minh được danh sách model”; Models API thật đọc phân trang và chỉ đưa model chat/generateContent vào picker chính.
- Text/Vision/Embedding đều retry model hiện tại; fallback chỉ đổi sau xác nhận OK, không tự chuyển provider/model.

## PDF Smart Region
- Vùng chọn ưu tiên text layer → OCR local (`TextDetector`) → Vision AI chỉ sau khi người dùng đồng ý.
- Chỉ crop vùng đã chọn; không gửi cả trang nếu không cần.
- Context menu hỗ trợ Copy/Hỏi AI/Tra cứu/Tóm tắt/Dùng làm nguồn/Tìm toàn thư viện.
- Quét công thức vùng giữ crop + trang nguồn và không tự Verified/không cho calculator chính thức trước xác minh.

## Archive Desktop
- Giữ source path đầy đủ khi folder/nested archive có file trùng tên.
- Thứ tự engine: 7-Zip → WinRAR/UnRAR → Windows tar → HNL Built-in RAR.
- Cài đặt có chẩn đoán engine và nút mở trang thiết lập 7-Zip.
- Lỗi 7Z/ZIP/RAR nêu rõ engine cần kiểm tra thay vì fail im lặng.

## Offline AI / Bridge
- Electron nạp UI trước, Bridge/Ollama khởi động nền.
- Bridge bind localhost, health phản hồi nhanh và thử cổng 8787–8799.
- Pull model có kiểm tra dung lượng trống và hiển thị mức dự phòng ước tính trước khi người dùng bấm OK.
- Thiếu Ollama không làm crash UI/AI Online.

## Build
- `package.json` là nguồn version chính.
- Version Gate chạy trước test/build.
- Workflow Windows phải có cả Setup và Portable EXE mới upload artifact.
