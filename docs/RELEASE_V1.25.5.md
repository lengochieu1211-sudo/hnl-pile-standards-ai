# HNL Pile Standards AI v1.25.5

## Chat-to-Calculation-to-Excel
- Câu trả lời kỹ thuật VERIFIED luôn có hành động Excel/Tính/Nguồn.
- Nếu thiếu input, người dùng chuyển nguyên đề bài sang tab Tính, bổ sung và chạy deterministic engine lại.
- Excel lấy Calculation Engine payload, không lấy số AI trong prose.

## Math display
- Hỗ trợ LaTeX inline `$...$`, `\(...\)` và display `$$...$$`.
- Chuyển `\approx`, `\text{kN}`, `R_d`, `N_{d,max}` thành hiển thị đọc được.
- Không cần CDN/KaTeX để tránh lỗi offline.

## Safety
- REVIEW/INDEXED: không xuất numeric Excel.
- VERIFIED thiếu input: chỉ cho bổ sung dữ liệu.
- VERIFIED METHOD: không bịa số.
