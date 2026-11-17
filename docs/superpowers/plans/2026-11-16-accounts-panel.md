# Accounts Panel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Một tab webview Accounts (React + Tailwind) thay toàn bộ QuickPick, hiện type/quota từng profile và Switch / Add / Rename / Sign in again / Delete trên màn.

**Architecture:** Logic thuần (type, view-model JSON) kiểm thử bằng vitest/node. Host `WebviewPanel` gửi state, nhận `{ type, id? }`, gọi đúng `App.selectProfile` / `runAddAccount` / rename / remove / login hiện có. UI bundle riêng `dist/webview.js` + `dist/webview.css`; extension không load URL ngoài.

**Tech Stack:** TypeScript, VS Code WebviewPanel, React 18 (`jsx: react-jsx`), Tailwind CSS v4 (CLI compile sẵn), esbuild (hai entry: extension node + webview browser IIFE). React/Tailwind chỉ devDependency — đã bundle vào `dist/`.

**Spec:** `docs/superpowers/specs/2026-11-16-accounts-panel-design.md`

## Global Constraints

- Chỉ đọc `.claude.json`. Không đọc `.credentials.json`, không gọi mạng lấy quota.
- Login vẫn terminal + `loginWithProgress` / `reportLogin`. Không form đăng nhập trong webview.
- Rename = InputBox hiện có; xoá = WarningMessage hiện có; Default không xoá được.
- Switch giữ `App.selectProfile` (reload khi có folder).
- Chữ UI tiếng Anh; type map: `claude_pro`→`Pro`, `claude_team`→`Team`, chuỗi khác hiện nguyên, thiếu→`Unknown`.
- Một panel / cửa sổ; `viewType` `claudeAccounts.accounts`; title `Accounts`; `retainContextWhenHidden: true`.
- CSP: `default-src 'none'`; script nonce + local; style webview + `'unsafe-inline'` (thanh quota `%`).
- Không thêm dependency lúc chạy; không thư viện UI.
- Commit trailer: `Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>`

## Review Focus

- `organizationType` lạ (`enterprise`) hiện nguyên, không thành Unknown — test Task 1.
- Hồ sơ Default không có Delete; mất thư mục vẫn có Use — test Task 2.
- `CLAUDE_CONFIG_DIR` override: Use disabled, banner trên màn — test Task 2.
- Tên/email có `<` hoặc tiếng Việt: React text node, không `innerHTML` — Task 3.
- Mở lệnh lần hai focus panel cũ, không tạo tab thứ hai — kiểm tay sau Task 4; host `createOrShow` giữ singleton.

---

## File map

- Create: `src/accountsView.ts` — JSON state cho webview.
- Create: `src/accountsPanel.ts` — WebviewPanel host.
- Create: `src/webview/index.tsx`, `src/webview/App.tsx`, `src/webview/input.css`.
- Modify: `src/accountInfo.ts` — `kind` từ `oauthAccount`.
- Modify: `src/statusBar.ts` — export `duration`, `quotaBar`.
- Modify: `src/manageCommand.ts` — export `renameProfile`, `removeProfile`; `runManage` chỉ mở panel (Task 4).
- Modify: `src/switchCommand.ts` — mở panel, bỏ QuickPick.
- Modify: `src/extension.ts`, `src/app.ts`, `esbuild.mjs`, `package.json`, `tsconfig.json`, `README.md`.
- Delete when unused: `src/switchItems.ts`, `test/switchItems.test.ts`.
- Test: `test/accountInfo.test.ts`, `test/accountsView.test.ts`, `test/statusBar.test.ts` (re-export không gãy).

---

### Task 1: Account kind từ `.claude.json`

**Files:**
- Modify: `src/accountInfo.ts`
- Test: `test/accountInfo.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export interface AccountKind { label: string; organization?: string }
  export interface AccountInfo { email?: string; usage?: AccountUsage; kind: AccountKind }
  export function accountKind(oauth: unknown): AccountKind
  ```
  `readAccountInfo` luôn trả `kind` (kể cả khi không có file / không đăng nhập).

- [ ] **Step 1: Test `accountKind` + `readAccountInfo` mang `kind`**

Trong `test/accountInfo.test.ts`:

