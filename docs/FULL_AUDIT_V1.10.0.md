# HNL Pile Standards AI v1.10.0 — Full Professional Workspace Audit

Ngày audit: 2026-08-23

## 1. Mục tiêu bản 1.10.0

Bản này tập trung biến HNL Pile Standards AI từ một tập chức năng riêng lẻ thành một workspace kỹ thuật dễ dùng, nhưng **không thay “bộ não tìm kiếm” đã chứng minh hoạt động tốt ở v1.9.23**.

Nguyên tắc bố trí:

- Chức năng dùng thường xuyên luôn thấy.
- Chức năng nâng cao nằm trong `Xem chi tiết`, `Lịch sử`, `Cài đặt` hoặc panel phụ.
- Provider / Model / Native PDF / Khóa nguồn chỉ có một nguồn state và một nơi điều khiển chính.
- Tra cứu và Công thức dùng chung tư duy `Phạm vi`, nhưng mặc định tiết kiệm tài nguyên.
- Không tự mở rộng phạm vi, đổi model/provider hay tải model nặng khi người dùng chưa đồng ý.
- Citation và kết quả AI phải quay lại được PDF/trang nguồn.

## 2. Search brain được khóa nguyên v1.9.23

`src/search.js` giữ nguyên byte-for-byte theo v1.9.23.

SHA-256:

`f9b65e5e6fb61dcca233a4fe43950e3174c73536f2fa83452da3041fbd0021d2`

Regression test sẽ FAIL nếu file này bị thay đổi.

Các phần phạm vi trang được tách sang `src/scope.js`, tránh đưa UI/parser vào lõi ranking/search.

Golden tests có các ca:

- `cọc chống là gì`
- mục lục `cọc chống ... 28`
- `cọc ma sát`
- truy vấn Phụ lục ở cuối tài liệu
- hash search brain v1.9.23

## 3. Bố cục giao diện sau audit

### Thư viện — panel trái

Ưu tiên thao tác thường dùng:

- Tìm tài liệu.
- Lọc loại tài liệu.
- Ghim tài liệu thường dùng.
- Phân loại: tiêu chuẩn / thiết kế / biện pháp / nghiệm thu / báo cáo / khác.
- Chọn nguồn AI/RAG.
- Cảnh báo tài liệu cùng họ hoặc phiên bản khác để tránh dùng nhầm bản.
- Undo/Redo các thay đổi thư viện phù hợp.

Thông tin kỹ thuật sâu không chiếm diện tích thường trực.

### PDF Viewer — vùng giữa

Giữ các thao tác đọc chính ở toolbar:

- tìm chữ / Điều / Bảng / Phụ lục;
- liên tục / 1 trang;
- zoom;
- trang;
- AI / Focus;
- bookmark;
- chọn text / chọn vùng OCR.

Đã bổ sung:

- bookmark trang;
- ghi chú / highlight vùng;
- khôi phục annotation đã lưu;
- lazy canvas rendering trong Continuous View dựa trên viewport;
- Performance Mode điều chỉnh vùng render trước/sau.

### Trợ lý AI — panel phải

Giữ 7 tab nghiệp vụ, chức năng nâng cao nằm trong từng tab hoặc Cài đặt.

Provider + Model + trạng thái kết nối không lặp ở nhiều hàng. AI & Kết nối là nguồn điều khiển chính.

Native PDF được trình bày compact; giải thích giới hạn nằm trong `Xem chi tiết`.

## 4. Phạm vi Tra cứu / Công thức

Tra cứu hỗ trợ:

- Thông minh;
- Vùng chọn;
- Trang hiện tại;
- Nhiều trang;
- Tài liệu hiện tại;
- Tài liệu đã tick;
- Toàn thư viện.

Công thức ưu tiên tiết kiệm hơn:

- Vùng chọn;
- Trang hiện tại (mặc định);
- Nhiều trang;
- Tài liệu hiện tại;
- Tài liệu đã tick;
- Toàn thư viện.

Parser nhiều trang hỗ trợ dạng `28-35`, `28,31,45` và nằm ngoài search brain.

OCR/Vision không được tự quét toàn bộ tài liệu nếu người dùng chỉ chọn vùng hoặc vài trang.

## 5. PDF lớn / Native PDF

Nếu PDF phù hợp giới hạn Native PDF, HNL có thể dùng luồng Native + RAG.

Nếu PDF vượt giới hạn an toàn Native (ví dụ >50 MB), v1.10.0 dùng **Targeted Page Batch**:

1. RAG / TOC định vị trang có khả năng liên quan.
2. Chỉ render các trang đích + lân cận thành ảnh.
3. Gửi Page Batch cho Vision/AI trong giới hạn Performance Mode.
4. Giữ số trang gốc cho citation.

Đây là Page Batch theo trang mục tiêu, **không phải dựng lại toàn bộ PDF thành nhiều file PDF con**.

## 6. Sức khỏe tài liệu / Re-index

Có kiểm tra tài liệu để hiển thị:

- số trang;
- số trang có text thô / text hữu dụng;
- ước tính trang scan;
- trạng thái text index;
- khả năng Native PDF;
- bookmark/highlight;
- tài liệu cùng họ/phiên bản;
- điểm sức khỏe và nhãn trạng thái.

Có:

- Lập chỉ mục lại tài liệu hiện tại.
- Lập chỉ mục lại toàn thư viện.

Không cần xóa PDF rồi import lại chỉ để rebuild text index.

## 7. Chất lượng câu trả lời / Citation

