# HNL Pile Standards AI v1.9.22

## Full Runtime Audit · Upstream Error Fidelity · Bridge Request Guard

- Direct API và HNL Bridge đọc response body đúng một lần, giữ được lỗi JSON lẫn lỗi text/non-JSON từ upstream.
- HNL Bridge từ chối request AI quá lớn hoặc sai schema trước khi gọi provider, giảm nguy cơ treo/cạn RAM.
- Lịch sử chat cảnh báo rõ khi một phần PDF nguồn không còn trong IndexedDB.
- Đã đối chiếu cấu trúc OpenAI PDF native `input_file.detail` với OpenAI Docs chính thức.
- Đã chạy version gate, kiểm tra cú pháp toàn bộ JS và regression suite.

## Trạng thái build

Source đã sẵn sàng cho GitHub Actions. Setup/Portable EXE vẫn cần runner Windows có dependency đầy đủ để tạo artifact thực tế.
