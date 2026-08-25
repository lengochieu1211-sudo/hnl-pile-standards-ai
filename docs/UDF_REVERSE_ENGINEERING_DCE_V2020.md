# UDF/XLL Reverse Engineering — DCE Workbook

Nguồn: formula XML + VBA source extracted từ workbook. XLL binary implementation không nằm trong XLSM; do đó BLACK_BOX/INFERRED không được gắn VERIFIED.

| `_xll.TimTinhChatDatCotTU` | 1744 | property at z / EQ variants | INFERRED | Keep REVIEW for selector semantics. |
| `_xll.flu_CocMaSatKMD` | 863 | f/segment/cumulative shaft | INFERRED/REVIEW | Workbook chứng minh pattern cumulative-at-head / cumulative-at-tip. |
| `_xll.flu_CocMaSatCMD` | 855 | shaft bored | BLACK_BOX/REVIEW | Thiếu layer-by-layer implementation minh bạch. |
| `_xll.flu_SPT2025` | 548 | shaft SPT | BLACK_BOX/REVIEW | PDF TCVN 10304:2025 đã locate; cần targeted extraction Phụ lục D + benchmark độc lập. |
| `_xll.TimTenLoaiDat` | 498 | soil name at z | INFERRED | Replaced by generic BoreholeEngine, no XLL dependency. |
| `_xll.TimTinhChatDat` | 498 | property at z | INFERRED | Replaced by generic BoreholeEngine/profile data access. |
| `_xll.Qb_CocMaSatKMD` | 361 | Qb hoặc γRR/qb diagnostic | INFERRED/REVIEW | Đối chiếu bằng HNL Bảng 2/4; không sao chép XLL. |
| `_xll.fluEQ_SPT2025` | 338 | fiEQ | BLACK_BOX/REVIEW | P2. |
| `_xll.qbEQ_SPT2025` | 239 | qbEQ | BLACK_BOX/REVIEW | P2. |
| `_xll.TinhGammaqbCMS` | 218 | γeq tip | BLACK_BOX/REVIEW | P2. |
| `_xll.TinhGammafiCMS` | 218 | γeq shaft | BLACK_BOX/REVIEW | P2. |
| `_xll.Qb_CocMaSatCMD` | 179 | Qb bored | INFERRED/REVIEW | HNL Bảng 7/8 VERIFIED; XLL chỉ benchmark. |
| `_xll.qb_SPT2025` | 169 | qb SPT | BLACK_BOX/REVIEW | PDF TCVN 10304:2025 đã locate; cần targeted extraction Phụ lục D + probe benchmark độc lập. |
| `_xll.NoiSuySPT` | 140 | N nội suy | BLACK_BOX/REVIEW | Không dùng cached result để xác minh. |
| `_xll.LNgamTrongDat` | 1 | chiều dài ngàm trong lớp mũi | INFERRED | Có cached benchmark; thuật toán hình học có thể viết độc lập, nhưng UDF không dùng Production. |
| `_xll.TinhGammaqb` | 1 | hệ số mũi | BLACK_BOX | Chưa có implementation XLL. |
| `_xll.GetKsFromRQD` | 1 | Ks/Kr | BLACK_BOX | Bảng 1 HNL cho khoảng Kr, không phải hàm đơn trị. Cached RQD=30→0.24 không đủ xác minh. |

Chi tiết structured: `artifacts/p0-xlsm-audit/p0-gap-matrix-v1.25.7.json`.
