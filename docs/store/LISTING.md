# Nội dung đăng Microsoft Edge Add-ons

## Thông tin cơ bản
- **Tên:** Chess Review Lab - Phân tích ván cờ
- **Danh mục:** Productivity (hoặc Fun/Games nếu có)
- **Ngôn ngữ:** Tiếng Việt
- **Hiển thị:** Public
- **Chính sách riêng tư (URL):** https://github.com/t1nh233/chess-review-lab/blob/main/docs/PRIVACY_POLICY.md (repo phải ở chế độ public)
- **Trang hỗ trợ:** https://github.com/t1nh233/chess-review-lab/issues
- **Mã nguồn:** https://github.com/t1nh233/chess-review-lab (GPL-3.0)

## Mô tả ngắn (≤132 ký tự)
Phân tích lại ván cờ đã kết thúc ngay trên trình duyệt với Stockfish 18. Không tài khoản, không máy chủ, không theo dõi.

## Mô tả dài
Chess Review Lab giúp bạn xem lại ván cờ vừa chơi: nước nào hay, nước nào sai, nên đi gì thay thế.

- Chọn ván đã kết thúc từ danh sách Chess.com của bạn, từ trang đang mở, dán PGN hoặc tải file .pgn
- 10 loại nhận xét kiểu Game Review: Thiên tài, Tuyệt vời, Khai cuộc, Tốt nhất, Xuất sắc, Tốt, Thiếu chính xác, Sai lầm, Bỏ lỡ, Sai nghiêm trọng
- Độ chính xác của mỗi bên, biểu đồ đánh giá, nước đi tốt nhất, thời gian từng nước
- Phân tích 100% trên máy bạn bằng Stockfish 18 — đóng popup không làm mất tiến trình
- Giao diện tối/sáng, lưu lịch sử phân tích cục bộ, xuất PGN
- Tôn trọng fair-play: tự động từ chối ván đang diễn ra

Chess Review Lab là dự án độc lập, không liên kết hay được bảo trợ bởi Chess.com. Mã nguồn mở theo GPL-3.0 (Stockfish).

## Giải trình quyền (Notes for certification)
| Quyền | Lý do |
|---|---|
| `activeTab` | Đọc tab Chess.com hiện tại khi người dùng mở popup, để kiểm tra ván đã kết thúc và lấy PGN. |
| `storage` | Lưu cài đặt giao diện, tên người dùng Chess.com và lịch sử phân tích cục bộ. |
| `offscreen` | Chạy engine Stockfish ở nền để đóng popup không làm hủy phân tích. |
| `alarms` | Mỗi phút kiểm tra kho lưu trữ công khai xem có ván mới kết thúc để hiện huy hiệu "NEW". |
| `https://www.chess.com/*` | Content script đọc nội dung công khai của trang ván cờ để xác định ván đã kết thúc và lấy PGN. |
| `https://api.chess.com/*` | Đọc danh sách ván đã kết thúc từ API công khai `api.chess.com/pub`. |
| `'wasm-unsafe-eval'` (CSP) | Bắt buộc để chạy WebAssembly của Stockfish được đóng gói cục bộ; không tải mã từ xa. |

## Tài sản cần chuẩn bị (thủ công)
- Ảnh chụp màn hình 1280×800 (1–6 ảnh): popup trạng thái sẵn sàng, tiến độ phân tích, popup kết quả, trang review, chế độ tối/sáng
- Logo 300×300: đã có `docs/store/assets/logo-300x300.png` (linh vật Tốt trên nền trời)
- Tile quảng bá nhỏ 440×280 (tùy chọn nhưng nên có)
