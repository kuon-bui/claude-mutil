# Kết quả bản thử (Task 1)

> Điền từng mục sau khi làm. Ô `…` là chỗ cần điền. Script nằm trong `spike/`, chạy bằng `pwsh` (PowerShell 7).
>
> Các mục ghi "Phân tích mã" lấy từ `extension.js` của Claude Code 2.1.323 (`%USERPROFILE%\.vscode\extensions\anthropic.claude-code-2.1.323-win32-x64`). Mã đã bị nén nên tên hàm như `mo`, `Jne` có thể đổi ở bản sau.

## Step 1: Phiên bản

| Mục | Giá trị |
|---|---|
| Hệ điều hành | Windows 11 Pro 10.0.26200 (x64) |
| VS Code | 1.146.0 |
| Claude Code (extension) | 2.1.323 (`anthropic.claude-code-2.1.323-win32-x64`) |
| Lệnh `claude` trên PATH | Không có. Extension kèm sẵn `resources\native-binary\claude.exe` (2.1.323) |

## Phân tích mã: Claude Code khởi tiến trình thế nào

- Biến môi trường cho tiến trình con do hàm `mo()` dựng, và hàm này được gọi lại mỗi lần khởi tiến trình:
  1. Chép `{...process.env}` của extension host.
  2. Thêm từng mục trong `claudeCode.environmentVariables`, **trừ** `CLAUDE_CONFIG_DIR`.
  3. Nếu `environmentVariables` có `CLAUDE_CONFIG_DIR` với giá trị là đường dẫn tuyệt đối, nó đè lên giá trị lấy từ `process.env`.
  4. Đặt `CLAUDE_CODE_ENTRYPOINT=claude-vscode` và xoá vài biến nội bộ.
- Có `claudeProcessWrapper` thì lệnh chạy là `wrapper <đường dẫn claude.exe> <tham số SDK…>`.
- SDK gọi `child_process.spawn(command, args, { env, windowsHide: true })`, **không có `shell`**.
- Claude Code kích hoạt ở `onStartupFinished` hoặc `onWebviewPanel:claudeVSCodePanel`. Một extension dùng `activationEvents: ["*"]` sẽ chạy trước trong trường hợp thường.
- Claude Code theo dõi thay đổi của `claudeCode.environmentVariables` và `claudeCode.claudeProcessWrapper`, và đổi theo file `.claude.json` của thư mục cấu hình mới ("Failed to follow a CLAUDE_CONFIG_DIR change…").
- Tên mục lưu đăng nhập: khi có `CLAUDE_CONFIG_DIR`, tên dịch vụ có thêm 8 ký tự hash của đường dẫn (`Claude Code-credentials-<hash>`). Vì vậy trên macOS mỗi hồ sơ có mục Keychain riêng, không đè lên nhau.

## Step 2: Hồ sơ thứ hai

`claude auth login` có thật (`claude auth --help` liệt kê `login`, `logout`, `status`; `login` có các tuỳ chọn `--claudeai` (mặc định), `--console`, `--email`, `--sso`).

Chạy nền không được: lệnh mở trình duyệt rồi chờ dán mã (`Paste code here if prompted >`), nên cần terminal có ô nhập. Bạn tự chạy:

```
pwsh -File spike\1-login.ps1
```

Ở trình duyệt, chọn **tài khoản thứ hai** (đăng xuất hoặc đổi tài khoản trên claude.ai nếu đang đăng nhập tài khoản chính). Nếu được hỏi mã, dán vào terminal.

