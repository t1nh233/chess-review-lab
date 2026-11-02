# Chính sách quyền riêng tư — Chess Review Lab

Cập nhật lần cuối: 2026-11-02

Chess Review Lab là tiện ích mở rộng cho Microsoft Edge giúp phân tích lại ván cờ đã kết thúc. **Tiện ích không thu thập, không bán và không chia sẻ dữ liệu cá nhân của bạn.**

## Dữ liệu được xử lý
- **PGN và kết quả phân tích:** được xử lý hoàn toàn trên máy bạn bằng engine Stockfish chạy cục bộ (WebAssembly). Không có máy chủ của chúng tôi, không tài khoản, không cloud engine.
- **Lưu trữ cục bộ:** kết quả phân tích, tên người dùng Chess.com bạn nhập và cài đặt (giao diện, chất lượng phân tích) được lưu trong trình duyệt của bạn (IndexedDB / `chrome.storage`). Bạn có thể xóa từng ván trong mục Lịch sử, hoặc xóa toàn bộ dữ liệu bằng cách gỡ tiện ích.
- **Không** có analytics, telemetry, quảng cáo hay theo dõi.

## Kết nối mạng
Tiện ích chỉ đọc dữ liệu công khai từ Chess.com:
- `api.chess.com/pub/...` để liệt kê các ván đã kết thúc của tên người dùng bạn nhập;
- trang `www.chess.com` bạn đang mở, để nhận biết ván đã kết thúc và lấy PGN (chỉ từ nội dung công khai của trang).

Tiện ích không gọi endpoint riêng tư và không gửi dữ liệu của bạn tới bất kỳ máy chủ nào.

## Nguyên tắc công bằng (fair-play)
Tiện ích từ chối phân tích ván đang diễn ra hoặc không xác định được trạng thái. Chỉ ván đã kết thúc hoặc PGN do bạn nhập mới được phân tích.

## Liên hệ
Mở issue tại https://github.com/t1nh233/chess-review-lab/issues
