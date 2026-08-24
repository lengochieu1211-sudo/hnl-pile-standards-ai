# HNL Pile Standards AI v1.13.0 — Universal Engineering Router Audit

## Mục tiêu
Đưa luồng Hỏi đáp về kiến trúc: đề bài → chọn workflow → lấy dữ liệu Verified → Calculation Engine → AI chỉ diễn giải → Excel theo workflow.

## Đã sửa thật trong source
- Thêm `src/engineering-router.js` làm router kỹ thuật dùng chung 3 tiêu chuẩn.
- Chat AI gọi `deterministicEngineeringContext()` trước khi gọi Gemini/OpenAI/Ollama.
- Kết quả số của Calculation Engine được đưa vào prompt như nguồn số học duy nhất; provider không được tự thay số.
- Nếu workflow REVIEW/INDEXED, router vẫn định vị đúng Điều/Công thức/Bảng nhưng khóa tính số.
- Giữ nguyên `src/search.js`; normalized SHA-256 vẫn là `f9b65e5e6fb61dcca233a4fe43950e3174c73536f2fa83452da3041fbd0021d2`.

## Workflow registry
TCVN 10304: cọc chống; cọc đóng/ép; cọc nhồi/khoan; cọc vít; tải tĩnh; thử động; CPT; SPT; lún cọc đơn; lún nhóm; móng khối quy ước; bè-cọc; ảnh hưởng thi công.

TCVN 5574: vật liệu; uốn chữ nhật; nén lệch tâm; cắt; xoắn; nén cục bộ; chọc thủng; nứt; biến dạng; ứng suất trước; neo/nối; tiết diện tròn/vành khuyên; công xôn ngắn.

TCVN 7888: PC/PHC/NPH theo Bảng 1/2 và Phụ lục B.

## VERIFIED có thể tạo số hiện tại
- TCVN 10304: cọc chống CT (5)–(8); cọc đóng/ép CT (9), Bảng 2/3/4.
- TCVN 7888: Bảng 1/2, Điều 6.2, Phụ lục B B.1–B.5.
- TCVN 5574: Bảng 7/10/13/14; uốn tiết diện chữ nhật CT (33)–(35).

## REVIEW — chưa được phép tự tính
Các workflow còn lại trong registry vẫn khóa số học cho tới khi từng công thức + bảng + điều kiện + đơn vị + trang chuẩn/PDF + benchmark được Verified. Đây là hành vi chủ động để tránh AI sáng tác công thức.

## Golden/Regression thực chạy
- `npm test`: 161/161 PASS.
- Version Gate v1.13.0: PASS.
- Search Brain Guard: PASS.
- B30: Rb=17 MPa, Rbt=1.15 MPa, Eb=32500 MPa: PASS.
- CB400-V: Rs/Rsc=350 MPa, Rsw=280 MPa: PASS.
- Cọc vuông 12 m, a=0.4 m: router tính A=0.16 m², u=1.6 m và dừng đúng khi thiếu địa chất: PASS.
- Uốn chữ nhật CT (34),(35): deterministic calculation test PASS.
- REVIEW workflow không sinh số: PASS.

## Build
`npm run build:web` chưa chạy được trong sandbox vì executable `vite` chưa được cài trong node_modules (`vite: not found`). Không báo build PASS giả. GitHub Actions/`npm ci` cần chạy build thực tế sau khi upload source.

## Tiếp tục để đạt “bất kỳ đề bài nào đều tính được”
Kiến trúc router đã sẵn sàng, nhưng để đạt 100% numeric coverage cần lần lượt chuyển các module REVIEW sang VERIFIED, ưu tiên toàn bộ TCVN 10304 trước, sau đó TCVN 7888 Phụ lục A/kiểm thử thân cọc, rồi các module TCVN 5574.