- `LOGIN_COMMAND`: `claude auth login`. **Đạt.** Lệnh mở trình duyệt, trình duyệt chuyển về `http://localhost:<cổng>/callback` và lệnh tự kết thúc (`Login successful.`, mã thoát 0). Chạy nền cũng được, miễn là người dùng hoàn tất ở trình duyệt khi lệnh còn chạy. Dòng `Paste code here if prompted` chỉ dùng khi trình duyệt không chuyển về được `localhost`.
- Trường email trong `.claude.json`: `oauthAccount.emailAddress` (đúng như dự kiến). `oauthAccount` còn có `displayName`, `organizationName`.
- Có `.credentials.json` trong hồ sơ sau khi đăng nhập: có. Hồ sơ mới có `.claude.json`, `.credentials.json`, `backups/`.
- Đăng nhập mặc định (`~/.claude`) vẫn còn sau bước này: còn. `claude auth status` của hai hồ sơ cho `configDirectory` khác nhau và `loginExpiresAt` khác nhau, tức là hai lần đăng nhập độc lập.
- `claude auth status` in JSON có `email`, `configDirectory`, `projectsDirectory`. Dùng được để kiểm tra một cửa sổ đang chạy bằng hồ sơ nào.
- Lần đăng nhập đầu dùng nhầm cùng tài khoản với hồ sơ mặc định. Chạy lại `claude auth login` với `BROWSER` trỏ vào Edge (nơi có tài khoản thứ hai) thì được: hồ sơ spike giờ là tài khoản thứ hai (email khác, gói Pro), hồ sơ mặc định vẫn là tài khoản chính (gói Team), `loginExpiresAt` của hồ sơ mặc định không đổi. **Đăng nhập lại ghi đè trong hồ sơ, không ảnh hưởng hồ sơ khác.**
- `claude auth login` **tôn trọng biến `BROWSER`**. Task 8 có thể dùng điều này (ví dụ thêm tuỳ chọn chọn trình duyệt), vì người có nhiều tài khoản thường giữ mỗi tài khoản trong một trình duyệt hay một hồ sơ trình duyệt riêng.

## Step 3: `processEnv`

Phân tích mã: **được hỗ trợ.** `mo()` chép `process.env` lúc khởi tiến trình, và Claude Code kích hoạt muộn hơn extension dùng `"*"`. Vẫn cần thử thật để chắc rằng phần hiển thị tài khoản trong khung chat cũng theo đúng hồ sơ.

1. Đóng hết cửa sổ VS Code.
2. Từ Windows Terminal (không phải terminal trong VS Code): `pwsh -File spike\2-open-vscode-processEnv.ps1 <thư mục dự án>`.
3. Mở khung chat Claude, xem tài khoản (gõ `/status` hoặc xem mục tài khoản).

Thử thay thế không cần đóng VS Code: extension thử `spike/probe-extension` (`activationEvents: ["*"]`) đặt `process.env.CLAUDE_CONFIG_DIR` lúc kích hoạt, chạy trong cửa sổ Extension Development Host (`code --extensionDevelopmentPath=<thư mục> --new-window <dự án>`). Cách này giống hệt cơ chế extension thật sẽ dùng, nên sát thực tế hơn cách mở VS Code từ terminal. Chỉ Reload Window thì không đủ, vì extension host lấy biến môi trường từ tiến trình VS Code đang chạy.

- Thứ tự kích hoạt (log `spike/probe-log.txt`): extension thử chạy khi Claude Code **chưa** kích hoạt (`isActive = false`).
- Kết quả: **ĐẠT.** `/status` trong cửa sổ thử hiện `Login method: Claude Pro account` và email của tài khoản thứ hai, trong khi cửa sổ VS Code thường cùng lúc vẫn chạy tài khoản chính (Team). Mỗi cửa sổ có extension host riêng, nên `processEnv` cho từng cửa sổ một tài khoản (`perWindow: true`).
- `Setting sources: User settings, Shared project settings`: Claude Code trong hồ sơ spike đọc được `settings.json` qua hard link.
- Ghi chú: `Working folder` trong `/status` là `C:\Users\kuon`, không phải thư mục dự án truyền vào. Cần kiểm tra cửa sổ thử có mở đúng thư mục không trước khi làm Step 7.
- Thêm: để khung chat Claude **đang mở**, rồi tải lại cửa sổ (Developer: Reload Window). Tài khoản vẫn đúng: **đạt** (người dùng xác nhận).

## Step 4: `wrapper`