Mỗi câu trả lời AI có metadata phương thức đọc:

- RAG;
- OCR + RAG;
- Vision + RAG;
- Native PDF + RAG;
- Page Batch + RAG.

Có mức tin cậy `Cao / Trung bình / Thấp` dựa trên bằng chứng đang có và nút `Kiểm tra nguồn` để đối chiếu lại citation với trang tài liệu.

Nếu nguồn không đủ, không được tự biến nội dung AI thành Verified.

## 8. Bookmark / Note / Workspace

Đã bổ sung:

- bookmark trang;
- highlight/ghi chú vùng PDF;
- lưu vị trí vùng theo tọa độ chuẩn hóa;
- tự lưu workspace;
- mở lại đúng tài liệu, trang, zoom, tab, scope và layout hợp lệ;
- giữ session chat hiện hành nếu còn tồn tại.

## 9. Lịch sử Hỏi đáp / Tính toán

Chat history:

- lưu local-first;
- tìm kiếm;
- ghim;
- đổi tên;
- xóa;
- export JSON / Markdown / PDF qua Print.

Calculation history tiếp tục lưu input / kết quả / nguồn / version và cho phép nạp lại.

API key không được đưa vào lịch sử.

## 10. Backup / Gói chẩn đoán

Backup ZIP chứa metadata an toàn:

- settings không nhạy cảm;
- workspace;
- checklist;
- metadata tài liệu;
- chat history;
- calculation history.

Không chủ động đưa API key vào backup.

Gói chẩn đoán ZIP chứa version/runtime/document-health/search statistics/log đã sanitize để người dùng gửi khi gặp lỗi mà không cần quay video dài.

## 11. So sánh / kiểm tra hồ sơ

Tab So sánh hỗ trợ:

- so sánh tiêu chuẩn/tài liệu;
- kiểm tra mâu thuẫn hồ sơ giữa nhiều nguồn.

Audit prompt tập trung vào:

- số liệu;
- tiêu chuẩn viện dẫn;
- điều kiện áp dụng;
- vật liệu;
- dung sai;
- nghiệm thu;
- công thức;
- nguồn và trang.

Điểm chưa chắc chắn phải ghi `Cần kiểm tra`.

## 12. Chế độ hiện trường / Hiệu năng

Performance Mode:

- Nhẹ;
- Cân bằng;
- Mạnh.

Điều chỉnh:

- phạm vi canvas render trước/sau viewport;
- số trang Page Batch/Vision;
- mức retrieval phù hợp.

Field Mode thu gọn phần ít cần thiết để thao tác nhanh trên màn hình nhỏ/laptop hiện trường.

## 13. Windows build hardening

Desktop workflow vẫn dùng:

- Version Gate;
- Test;
- Build Desktop;
- Verify Setup;
- Verify Portable;
- Smoke Test Portable;
- Upload artifact.

Portable được chạy với `--smoke-test` trên GitHub Windows runner để kiểm tra:

- `package.json`;
- `dist/index.html`;
- `bridge/server.mjs`;
- `dist/build-info.json`;
- version runtime/package/build-info đồng bộ.

Smoke-test timeout/non-zero sẽ làm workflow FAIL.

## 14. Kết quả kiểm tra source

- Version: **1.10.0**
- `npm test`: **132/132 PASS, 0 FAIL**
- `npm run check:version`: **PASS**
- JS/MJS/CJS syntax: **17/17 PASS**
- JSON parse: **2/2 PASS**
- GitHub Actions YAML parse: **2/2 PASS**
- Search brain SHA-256 v1.9.23: **MATCH**
- Secret scan theo pattern API key phổ biến: **0 key thật phát hiện**

### Literal UI ID audit

Các ID trạng thái quan trọng chỉ có một nguồn điều khiển:

- `providerSelect`: 1
- `modelInput`: 1
- `nativePdfModeInput`: 1
- `assistantSettingsSummary`: 1
- `strictSide`: 1

Một số literal ID xuất hiện nhiều lần trong source nhưng chỉ ở các nhánh render loại trừ nhau, không xuất hiện đồng thời trên DOM (`pdfScroll`, `pageRange`, `aiChecklist`, `refreshLocalModelManager`).

## 15. Build thực tế trong môi trường audit

`npm run build:web` đã được chạy và **FAIL vì thiếu dependency đã cài**:

`vite: not found` (exit 127)

ZIP source không có `node_modules`. Một lần cài dependency trong môi trường audit trước đó cũng bị timeout và không tạo được `node_modules`.

Vì vậy báo cáo **không đánh dấu Web build hoặc Windows EXE runtime là PASS** trong môi trường hiện tại.

Workflow Windows và smoke-test đã được kiểm tra ở mức source/config; build và chạy EXE thật cần GitHub Actions/Windows runner.

## 16. Ca kiểm thử thực tế cần giữ sau deploy

Sau khi deploy/build, ưu tiên kiểm tra bằng chính PDF TCVN 10304:2025 thực tế:

1. `cọc chống`
2. `cọc chống là gì`
3. `cọc ma sát`
4. Điều/Bảng/Phụ lục ở các trang cuối
5. thử từng scope: Trang hiện tại / Nhiều trang / Tài liệu / Toàn thư viện
6. PDF >50 MB → xác nhận Page Batch chỉ đọc trang mục tiêu và citation quay về đúng trang gốc.

Bất kỳ bản sau nào cho kết quả tìm kiếm kém hơn v1.9.23 ở Golden Test phải được coi là regression.
