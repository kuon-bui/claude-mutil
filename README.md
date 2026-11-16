# Claude Accounts

Extension VS Code giữ sẵn đăng nhập của nhiều tài khoản Claude Code. Mỗi dự án nhớ tài khoản của nó; đổi tài khoản bằng một cú bấm trên thanh trạng thái. Extension không bao giờ đọc, chép hay gửi token.

> **Bản 0.1.0 chưa được kiểm bằng tay.** Logic có test tự động và cơ chế đổi tài khoản đã được thử trên Windows 11, nhưng chưa ai chạy hết các bước trong `docs/verification.md` với extension đã cài, và chưa thử trên macOS hay Linux. Nếu gặp lỗi, hãy báo kèm hệ điều hành và phiên bản Claude Code.

## Cài đặt

1. Cần extension **Claude Code** (`anthropic.claude-code`) bản 2.1.323 trở lên.
2. Trong VS Code: **Extensions** → `…` → **Install from VSIX…** → chọn `claude-account-switcher-0.1.0.vsix`.
   Hoặc trong terminal: `code --install-extension claude-account-switcher-0.1.0.vsix`.
3. Tải lại cửa sổ. Thanh trạng thái (góc trái) hiện **Claude: Mặc định**, chính là tài khoản bạn đang đăng nhập sẵn.

## Lệnh

| Lệnh | Làm gì |
|---|---|
| **Claude Accounts: Đổi tài khoản** (hoặc bấm vào thanh trạng thái) | Chọn tài khoản cho dự án đang mở. Lựa chọn được nhớ theo thư mục. |
| **Claude Accounts: Thêm tài khoản** | Đặt tên, rồi đăng nhập trong terminal vừa mở (trình duyệt sẽ mở trang đăng nhập). |
| **Claude Accounts: Quản lý hồ sơ** | Đổi tên, đăng nhập lại, hoặc xoá một hồ sơ. |

Đổi tài khoản xong, extension đề nghị **tải lại cửa sổ**: Claude Code chỉ nhận tài khoản mới khi khởi động lại.

Mở một dự án chưa chọn tài khoản, extension hỏi một lần. Bỏ qua thì dự án dùng **Mặc định** và thanh trạng thái ghi "(chưa chọn)".

## Hoạt động thế nào

- Hồ sơ **Mặc định** là `~/.claude` hiện có. Mỗi hồ sơ khác là một thư mục `~/.claude-profiles/<id>`.
- Mỗi cửa sổ VS Code đặt `CLAUDE_CONFIG_DIR` cho Claude Code của riêng nó, nên hai cửa sổ có thể chạy hai tài khoản cùng lúc.
- Cặp dự án–tài khoản lưu trong bộ nhớ của extension, không ghi vào `.vscode/settings.json` của dự án.

### Dùng chung và tách riêng

| Phần | Giữa các hồ sơ |
|---|---|
| Đăng nhập | **Tách riêng** |
| Lịch sử hội thoại (`projects/`) | Dùng chung: tài khoản này mở tiếp được hội thoại của tài khoản kia |
| `skills/`, `plugins/`, `commands/` | Dùng chung |
| `settings.json`, `CLAUDE.md` | **Chép** từ `~/.claude` lúc tạo hồ sơ, sau đó mỗi hồ sơ một bản |

`settings.json` và `CLAUDE.md` không dùng chung được bằng liên kết: Claude Code lưu chúng bằng cách thay file, làm gãy liên kết. Vì vậy thiết lập (kể cả model, plugin nào đang bật) và `CLAUDE.md` đổi ở hồ sơ nào thì chỉ hồ sơ đó nhận.

## Lưu ý

- **Thiết lập `claudeCode.environmentVariables`:** nếu bạn đã đặt `CLAUDE_CONFIG_DIR` trong thiết lập này, Claude Code ưu tiên nó và extension không đổi được tài khoản. Extension sẽ cảnh báo; hãy xoá `CLAUDE_CONFIG_DIR` khỏi thiết lập đó.
- **Claude Console (khoá API):** tài khoản dùng khoá API đặt qua biến môi trường (`ANTHROPIC_API_KEY`) không tách được theo thư mục; extension chỉ tách các đăng nhập lưu trong thư mục cấu hình.
- **Xoá hồ sơ** chỉ xoá thư mục `~/.claude-profiles/<id>` (gồm đăng nhập của hồ sơ đó); lịch sử hội thoại và các thư mục dùng chung được giữ lại. Trên macOS, mục đăng nhập trong Keychain không bị xoá; hãy đăng xuất trong Claude trước nếu muốn gỡ hẳn.
- **Remote / WSL:** extension chạy cùng máy với Claude Code; hồ sơ nằm trong thư mục home của máy đó.
- Trên Windows, các thư mục dùng chung là junction (không cần quyền admin).
