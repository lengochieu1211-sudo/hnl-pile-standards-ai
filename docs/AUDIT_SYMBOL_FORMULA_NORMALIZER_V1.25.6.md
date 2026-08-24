# Audit v1.25.6 — Engineering Symbol & Formula Normalizer

## Lỗi đã xử lý
- Copy/dán công thức từ PDF, Word, AI hoặc LaTeX không còn làm Router bỏ sót biến kỹ thuật do `$`, `\frac`, `\text`, chỉ số dưới/trên, ký hiệu Hy Lạp, đơn vị m²/mm², dấu phẩy thập phân hoặc ký tự clipboard ẩn.
- Cả `#chatQuestion` và `#chatCalcQuestionEdit` dùng cùng clipboard normalizer.
- Hỏi đáp giữ câu hỏi gốc để hiển thị/lịch sử; Calculation Engine và Excel dùng `normalizedQuestion`.
- Sửa regression quan trọng: `As` không còn bị nhận nhầm thành `As'`; alias có dấu prime bắt buộc phải có prime.
- Khôi phục parser ngôn ngữ tự nhiên `cạnh 0,4 m` và parser nhiều lớp phân cách bằng dấu chấm phẩy.

## Golden mới
- `300 × 300 mm + A=A_p=0,09 m²` → A=0,09 m², u=1,2 m, không hỏi lại diện tích mũi.
- `γ_{R,f}`, `R_{bt,ser}`, `σ_{sp}`, `q_b`, `f_i`, `A_s'`, `N_{d,\max}` được chuẩn hóa/đọc đúng.
- `\frac{\sigma_{cu}}{3,5}` → `(sigma_cu)/(3,5)`; không còn lộ `\frac` cho parser.

## Kết quả chạy thực
- `npm test`: 286/286 PASS.
- `npm run golden:tables`: 1.130/1.130 PASS.
- Search Brain guard: PASS, normalized SHA-256 `f9b65e5e6fb61dcca233a4fe43950e3174c73536f2fa83452da3041fbd0021d2`.
- `node --check` cho main/router/normalizer: PASS.

## GitHub
ZIP không cần xóa `package-lock.json` đang có trong repo local. Workflow v1.25.6 tự đồng bộ lock version khi package.json đổi.
