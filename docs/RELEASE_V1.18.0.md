# HNL Pile Standards AI v1.19.0 — TCVN 5574 Deep Verification Pass 1

Ngày: 2026-08-24

- Source nền duy nhất: v1.17.0 TCVN 10304 Full Audit.
- Không thay `src/search.js`.
- VERIFIED workflow: vật liệu; uốn chữ nhật/T/I CT (31)–(38); nén lệch tâm chữ nhật CT (40)–(48); lực cắt CT (88), (92)–(96); xoắn thuần CT (102), (107), (109), (111)–(113); nén cục bộ không lưới CT (116)–(118); chọc thủng do lực tập trung CT (123)–(128).
- Dedicated calculation engine giữ các workflow ghép công thức tách khỏi generic single-formula evaluator.
- AI → workflow → Excel được nối cho tất cả workflow VERIFIED trên.
- Excel production: Input / vật liệu / tính từng bước / kiểm tra / thuyết minh riêng từng bài toán / provenance / trực quan hệ số sử dụng.
- Vẫn REVIEW: nén gần đúng tâm CT (49)–(50)/Bảng 16; các nhánh cắt phức tạp ngoài route hiện hành; xoắn kết hợp uốn/cắt; nén cục bộ có lưới; chọc thủng có mô men; nứt; biến dạng; ứng suất trước; neo/nối; tiết diện tròn/vành khuyên; công xôn ngắn và các Phụ lục chưa benchmark.