```ts
test('accountKind: Pro, Team, chuỗi khác, thiếu', () => {
  expect(accountKind({ organizationType: 'claude_pro' })).toEqual({ label: 'Pro' });
  expect(accountKind({ organizationType: 'claude_team', organizationName: 'Godgroup' }))
    .toEqual({ label: 'Team', organization: 'Godgroup' });
  expect(accountKind({ organizationType: 'enterprise' })).toEqual({ label: 'enterprise' });
  expect(accountKind(undefined)).toEqual({ label: 'Unknown' });
  expect(accountKind({ organizationType: 1, organizationName: 'X' })).toEqual({ label: 'Unknown' });
});

test('readAccountInfo: kind từ oauthAccount, không có file thì Unknown', async () => {
  await fs.writeFile(path.join(dir, '.claude.json'), claudeJson('a@x.com')); // fixture hiện có đã có organizationName: 'Org'
  const info = await readAccountInfo(p, home);
  expect(info.kind).toEqual({ label: 'Unknown', organization: 'Org' }); // fixture chưa có organizationType
  expect((await readAccountInfo(p, home + '-missing')).kind).toEqual({ label: 'Unknown' });
});
```

Sửa fixture `claudeJson` thêm `organizationType: 'claude_team'` và đổi expect `kind` thành `{ label: 'Team', organization: 'Org' }`. Cập nhật mọi `readAccountInfo` expect hiện có: thêm `kind` (đừng xoá assert email/usage).

- [ ] **Step 2: Chạy test, thấy fail vì `accountKind` chưa có**

Run: `npx vitest run test/accountInfo.test.ts`
Expected: FAIL (`accountKind` is not exported / `kind` undefined)

- [ ] **Step 3: Implement**

`accountKind`: `organizationType === 'claude_pro'` → `Pro`; `'claude_team'` → `Team`; `typeof === 'string'` → nguyên giá trị; else `Unknown`. `organizationName` chỉ gắn khi `typeof === 'string'` và non-empty. `readAccountInfo` gán `kind: accountKind(oauthAccount)` cả khi parse file lỗi / thiếu file (email/usage vẫn như cũ).

- [ ] **Step 4: Test pass**

Run: `npx vitest run test/accountInfo.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/accountInfo.ts test/accountInfo.test.ts
git commit -m "feat: read account kind from oauthAccount.organizationType"
```

---

### Task 2: View-model JSON cho màn Accounts

**Files:**
- Create: `src/accountsView.ts`
- Modify: `src/statusBar.ts` (export `duration`, `quotaBar` — `quotaBar` là `bar` hiện tại)
- Create: `test/accountsView.test.ts`
- Test: `test/statusBar.test.ts` — import `quotaBar`/`duration` nếu test cũ gãy vì rename; giữ nguyên assert tooltip.

**Interfaces:**
- Consumes: `AccountInfo` / `AccountKind` (Task 1); `Profile`; `AccountUsage`; `duration(ms)`, `quotaBar(percent)` từ `statusBar.ts`
- Produces:
  ```ts
  export interface AccountsState {
    prompt?: string;
    override?: string;
    useLabel: string;
    accounts: AccountRow[];
  }
  export interface AccountRow {
    id: string; name: string;
    email: string;
    kind: string;
    active: boolean;
    missing: boolean;
    missingHint?: string;
    usage?: { limits: { label: string; percent: number; bar: string; resets?: string }[]; updated: string };
    actions: { use: boolean; rename: true; login: true; delete: boolean };
  }
  export function accountsState(input: {
    profiles: Profile[];
    infos: AccountInfo[];
    activeId: string;
    dirExists: (dir: string) => boolean;
    unbound: boolean;
    hasFolder: boolean;
    override?: string;
    now?: number;
  }): AccountsState
  ```

Quy tắc (spec):
- `kind` row: `organization` có thì `` `${label} · ${organization}` ``, không thì `label`.
- `email`: `info.email ?? 'Not signed in'`.
- `missing`: `!profile.isDefault && !dirExists(configDir)`; `missingHint` đúng chữ `Profile folder missing: select to recreate it, then sign in again`.
- `active`: `profile.id === activeId`.
- `actions.delete`: `!profile.isDefault`. `actions.use`: `override === undefined`. Rename/login luôn true.
- `useLabel`: `hasFolder` ? `Use for This Project` : `Use for This Window`.
- `unbound` → `prompt`: `Which Claude account should this project use?`
- `override` set → copy vào `override` (đường dẫn nguyên văn); không set `prompt` chồng.
- Quota: cùng `quotaBar` (10 ô ▰/▱), `Math.round(percent)+'%'`, `resetsAt > now` → `in ${duration(resetsAt-now)}`, `resetsAt <= now` → `since last update`, không `resetsAt` → omit. `updated`: age `< 60_000` → `Updated just now`, else `Updated ${duration(age)} ago`. Không `usage` → omit khối.