**Không đạt trên Windows** (phân tích mã và chạy thử, không cần thử trong VS Code):

- SDK gọi `spawn` không có `shell`; Node từ chối chạy file `.cmd` hay `.bat` theo cách này. Chạy thử `spawn('spike\\wrapper-log.cmd', ['x'])` bằng Node 25.9.0 → `throw: EINVAL`.
- Muốn dùng cách này trên Windows thì script bọc phải là file `.exe`, không phải script.
- Có script bọc thì Claude Code cũng đổi hành vi: ép `permissionMode` về `default`, bỏ `onProcessSpawned`, bật `includeProgrammaticSessions`.
- Thứ tự tham số (để tham khảo cho macOS/Linux): `wrapper <đường dẫn claude> <tham số…>`, khớp với script `exec "$@"` trong plan.

## Step 5: `envSetting`

Phân tích mã: **được hỗ trợ chính thức.** Claude Code xử lý riêng `CLAUDE_CONFIG_DIR` trong `environmentVariables`: giá trị phải là đường dẫn tuyệt đối, và nó đè lên `process.env`. Claude Code còn tự theo thay đổi của thiết lập này.

- Phạm vi Workspace: **không dùng được.** `package.json` của Claude Code khai `claudeCode.environmentVariables` với `scope: "machine"`, nên VS Code bỏ qua giá trị đặt trong `.vscode/settings.json`. Cách này chỉ áp dụng cho cả máy (mọi cửa sổ), đúng với `perWindow: false` trong plan.
- **Hệ quả cho `processEnv`:** nếu người dùng đã đặt `CLAUDE_CONFIG_DIR` trong `claudeCode.environmentVariables`, giá trị đó thắng `process.env` và extension mình mất tác dụng. Task 7 nên phát hiện trường hợp này và cảnh báo.

Thử thật (nên làm, vì đây là cách dự phòng): thêm vào User `settings.json`, tải lại cửa sổ, rồi xoá khi xong:

```json
"claudeCode.environmentVariables": [
  { "name": "CLAUDE_CONFIG_DIR", "value": "C:\\Users\\kuon\\.claude-profiles\\spike" }
]
```

- Phạm vi User: không thử thật, vì `processEnv` đã đạt trước (Step 8 lấy cách đầu tiên đạt).

## Step 6: Đăng nhập độc lập

Với cách đã đạt: mở hai cửa sổ, một cửa sổ dùng hồ sơ spike, một cửa sổ dùng Mặc định. Gửi một tin nhắn ở mỗi bên. Khởi động lại máy, mở lại cả hai.

Với `processEnv`: cửa sổ dùng hồ sơ spike mở bằng `2-open-vscode-processEnv.ps1`. Cửa sổ Mặc định phải là một tiến trình VS Code khác (ví dụ VS Code Insiders, hoặc `code --user-data-dir <thư mục khác>`), vì mọi cửa sổ của cùng một tiến trình VS Code dùng chung biến môi trường lúc khởi động. Extension thật sẽ không gặp giới hạn này: nó đặt `process.env` trong extension host của từng cửa sổ.

Đã làm bằng cửa sổ Extension Development Host (xem Step 3), không cần VS Code thứ hai.

- Hai cửa sổ chạy cùng lúc, mỗi cửa sổ một tài khoản (Pro và Team), không bên nào bị đăng xuất hay đè lên bên kia: **đạt.** Sau khi dùng cả hai, `claude auth status` vẫn cho hồ sơ spike `loggedIn: true, pro` và hồ sơ mặc định `loggedIn: true, team`.
- Sau khi khởi động lại máy: **đạt** (kiểm ngày 16/11). Máy khởi động lại lúc 07:24 ngày 16/11; `claude auth status` sau đó vẫn cho hồ sơ spike `loggedIn: true, pro` và hồ sơ mặc định `loggedIn: true, team`.
- Ghi chú: sau khi khởi động lại, `~/.claude/projects` giảm từ 811 xuống 758 file. Nguyên nhân là bước dọn dẹp tự động của Claude Code (`.last-cleanup` lúc 07:32 ngày 16/11): không còn hội thoại `.jsonl` nào cũ hơn 30 ngày, các file cũ còn lại chỉ là `.md`. Bước này không liên quan tới extension, nhưng phải tính đến khi đếm file ở bước 7 của `docs/verification.md`: đếm ngay trước và ngay sau khi xoá, không đếm cách nhau qua một lần khởi động lại.

