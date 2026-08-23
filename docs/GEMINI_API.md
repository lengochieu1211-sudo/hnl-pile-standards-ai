# Hướng dẫn Gemini API cho HNL Pile Standards AI

## Cách nhanh nhất

1. Mở Google AI Studio API Keys: https://aistudio.google.com/apikey
2. Đăng nhập tài khoản Google.
3. Chọn **Create API key**.
4. Chọn/tạo project nếu được hỏi.
5. Copy API key mới.
6. Trong HNL: **Cài đặt → Google Gemini → Trực tiếp**.
7. Model mặc định: `gemini-3.7-flash` (có thể thay đổi theo thời điểm/tài khoản). Bấm **↻ Model** để lấy danh sách model mà API key thực tế đang dùng được.
8. Dán key vào ô API key → **Kiểm tra kết nối**.

HNL chỉ giữ key trong `sessionStorage` của tab hiện tại. Không đưa API key vào GitHub, file `.js`, `README`, commit hoặc ảnh chụp màn hình.

## Cách an toàn hơn

Dùng HNL Bridge:

1. Copy `bridge/.env.example` thành `bridge/.env`.
2. Điền:

```env
GEMINI_API_KEY=YOUR_KEY
```

3. Không commit `bridge/.env`.
4. Chạy `npm run bridge` hoặc HNL Local.
5. Trong app chọn **Gemini → HNL Bridge**.

## Miễn phí / trả phí

Gemini API có Free Tier tùy model/quota. Không bấm **Set up billing** nếu bạn chỉ muốn tiếp tục dùng mức miễn phí. Nếu tài khoản/project hết quota miễn phí thì app sẽ báo lỗi quota/rate limit; HNL không tự bật thanh toán.
