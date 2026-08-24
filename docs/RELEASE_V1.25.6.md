# HNL Pile Standards AI v1.25.6

## Engineering Symbol & Formula Normalizer

### Mục tiêu
Cho phép người dùng copy/dán trực tiếp đề bài và công thức kỹ thuật từ PDF, Word, AI hoặc LaTeX vào Hỏi đáp/Tính mà Router và Calculation Engine vẫn nhận đúng biến, số và đơn vị.

### Pipeline
Raw clipboard → normalizeEngineeringPaste → textarea → normalizeEngineeringText → Engineering Router → deterministic Calculation Engine → Lean Formula-Only Excel.

### Hỗ trợ
- `$...$`, `\(...\)`, `\[...\]`
- `\frac{a}{b}`, `\text{kN}`, `\times`, `\cdot`, `\approx`, `\le`, `\ge`
- `A_p`, `Aₚ`, `Ap`; `q_b`; `f_i`; `γR,f`; `Rbt,ser`; `σsp`; `N_{d,max}`
- `m²/m2/m^2`, `mm²/mm2/mm^2`, dấu phẩy/thập phân, dấu trừ Unicode và ký tự clipboard ẩn.

### Safety
Câu hỏi gốc vẫn được lưu/hiển thị; deterministic parser dùng bản chuẩn hóa riêng. Không dùng AI text làm kết quả số học.