## Step 7: Lịch sử dùng chung

Chạy `pwsh -File spike\5-link-shared.ps1`. Script đổi `projects/` của hồ sơ thành junction tới `~/.claude/projects` (mục cũ được đổi tên thành `*.spike-bak`, không xoá), rồi nối `settings.json` (symlink, không được thì hard link).

Đã chạy: junction `projects` tạo được không cần quyền admin, và đọc qua liên kết thấy đủ 811 file như gốc. **Symlink cho file cần quyền Administrator** (máy không bật Developer Mode), nên `settings.json` rơi về hard link. Task 4 phải coi hard link là đường chính trên Windows, không phải trường hợp hiếm.

Bằng tài khoản thứ hai, mở tiếp một hội thoại cũ của tài khoản mặc định.

- Ghi từ hồ sơ spike vào lịch sử chung: **đạt.** Hội thoại mới tạo bằng tài khoản thứ hai xuất hiện trong `~/.claude/projects` (qua junction).
- Danh sách hội thoại cũ của tài khoản chính hiện trong cửa sổ tài khoản thứ hai: **đạt.** Đã thử với dự án `nextjs-test` (cửa sổ thử không mở được `claude-multi`, vì VS Code chỉ cho mỗi thư mục mở ở một cửa sổ).
- Mở tiếp một hội thoại cũ và gửi tin: **đạt.** Một hội thoại cũ 8 ngày (tạo bằng tài khoản chính) hiện đủ nội dung trong cửa sổ tài khoản thứ hai, gửi tin mới thì Claude trả lời tiếp bình thường.
- **Step 7 đạt:** giữ `projects` trong `SHARED_DIRS`.

## Step 7b (bổ sung ngoài plan): `settings.json` dùng chung có giữ được không

Bằng tài khoản thứ hai, đổi một thiết lập mà Claude Code lưu vào `settings.json` (ví dụ chọn model khác bằng `/model`). Sau đó chạy `pwsh -File spike\6-check-links.ps1`.

- Loại liên kết đã tạo (symlink / hard link): hard link
- Sau khi đổi thiết lập, liên kết còn nguyên: **KHÔNG.** Đổi model bằng `/model` ở tài khoản thứ hai → `settings.json` của hồ sơ thành file thường (`LinkType` trống), có `model=haiku`, trong khi `~/.claude/settings.json` vẫn `model=opus`. Claude Code lưu `settings.json` bằng cách thay file, làm gãy hard link mà không báo gì. Symlink chưa thử được (cần quyền admin), nhưng cách thay file thường thay luôn cả symlink.
- `CLAUDE.md` cũng vậy: sửa một file hard link bằng công cụ Edit của Claude Code thì liên kết gãy, và file gốc không đổi. Claude Code ghi mọi file bằng cách thay file.
- **Kết luận:** không thể dùng chung `settings.json` và `CLAUDE.md` bằng liên kết như Global Constraints và Task 4 mô tả.
- **Người dùng chọn (13/11):** mỗi hồ sơ có `settings.json` riêng, chép từ `~/.claude` lúc tạo hồ sơ. `CLAUDE.md` làm theo cùng cách. Thư mục (`projects`, `skills`, `plugins`, `commands`) vẫn dùng chung bằng junction.

Nếu liên kết gãy: Claude Code ghi `settings.json` bằng cách thay file. Khi đó không thể dùng chung `settings.json` bằng liên kết; Task 4 phải bỏ nó khỏi `SHARED_FILES` hoặc đổi cách làm.

## Step 8: Chốt

