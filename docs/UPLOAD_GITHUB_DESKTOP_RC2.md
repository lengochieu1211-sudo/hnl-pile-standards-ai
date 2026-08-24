# HNL v1.25.4 RC2 — GitHub Desktop upload fix

Lỗi hai workflow đỏ trước đó: `npm ci` chạy khi repository chưa có `package-lock.json`.

RC2 sửa như sau:
- Web/Windows: nếu thiếu lock, tự tạo `package-lock.json` trên runner rồi mới chạy `npm ci`.
- RC Final Gate: chạy được trên `main`; nếu thiếu lock, tự tạo và commit `package-lock.json` ngược về đúng branch hiện tại.
- Push commit tự động sẽ kích hoạt run kế tiếp với lock đã được lưu thật trong repository.

Không thay đổi Calculation Engine, Excel formulas, Golden data hoặc Search Brain.