- [ ] **Step 1: Test view-model**

```ts
test('kind line, default no delete, missing still use, unbound prompt');
test('override disables use and sets banner');
test('quota bars and reset copy match status bar');
```

Fixture: Default + `Công ty A` (id `a1`). Infos: Default Pro `me@x.com`; A Team/Godgroup, usage Session 40% reset +1h10m, Weekly 7%. `now` cố định. Assert `kind === 'Team · Godgroup'`, Default `actions.delete === false`, missing B `missingHint` đúng chữ và `actions.use === true`, unbound `prompt` đúng chữ, `hasFolder: false` → `useLabel === 'Use for This Window'`.

Override test: `override: '/tmp/x'` → mọi `actions.use === false`, `state.override === '/tmp/x'`.

Quota test: so khớp `bar` với `quotaBar(40)` và resets `in 1h 10m` (cùng `duration` status bar).

- [ ] **Step 2: Fail vì `accountsState` chưa có**

Run: `npx vitest run test/accountsView.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement `accountsState` + export `duration` / `quotaBar`**

Đổi tên `bar` → `quotaBar` và export; export `duration`. `usageTable` vẫn gọi chúng. Không đổi tooltip.

- [ ] **Step 4: Pass**

Run: `npx vitest run test/accountsView.test.ts test/statusBar.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/accountsView.ts src/statusBar.ts test/accountsView.test.ts test/statusBar.test.ts
git commit -m "feat: build accounts panel view-model"
```

---

### Task 3: React + Tailwind webview bundle

**Files:**
- Create: `src/webview/index.tsx`, `src/webview/App.tsx`, `src/webview/input.css`
- Modify: `esbuild.mjs`, `package.json`, `tsconfig.json`

**Interfaces:**
- Consumes: `AccountsState` (Task 2) — copy type vào `src/webview/types.ts` (trùng field, webview không import `src/` Node) **hoặc** file `src/accountsView.ts` chỉ type + function; webview import type `AccountsState` nếu esbuild bundle webview không kéo Node. An toàn: `src/webview/types.ts` với cùng field; host stringify `AccountsState`.
- Produces: `dist/webview.js` (IIFE), `dist/webview.css`; `window` listen `message` → `setState`; click `vscode.postMessage({ type: 'add'|'use'|'rename'|'login'|'delete', id?: string })`.

- [ ] **Step 1: DevDeps + tsconfig**

`npm i -D react react-dom @types/react @types/react-dom tailwindcss @tailwindcss/cli`

`tsconfig.json`: `"jsx": "react-jsx"`, `"lib": ["ES2022", "DOM"]`.

`package.json` scripts: `"build:css": "tailwindcss -i src/webview/input.css -o dist/webview.css"`, `"build": "node esbuild.mjs && npm run build:css"`.

- [ ] **Step 2: `esbuild.mjs` thêm bundle browser**

Entry `src/webview/index.tsx` → `dist/webview.js`, `platform: 'browser'`, `format: 'iife'`, `jsx: 'automatic'`, `target: 'es2022'`, bundle, sourcemap. Giữ bundle extension hiện có. Cả hai `await build(...)`.

- [ ] **Step 3: UI**

`input.css`: `@import "tailwindcss";` `@source "./";` màu qua `var(--vscode-foreground)`, `--vscode-button-background`, `--vscode-button-foreground`, `--vscode-editor-background`, `--vscode-panel-border`, `--vscode-descriptionForeground`.

`App.tsx`: header `Accounts` + button `Add account` → `postMessage({ type: 'add' })`. Banner `prompt` / `override` nếu có. Mỗi `AccountRow`: chấm active, `name`, `kind`, `email`, `missingHint`, quota rows (`bar` + `%` + `resets`), `updated`, buttons theo `actions` và `useLabel`. Không `dangerouslySetInnerHTML`. Thanh quota: `style={{ width: percent + '%' }}` trên track CSS.

`index.tsx`: `acquireVsCodeApi()`, `state` từ `{ type: 'state', payload: AccountsState }`.

Không test React (view-model đã cover). Verify = build.

- [ ] **Step 4: Build**

Run: `npm run build`
Expected: `dist/extension.js`, `dist/webview.js`, `dist/webview.css` tồn tại; esbuild không warn external vscode trên webview bundle.

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json tsconfig.json esbuild.mjs src/webview
git commit -m "feat: bundle accounts webview with React and Tailwind"
```