- `APPLY_MODE`: **`processEnv`**
- `MIN_CLAUDE_CODE_VERSION`: **`2.1.323`**
- `LOGIN_COMMAND`: **`claude auth login`**
- Thứ tự tham số khi gọi script bọc: `wrapper <đường dẫn claude> <tham số…>` (không dùng, vì `APPLY_MODE` là `processEnv`)
- Trường email: **`oauthAccount.emailAddress`**
- Dùng chung: thư mục `skills`, `plugins`, `commands`, `projects` bằng junction/symlink. `settings.json` và `CLAUDE.md` được **chép** khi tạo hồ sơ, không liên kết.
- Lặp lại trên macOS / Linux: chưa làm (máy người dùng hiện chỉ có Windows). Phân tích mã cho thấy `processEnv` không phụ thuộc hệ điều hành, và trên macOS mỗi hồ sơ có mục Keychain riêng. Kiểm thật ở Task 10.

**Task 1: xong.** Cổng chặn mở: `processEnv` đạt, Step 6 đạt phần chạy đồng thời, Step 7 đạt, Step 7b không đạt (đã có hướng xử lý do người dùng chọn).

## Điều chỉnh plan cho các task sau

Plan gốc (`2026-11-13-claude-account-switcher.md`) giữ nguyên. Khi làm các task dưới đây, theo những điều chỉnh sau:

1. **Global Constraints, Task 4: `settings.json` và `CLAUDE.md` được chép, không liên kết** (người dùng chọn ngày 13/11).
   - `SHARED_FILES` đổi thành `SEED_FILES = ['settings.json', 'CLAUDE.md']`: chép từ `~/.claude` sang hồ sơ lúc tạo, chỉ khi hồ sơ chưa có file đó. Có thì giữ nguyên, nguồn không có thì bỏ qua.
   - `LinkReport` thêm `copied: string[]`.
   - Test "ghi qua hồ sơ thì thấy ở thư mục mặc định" chỉ áp cho `projects`. Thêm test: sửa `settings.json` của hồ sơ thì `~/.claude/settings.json` không đổi.
   - Bỏ phần dự phòng hard link (`fs.link`). `unlinkShared` chỉ gỡ liên kết thư mục.
   - Đánh đổi: thiết lập (kể cả plugin nào đang bật) và `CLAUDE.md` đổi ở hồ sơ nào thì chỉ hồ sơ đó nhận. README (Task 10) phải ghi rõ.
2. **Task 6: chỉ làm biến thể `processEnv`.** Gán `process.env` phải chạy đồng bộ, trước `await` đầu tiên trong `apply`.
3. **Task 7: thêm kiểm tra thiết lập trùng.** Nếu `claudeCode.environmentVariables` đang có `CLAUDE_CONFIG_DIR`, giá trị đó thắng `process.env` và extension mất tác dụng. Lúc kích hoạt, extension phát hiện trường hợp này và cảnh báo (thay cho `ForeignWrapperError`, vốn chỉ dùng cho biến thể `wrapper`).
4. **Task 8: `hasCli` tìm thêm file chạy đi kèm extension Claude Code** (`<extensionPath của anthropic.claude-code>/resources/native-binary/claude(.exe)`) khi PATH không có `claude`. Máy người dùng thuộc đúng trường hợp này. Terminal đăng nhập gọi file chạy đó bằng đường dẫn đầy đủ.
5. **Task 8: đăng nhập tự hoàn tất.** Trình duyệt chuyển về `localhost` thì lệnh tự kết thúc, không cần dán mã. Dòng `Paste code here` chỉ là dự phòng, và terminal của VS Code vẫn có ô nhập cho trường hợp đó. `claude auth login` tôn trọng biến `BROWSER`: có thể thêm tuỳ chọn chọn trình duyệt cho từng hồ sơ (để sau, không thuộc bản đầu).
6. **Task 10: kiểm tra đăng nhập sau khi khởi động lại máy** (Step 3.8) là lần kiểm đầu tiên của việc này, vì bản thử chưa làm được.
