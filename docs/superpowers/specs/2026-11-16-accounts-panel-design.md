# Accounts panel

Tab webview thay toàn bộ QuickPick quản lý account. Status bar và 3 lệnh palette mở cùng một màn.

## Intent

Người dùng muốn thấy hết account, type, quota, rồi Switch / Add / Rename / Sign in again / Delete ngay trên màn, không còn chuỗi QuickPick lồng nhau.

## Goals

- Một tab **Accounts**. Mở lại thì focus tab cũ, không tạo tab thứ hai.
- Mỗi hàng: tên profile, email, type, quota (cùng parser tooltip hiện tại), đang dùng cửa sổ này hay không, thư mục hồ sơ mất thì cảnh báo.
- Nút trên hàng: Use for this project, Rename, Sign in again, Delete (Default không có Delete).
- Nút Add account trên màn.
- 3 lệnh giữ nguyên tên; chúng mở màn (Add mở màn rồi chạy luôn luồng thêm tài khoản hiện có).

## Non-goals

- Sidebar, TreeView, giữ QuickPick.
- Gọi mạng lấy quota; đọc `.credentials.json` / token.
- Đổi cách Claude nhận hồ sơ (`CLAUDE_CONFIG_DIR` / `App.selectProfile`).
- Form đăng nhập trong webview (vẫn terminal + progress).
- Đổi tên / xác nhận xoá trong webview (vẫn InputBox / WarningMessage hiện có).

## Anti-goals

- Đọc token hoặc gửi dữ liệu account ra ngoài.
- Hai tab Accounts cùng lúc trong một cửa sổ.
- Xoá được hồ sơ Default.

## Constraints

- Extension VS Code, `engines.vscode: ^1.98.0`, không dependency lúc chạy ngoài React/Tailwind đã bundle vào webview.
- Chỉ đọc `.claude.json`. Quota là bản Claude Code đã cache.
- Login, switch (kèm reload), rename, delete: giữ nguyên hành vi hiện tại.
- Chữ UI tiếng Anh, cùng giọng README / lệnh hiện có.
- Windows / macOS / Linux; theme VS Code (màu webview theo biến `--vscode-*`).

## Approaches

1. **Tab webview (chọn).** Đủ chỗ quota từng account. Mở khi cần. Nặng hơn TreeView vì HTML.
2. Sidebar webview. Luôn thấy, nhưng hẹp.
3. TreeView native. Nhẹ, không ra “một màn”, quota chỉ còn chữ.

Cách dựng UI trên tab (bạn chọn lúc làm): **React + Tailwind**, bundle bằng esbuild, CSS compile sẵn. Không CDN. Không thêm thư viện UI.

## How

### Type

Từ `oauthAccount.organizationType` trong `.claude.json`:

| Giá trị | Hiện |
|---|---|
| `claude_pro` | Pro |
| `claude_team` | Team |
| khác, là chuỗi | nguyên giá trị |
| thiếu / không phải chuỗi | Unknown |

Có `organizationName` thì ghi cạnh type: `Team · Godgroup`.

### Quota

Cùng `cachedUsageUtilization` / `limits` như tooltip status bar. Thanh `▰`/`▱` 10 ô, `%` làm tròn, `resets in …` / `since last update`, dòng “Updated … ago”. Chưa đăng nhập hoặc không có cache: không hiện khối quota.

### Màn

```
Accounts                              [Add account]
────────────────────────────────────────────────────
(optional) Which Claude account should this project use?
(optional) setting is forcing CLAUDE_CONFIG_DIR — cannot switch

● Work                         Team · Godgroup
  sd12@godgroup.com            Using in this window
  Session (5h) ████░░░░░░ 40%  in 2h
  Weekly       █░░░░░░░░░  7%  in 5d
  Updated 12m ago
  [Use for this project] [Rename] [Sign in again] [Delete]

○ Default                      Pro
  me@x.com
  …
  [Use for this project] [Rename] [Sign in again]
```

Hồ sơ mất thư mục: cảnh báo “Profile folder missing…” (cùng chữ `switchItems` hiện tại); Use vẫn chọn được (recreate + sign in again như nay).

### Commands

| Lệnh | Việc |
|---|---|
| Switch Account (và click status bar) | Mở / focus tab Accounts |
| Manage Profiles | Giống Switch |
| Add Account | Mở / focus tab, rồi chạy `runAddAccount` (InputBox + terminal như nay) |

Dự án chưa gắn (`unbound`, hỏi một lần): vẫn gọi Switch; màn hiện dòng prompt `Which Claude account should this project use?`.

### Webview

- `WebviewPanel`, `viewType`: `claudeAccounts.accounts`, title `Accounts`, `retainContextWhenHidden: true`.
- Một panel / cửa sổ. Dispose thì lần mở sau tạo lại.
- Host gửi JSON state; webview `postMessage` `{ type, id? }` (`add` / `use` / `rename` / `login` / `delete`).
- CSP: script local + nonce; style từ webview + inline (thanh quota). Không load URL ngoài.
- `App.render()` (timer 60s, focus, sau mọi thao tác) đẩy state mới nếu panel đang mở.

### Files (gợi ý cho plan)

Logic thuần (vitest/node): đọc type, view-model JSON, rename/remove đã export.

UI: `src/webview/*` React + Tailwind. Host: `src/accountsPanel.ts`. Gỡ QuickPick khỏi `switchCommand` / `runManage`.

## Builder calls

- Map type chỉ Pro/Team; giá trị khác hiện nguyên.
- Add từ palette = mở panel + luồng add hiện có, không form trong webview.
- Tailwind compile lúc build, token màu trỏ `--vscode-*`.
- `switchItems.ts` bị thay bởi view-model; xóa khi không còn chỗ dùng.