---

### Task 4: Host panel, nối lệnh, gỡ QuickPick

**Files:**
- Create: `src/accountsPanel.ts`
- Modify: `src/app.ts`, `src/extension.ts`, `src/switchCommand.ts`, `src/manageCommand.ts`
- Delete: `src/switchItems.ts`, `test/switchItems.test.ts` khi không còn import

**Interfaces:**
- Consumes: `accountsState` (Task 2), `readAccountInfo` (Task 1), `runAddAccount`, `loginWithProgress`/`reportLogin`, `App.selectProfile`/`render`
- Produces:
  ```ts
  export function showAccounts(app: App, ctx: vscode.ExtensionContext): void
  export async function renameProfile(app: App, profile: Profile): Promise<void>
  export async function removeProfile(app: App, profile: Profile): Promise<void>
  ```
  `runSwitch(app)` / `runManage(app)` = `showAccounts`. `claudeAccounts.add` = `showAccounts` rồi `runAddAccount(app)`.

- [ ] **Step 1: Export rename/remove**

Đổi `rename`/`remove` trong `manageCommand.ts` thành export `renameProfile`/`removeProfile`. Giữ nguyên InputBox, warning xoá active (switch Default + reload, return), confirm Delete, Keychain detail darwin. `runManage` tạm giữ QuickPick đến Step 3.

- [ ] **Step 2: `AccountsPanel` singleton**

`showAccounts`: nếu `panel` còn → `reveal`; else `createWebviewPanel('claudeAccounts.accounts', 'Accounts', ViewColumn.One, { enableScripts, retainContextWhenHidden, localResourceRoots: [dist] })`. HTML: CSP như Global Constraints; `asWebviewUri` cho `webview.js` / `webview.css`; `script nonce`; `<div id="root">`.

`refresh`: `Promise.all(profiles.list().map(p => readAccountInfo(p, app.home)))` rồi `postMessage({ type: 'state', payload: accountsState({...}) })`. `unbound`: `app.resolution.reason === 'unbound'`. `override`: `configDirOverride(...)`. `dirExists`: `fs.existsSync`. `hasFolder`: `app.folders().length > 0`. `now`: `Date.now()`.

`onDidReceiveMessage`: `add` → `runAddAccount`; `use`/`rename`/`login`/`delete` → `app.profiles.get(id)` rồi `selectProfile` / `renameProfile` / `reportLogin(loginWithProgress)` / `removeProfile`. Sau thao tác `await app.render()`.

Dispose panel → `panel = undefined`.

- [ ] **Step 3: `App.render` đẩy panel**

`App` optional `onDidRender?: () => void` gọi cuối `render()`. `extension.ts`: `app.onDidRender = () => refreshAccounts(app)` (no-op nếu panel đóng). Lệnh:

- `claudeAccounts.switch` → `showAccounts`
- `claudeAccounts.manage` → `showAccounts` (xóa QuickPick `runManage` cũ)
- `claudeAccounts.add` → `showAccounts` + `runAddAccount`
- status bar `command` vẫn `claudeAccounts.switch`

`runSwitch` không còn QuickPick. Xóa `switchItems.ts` + test.

Hỏi account lần đầu (`unbound`) vẫn `executeCommand('claudeAccounts.switch')` — màn hiện `prompt`.

- [ ] **Step 4: Typecheck + test**

Run: `npm test && npm run typecheck && npm run build`
Expected: PASS, không import `switchItems`.

- [ ] **Step 5: Commit**

```bash
git add src test
git commit -m "feat: open Accounts webview instead of QuickPick"
```

---

### Task 5: README

**Files:**
- Modify: `README.md` (bảng lệnh)

- [ ] **Step 1: Đổi mô tả lệnh**

Switch Account (và status bar): mở tab Accounts — chọn account, xem type/quota. Add Account: mở tab rồi đặt tên và đăng nhập như cũ. Manage Profiles: cùng tab (rename / sign in again / delete).

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs: describe the Accounts panel"
```

---

## Spec coverage

| Spec | Task |
|---|---|
| Tab singleton, 3 lệnh + status bar | 4 |
| Type Pro/Team/raw/Unknown + org name | 1, 2 |
| Quota cùng parser tooltip | 2 |
| Add / Use / Rename / Login / Delete | 4 (UI 3) |
| Default không Delete; missing folder | 2 |
| Không QuickPick, không token, không mạng | 4, 1 |
| React + Tailwind, CSP | 3, 4 |
| README | 5 |
