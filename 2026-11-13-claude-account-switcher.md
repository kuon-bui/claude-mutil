# Claude Account Switcher Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extension VS Code giữ sẵn đăng nhập của nhiều tài khoản Claude Code, tự chọn tài khoản theo thư mục dự án và cho đổi nhanh từ thanh trạng thái.

**Architecture:** Mỗi tài khoản là một thư mục cấu hình `~/.claude-profiles/<id>`; extension trỏ Claude Code vào thư mục đó qua `CLAUDE_CONFIG_DIR` và không bao giờ đọc token. Phần dùng chung (thiết lập, skill, plugin, lệnh, lịch sử hội thoại) được liên kết về `~/.claude`. Logic nằm trong các module thuần Node kiểm thử được bằng vitest; `extension.ts` chỉ nối chúng với API của VS Code.

**Tech Stack:** TypeScript 5, VS Code Extension API (`engines.vscode: ^1.98.0`), esbuild, vitest, `@vscode/vsce`. Không có dependency lúc chạy.

**Spec:** https://claude.ai/artifact/W2R3g7xD46WnvH7diCwhpA ("Thiết kế: Extension VS Code quản lý nhiều tài khoản Claude"). Người thực hiện đọc cả hai.

## Global Constraints

- Chạy trên Windows, macOS và Linux, với phiên bản Claude Code mới nhất tại thời điểm làm bản thử.
- Extension không đọc, sao chép hay gửi token. Không mở `.credentials.json`, không gọi Keychain, không gọi mạng.
- Hồ sơ "Mặc định" là `~/.claude` hiện có, id cố định `default`, không xoá được.
- Hồ sơ khác nằm ở `~/.claude-profiles/<id>`.
- Dùng chung giữa các hồ sơ: `settings.json`, `CLAUDE.md`, `skills/`, `plugins/`, `commands/`, `projects/` (lịch sử hội thoại). Chỉ đăng nhập tách riêng.
- Cặp thư mục–hồ sơ lưu trong `globalState` của extension, không ghi vào `.vscode/settings.json`.
- Không có tính năng tự xoay vòng tài khoản theo giới hạn sử dụng.
- `extensionKind: ["workspace"]` để extension chạy cùng máy với Claude Code khi dùng Remote/WSL; "home" luôn là `os.homedir()` của máy đó.
- Tiền tố lệnh và khoá lưu trữ: `claudeAccounts.`. Chuỗi hiển thị bằng tiếng Việt.
- Bản đầu cài từ file `.vsix`, chưa đưa lên Marketplace.

## Review Focus

1. **Xoá hồ sơ không được xoá dữ liệu dùng chung.** Thư mục hồ sơ chứa liên kết tới `~/.claude/projects`; xoá đệ quy đi xuyên liên kết (nhất là junction trên Windows) sẽ mất toàn bộ lịch sử. Test ở Task 4.
2. **Đường dẫn có dấu cách hoặc ký tự tiếng Việt** (ví dụ `C:\Users\Nguyễn Văn A`). Hồ sơ, liên kết và script bọc phải chạy đúng. Test ở Task 2, 4 và 6.
3. **Thư mục hồ sơ bị xoá bên ngoài extension.** Người dùng phải thấy cảnh báo trên thanh trạng thái, không lặng lẽ chạy bằng tài khoản mặc định. Test ở Task 5.
4. **Thiết lập có sẵn của người dùng.** Nếu đã có `claudeCode.environmentVariables` hoặc `claudeCode.claudeProcessWrapper` riêng, extension giữ nguyên phần không phải của mình. Test ở Task 6.
5. **Không mở thư mục nào, hoặc workspace nhiều thư mục gốc.** Không thư mục: dùng mặc định, không hỏi. Nhiều thư mục gốc: dùng thư mục đầu tiên. Test ở Task 5.

---

### Task 1: Bản thử trên máy thật (cổng chặn)

Việc này làm bằng tay trên máy của người dùng, cần hai tài khoản Claude thật. Không viết mã sản phẩm trước khi có kết quả.

**Files:**
- Create: `docs/spike-results.md`

**Interfaces:**
- Produces: `APPLY_MODE` (`'processEnv' | 'wrapper' | 'envSetting'`), `MIN_CLAUDE_CODE_VERSION`, `LOGIN_COMMAND`, cách extension Claude Code gọi script bọc (thứ tự tham số), tên trường email trong `.claude.json`. Task 5, 6, 7 dùng các giá trị này.

- [ ] **Step 1: Ghi phiên bản.** Cập nhật extension Claude Code lên bản mới nhất; ghi phiên bản extension, phiên bản VS Code và hệ điều hành vào `docs/spike-results.md`.

- [ ] **Step 2: Tạo hồ sơ thứ hai bằng tay.** Tạo thư mục `~/.claude-profiles/spike`. Trong terminal đặt `CLAUDE_CONFIG_DIR` vào thư mục đó, chạy `claude auth login`, đăng nhập tài khoản thứ hai. Ghi lại lệnh đăng nhập thực tế chạy được (`LOGIN_COMMAND`) và trường chứa email trong `~/.claude-profiles/spike/.claude.json` (dự kiến `oauthAccount.emailAddress`). Nếu máy không có lệnh `claude`, ghi "no-cli".

- [ ] **Step 3: Thử cách `processEnv`.** Đóng hết VS Code, mở lại từ terminal đã đặt `CLAUDE_CONFIG_DIR`. Đạt khi khung chat Claude hiện tài khoản thứ hai.

- [ ] **Step 4: Thử cách `wrapper`.** Bỏ biến môi trường ở Step 3. Đặt `claudeCode.claudeProcessWrapper` (phạm vi User) vào một script ghi toàn bộ tham số nhận được ra file log, đặt `CLAUDE_CONFIG_DIR` rồi chạy tiếp các tham số đó. Đạt khi khung chat hiện tài khoản thứ hai. Chép dòng log tham số vào kết quả.

- [ ] **Step 5: Thử cách `envSetting`.** Bỏ script bọc. Đặt `claudeCode.environmentVariables` (phạm vi User) thành `[{"name":"CLAUDE_CONFIG_DIR","value":"<đường dẫn>"}]`, tải lại cửa sổ. Đạt khi khung chat hiện tài khoản thứ hai. Thử thêm ở phạm vi Workspace và ghi kết quả.

- [ ] **Step 6: Thử giữ đăng nhập độc lập.** Với cách đã đạt, mở hai cửa sổ dùng hai tài khoản, khởi động lại máy, mở lại. Đạt khi không tài khoản nào bị đăng xuất hay đè lên tài khoản kia.

- [ ] **Step 7: Thử lịch sử dùng chung.** Thay `~/.claude-profiles/spike/projects` bằng liên kết tới `~/.claude/projects` (junction trên Windows). Bằng tài khoản thứ hai, mở tiếp một hội thoại cũ của tài khoản mặc định. Đạt khi hội thoại hiện đủ và tiếp tục được.

- [ ] **Step 8: Chốt kết quả.** Ghi vào `docs/spike-results.md`: `APPLY_MODE` là cách đầu tiên đạt theo thứ tự `processEnv`, `wrapper`, `envSetting`; `MIN_CLAUDE_CODE_VERSION` là phiên bản vừa thử. Lặp Step 3–7 trên từng hệ điều hành người dùng có.

**Quy tắc dừng:** nếu cả ba cách đều không đạt, hoặc Step 6 không đạt, dừng lại và hỏi người dùng chọn giữa hướng B và C trong spec. Nếu chỉ Step 7 không đạt, hỏi người dùng có chấp nhận lịch sử tách riêng không; nếu có, bỏ `projects` khỏi `SHARED_DIRS` ở Task 4.

---

### Task 2: Khung dự án, đường dẫn và kho hồ sơ

**Files:**
- Create: `package.json`, `tsconfig.json`, `esbuild.mjs`, `vitest.config.ts`, `.vscodeignore`, `.gitignore`
- Create: `src/paths.ts`, `src/store.ts`, `src/profileStore.ts`, `src/bindingStore.ts`
- Test: `test/paths.test.ts`, `test/profileStore.test.ts`, `test/bindingStore.test.ts`, `test/helpers/memoryStore.ts`

**Interfaces:**
- Produces:

```ts
// src/store.ts — tương thích vscode.Memento
export interface KeyValueStore {
  get<T>(key: string): T | undefined;
  update(key: string, value: unknown): Thenable<void>;
}

// src/paths.ts
export function defaultConfigDir(home: string): string;            // <home>/.claude
export function profilesRoot(home: string): string;                // <home>/.claude-profiles
export function profileDir(home: string, id: string): string;      // <home>/.claude-profiles/<id>
export function normalizeFolderKey(fsPath: string, platform: NodeJS.Platform): string;

// src/profileStore.ts
export const PROFILE_COLORS = ['charts.blue','charts.green','charts.orange','charts.purple','charts.red','charts.yellow'] as const;
export interface Profile { id: string; name: string; color: string; configDir: string; isDefault: boolean }
export class DuplicateNameError extends Error {}
export class EmptyNameError extends Error {}
export class ProfileStore {
  constructor(store: KeyValueStore, home: string);
  list(): Profile[];                       // "Mặc định" luôn đứng đầu
  get(id: string): Profile | undefined;
  add(name: string): Promise<Profile>;
  rename(id: string, name: string): Promise<void>;
  remove(id: string): Promise<void>;       // ném lỗi nếu id === 'default'
}

// src/bindingStore.ts
export class BindingStore {
  constructor(store: KeyValueStore, platform: NodeJS.Platform);
  get(folder: string): string | undefined;
  set(folder: string, profileId: string): Promise<void>;
  removeProfile(profileId: string): Promise<void>;
}
```

- [ ] **Step 1: Dựng khung.** `package.json` với `name: "claude-account-switcher"`, `engines.vscode: "^1.98.0"`, `main: "./dist/extension.js"`, `extensionKind: ["workspace"]`, `activationEvents: ["*"]` (phải chạy trước khi Claude Code khởi tiến trình), scripts `build` (esbuild, bundle, `external: ['vscode']`, `platform: 'node'`), `test` (`vitest run`), `package` (`vsce package`). `git init`. Chạy `npm install` và `npm test`; mong đợi "No test files found".

- [ ] **Step 2: Viết test thất bại cho `paths`.**

```ts
test('profileDir nằm trong .claude-profiles', () => {
  expect(profileDir('/home/a', 'x1')).toBe(path.join('/home/a', '.claude-profiles', 'x1'));
});
test('normalizeFolderKey: Windows không phân biệt hoa thường và bỏ dấu gạch cuối', () => {
  expect(normalizeFolderKey('C:\\Du An\\Web\\', 'win32')).toBe('c:\\du an\\web');
});
test('normalizeFolderKey: Linux giữ nguyên hoa thường', () => {
  expect(normalizeFolderKey('/home/a/Dự Án/', 'linux')).toBe('/home/a/Dự Án');
});
```

- [ ] **Step 3: Chạy `npx vitest run test/paths.test.ts`.** Mong đợi FAIL vì chưa có module.
- [ ] **Step 4: Viết `src/paths.ts`** theo chữ ký ở trên. Chạy lại, mong đợi PASS.

- [ ] **Step 5: Viết test thất bại cho `ProfileStore`** (dùng `test/helpers/memoryStore.ts`, một `KeyValueStore` bằng `Map`).

```ts
test('kho rỗng vẫn có hồ sơ Mặc định trỏ vào ~/.claude', () => {
  const s = new ProfileStore(memoryStore(), '/home/a');
  expect(s.list()).toEqual([{ id: 'default', name: 'Mặc định', color: 'charts.blue',
    configDir: path.join('/home/a', '.claude'), isDefault: true }]);
});
test('add tạo id 8 ký tự hex, configDir trong .claude-profiles, màu xoay vòng', async () => {
  const s = new ProfileStore(memoryStore(), '/home/a');
  const p = await s.add('Công ty A');
  expect(p.id).toMatch(/^[0-9a-f]{8}$/);
  expect(p.configDir).toBe(profileDir('/home/a', p.id));
  expect(p.color).toBe('charts.green');
});
test('tên trùng (không phân biệt hoa thường, bỏ khoảng trắng đầu cuối) bị từ chối', async () => {
  const s = new ProfileStore(memoryStore(), '/home/a');
  await s.add('Công ty A');
  await expect(s.add('  công ty a ')).rejects.toBeInstanceOf(DuplicateNameError);
  await expect(s.add('mặc định')).rejects.toBeInstanceOf(DuplicateNameError);
});
test('tên rỗng bị từ chối', async () => {
  await expect(new ProfileStore(memoryStore(), '/h').add('   ')).rejects.toBeInstanceOf(EmptyNameError);
});
test('không xoá và không đổi id được hồ sơ Mặc định; đổi tên thì được', async () => {
  const s = new ProfileStore(memoryStore(), '/home/a');
  await expect(s.remove('default')).rejects.toThrow();
  await s.rename('default', 'Cá nhân');
  expect(s.get('default')?.name).toBe('Cá nhân');
});
test('dữ liệu còn nguyên khi tạo lại ProfileStore trên cùng kho', async () => {
  const mem = memoryStore();
  const p = await new ProfileStore(mem, '/home/a').add('Khách B');
  expect(new ProfileStore(mem, '/home/a').get(p.id)?.name).toBe('Khách B');
});
```

- [ ] **Step 6: Chạy test, mong đợi FAIL. Viết `src/profileStore.ts`.** Lưu dưới khoá `claudeAccounts.profiles`; id từ `crypto.randomBytes(4).toString('hex')`; màu là `PROFILE_COLORS[số hồ sơ hiện có % 6]`. Chạy lại, mong đợi PASS.

- [ ] **Step 7: Viết test thất bại cho `BindingStore`.**

```ts
test('get trả về hồ sơ đã gắn, khoá đã chuẩn hoá', async () => {
  const b = new BindingStore(memoryStore(), 'win32');
  await b.set('C:\\Du An\\Web', 'x1');
  expect(b.get('c:\\du an\\web\\')).toBe('x1');
});
test('removeProfile gỡ mọi thư mục đang gắn với hồ sơ đó', async () => {
  const b = new BindingStore(memoryStore(), 'linux');
  await b.set('/a', 'x1'); await b.set('/b', 'x2');
  await b.removeProfile('x1');
  expect(b.get('/a')).toBeUndefined();
  expect(b.get('/b')).toBe('x2');
});
```

- [ ] **Step 8: Chạy test, mong đợi FAIL. Viết `src/bindingStore.ts`** (khoá `claudeAccounts.bindings`). Chạy `npm test`, mong đợi tất cả PASS.
- [ ] **Step 9: Commit.** `git add -A && git commit -m "feat: scaffold, paths, profile and binding stores"`

---

### Task 3: Đọc email tài khoản mà không đọc token

**Files:**
- Create: `src/accountInfo.ts`
- Test: `test/accountInfo.test.ts`

**Interfaces:**
- Consumes: `Profile` (Task 2); tên trường email từ `docs/spike-results.md`.
- Produces: `export async function readAccountEmail(profile: Profile, home: string): Promise<string | undefined>`

- [ ] **Step 1: Viết test thất bại** (thư mục tạm bằng `fs.mkdtemp`).

```ts
test('hồ sơ thường: đọc <configDir>/.claude.json', async () => {
  await fs.writeFile(path.join(dir, '.claude.json'), JSON.stringify({ oauthAccount: { emailAddress: 'a@x.com' } }));
  expect(await readAccountEmail({ ...p, configDir: dir, isDefault: false }, home)).toBe('a@x.com');
});
test('hồ sơ Mặc định: đọc <home>/.claude.json', async () => {
  await fs.writeFile(path.join(home, '.claude.json'), JSON.stringify({ oauthAccount: { emailAddress: 'me@x.com' } }));
  expect(await readAccountEmail({ ...p, isDefault: true }, home)).toBe('me@x.com');
});
test('thiếu file, JSON hỏng hoặc chưa đăng nhập đều trả về undefined', async () => {
  expect(await readAccountEmail({ ...p, configDir: dir, isDefault: false }, home)).toBeUndefined();
  await fs.writeFile(path.join(dir, '.claude.json'), '{hỏng');
  expect(await readAccountEmail({ ...p, configDir: dir, isDefault: false }, home)).toBeUndefined();
});
```

- [ ] **Step 2: Chạy test, mong đợi FAIL. Viết `src/accountInfo.ts`.** Chỉ mở `.claude.json`; nếu bản thử ghi tên trường khác thì dùng tên đó trong cả mã và test. Chạy lại, mong đợi PASS.
- [ ] **Step 3: Commit.** `git commit -am "feat: read account email from .claude.json"`

---

### Task 4: Liên kết phần dùng chung và xoá thư mục hồ sơ an toàn

**Files:**
- Create: `src/sharedLinks.ts`
- Test: `test/sharedLinks.test.ts`

**Interfaces:**
- Consumes: `profilesRoot` (Task 2).
- Produces:

```ts
export const SHARED_FILES = ['settings.json', 'CLAUDE.md'] as const;
export const SHARED_DIRS = ['skills', 'plugins', 'commands', 'projects'] as const;
export interface LinkReport { linked: string[]; skipped: string[] }
export async function linkShared(defaultDir: string, profileDir: string, platform: NodeJS.Platform): Promise<LinkReport>;
export async function unlinkShared(profileDir: string): Promise<void>;
export async function removeProfileDir(profileDir: string, root: string): Promise<void>;
```

- [ ] **Step 1: Viết test thất bại.** Mọi test chạy trong thư mục tạm có tên chứa dấu cách và ký tự tiếng Việt (`path.join(tmp, 'Nguyễn Văn A')`), với `process.platform` thật.

```ts
test('linkShared: ghi qua hồ sơ thì thấy ở thư mục mặc định', async () => {
  await fs.mkdir(path.join(def, 'projects'), { recursive: true });
  await fs.writeFile(path.join(def, 'settings.json'), '{}');
  const r = await linkShared(def, prof, process.platform);
  await fs.writeFile(path.join(prof, 'projects', 's1.jsonl'), 'x');
  expect(await fs.readFile(path.join(def, 'projects', 's1.jsonl'), 'utf8')).toBe('x');
  expect(r.linked).toEqual(expect.arrayContaining(['projects', 'settings.json']));
});
test('linkShared: thư mục nguồn chưa có thì tạo rỗng rồi liên kết; file nguồn chưa có thì bỏ qua', async () => {
  const r = await linkShared(def, prof, process.platform);
  expect((await fs.stat(path.join(def, 'skills'))).isDirectory()).toBe(true);
  expect(r.skipped).toContain('CLAUDE.md');
});
test('linkShared: mục đã có sẵn và không phải liên kết thì giữ nguyên, báo skipped', async () => {
  await fs.mkdir(path.join(prof, 'plugins'), { recursive: true });
  await fs.writeFile(path.join(prof, 'plugins', 'keep.txt'), 'k');
  const r = await linkShared(def, prof, process.platform);
  expect(r.skipped).toContain('plugins');
  expect(await fs.readFile(path.join(prof, 'plugins', 'keep.txt'), 'utf8')).toBe('k');
});
test('linkShared chạy hai lần không lỗi', async () => {
  await linkShared(def, prof, process.platform);
  await expect(linkShared(def, prof, process.platform)).resolves.toBeDefined();
});
test('removeProfileDir xoá hồ sơ nhưng giữ nguyên dữ liệu dùng chung', async () => {
  await fs.mkdir(path.join(def, 'projects'), { recursive: true });
  await fs.writeFile(path.join(def, 'projects', 'history.jsonl'), 'quan trọng');
  await fs.writeFile(path.join(def, 'settings.json'), '{"a":1}');
  await linkShared(def, prof, process.platform);
  await removeProfileDir(prof, root);
  await expect(fs.stat(prof)).rejects.toThrow();
  expect(await fs.readFile(path.join(def, 'projects', 'history.jsonl'), 'utf8')).toBe('quan trọng');
  expect(await fs.readFile(path.join(def, 'settings.json'), 'utf8')).toBe('{"a":1}');
});
test('removeProfileDir từ chối đường dẫn ngoài root và chính root', async () => {
  await expect(removeProfileDir(def, root)).rejects.toThrow();
  await expect(removeProfileDir(root, root)).rejects.toThrow();
});
```

- [ ] **Step 2: Chạy test, mong đợi FAIL.**
- [ ] **Step 3: Viết `src/sharedLinks.ts`.** Thư mục: `fs.symlink(target, link, platform === 'win32' ? 'junction' : 'dir')`. File: `fs.symlink`; nếu Windows trả `EPERM` thì dùng `fs.link` (hard link). `unlinkShared` chỉ gỡ mục là liên kết (`lstat().isSymbolicLink()`) hoặc file trong `SHARED_FILES`, không bao giờ xoá đệ quy. `removeProfileDir` kiểm tra `path.relative(root, profileDir)` không rỗng và không bắt đầu bằng `..`, gọi `unlinkShared`, kiểm tra lại không còn mục `SHARED_DIRS` nào là liên kết, rồi mới `fs.rm(profileDir, { recursive: true })`.
- [ ] **Step 4: Chạy test, mong đợi PASS.** Chạy thêm trên Windows trước khi đóng task; nếu chưa có máy Windows, ghi rõ trong commit là chưa kiểm tra junction.
- [ ] **Step 5: Commit.** `git commit -am "feat: shared links and safe profile removal"`

---

### Task 5: Xác định hồ sơ đang dùng cho một cửa sổ

**Files:**
- Create: `src/activeProfile.ts`
- Test: `test/activeProfile.test.ts`

**Interfaces:**
- Consumes: `ProfileStore`, `BindingStore`, `Profile` (Task 2).
- Produces:

```ts
export type Reason = 'bound' | 'default-only' | 'no-folder' | 'unbound' | 'missing-profile';
export interface Resolution { profile: Profile; reason: Reason }
export function resolveActiveProfile(
  folders: readonly string[], profiles: ProfileStore, bindings: BindingStore,
  dirExists: (dir: string) => boolean,
): Resolution;
```

- [ ] **Step 1: Viết test thất bại.**

```ts
test('thư mục đã gắn → hồ sơ đó, reason bound', ...);            // profile.id === id đã gắn
test('nhiều thư mục gốc → xét thư mục đầu tiên', ...);
test('chỉ có hồ sơ Mặc định → default, reason default-only', ...);
test('không mở thư mục nào → default, reason no-folder', ...);   // folders = []
test('có hồ sơ khác nhưng thư mục chưa gắn → default, reason unbound', ...);
test('gắn với hồ sơ đã bị xoá khỏi kho → default, reason missing-profile', ...);
test('gắn với hồ sơ có thư mục không còn trên đĩa → default, reason missing-profile', ...); // dirExists trả false
```

Mỗi test khẳng định cả `profile.id` và `reason`.

- [ ] **Step 2: Chạy test, mong đợi FAIL. Viết `src/activeProfile.ts`.** Chạy lại, mong đợi PASS.
- [ ] **Step 3: Commit.** `git commit -am "feat: resolve active profile per window"`

---

### Task 6: Trỏ Claude Code vào hồ sơ

Chỉ cài đặt đúng một cách, là `APPLY_MODE` ghi trong `docs/spike-results.md`. Ba biến thể dưới đây cùng một giao diện; bỏ qua hai biến thể không được chọn.

**Files:**
- Create: `src/applier.ts`
- Create (chỉ khi `APPLY_MODE = 'wrapper'`): `resources/wrapper.sh`, `resources/wrapper.cmd`
- Test: `test/applier.test.ts`

**Interfaces:**
- Consumes: `Profile` (Task 2).
- Produces:

```ts
export interface ConfigAccess {                       // bọc vscode.workspace.getConfiguration('claudeCode')
  get<T>(key: string): T | undefined;
  updateGlobal(key: string, value: unknown): Thenable<void>;
}
export interface ApplierDeps { env: NodeJS.ProcessEnv; config: ConfigAccess; extensionPath: string; platform: NodeJS.Platform }
export class ForeignWrapperError extends Error {}
export interface ProfileApplier {
  apply(profile: Profile): Promise<void>;
  readonly perWindow: boolean;                        // false chỉ với envSetting
}
export function createApplier(deps: ApplierDeps): ProfileApplier;
```

- [ ] **Step 1: Viết test thất bại cho biến thể được chọn.**

`processEnv` (`perWindow: true`):

```ts
test('hồ sơ thường đặt CLAUDE_CONFIG_DIR', async () => {
  const env: NodeJS.ProcessEnv = {};
  await createApplier({ ...deps, env }).apply(profile('/h/Nguyễn Văn A/.claude-profiles/x1'));
  expect(env.CLAUDE_CONFIG_DIR).toBe('/h/Nguyễn Văn A/.claude-profiles/x1');
});
test('hồ sơ Mặc định xoá CLAUDE_CONFIG_DIR', async () => {
  const env: NodeJS.ProcessEnv = { CLAUDE_CONFIG_DIR: '/cũ' };
  await createApplier({ ...deps, env }).apply(defaultProfile);
  expect('CLAUDE_CONFIG_DIR' in env).toBe(false);
});
```

`wrapper` (`perWindow: true`): cùng hai test trên nhưng với biến `CLAUDE_ACCOUNTS_CONFIG_DIR`, cộng thêm:

```ts
test('đặt claudeProcessWrapper vào script của extension', async () => {
  await createApplier({ ...deps, platform: 'linux', extensionPath: '/ext' }).apply(p);
  expect(config.written.claudeProcessWrapper).toBe(path.join('/ext', 'resources', 'wrapper.sh'));
});
test('Windows dùng wrapper.cmd', ...);
test('đường dẫn script của phiên bản extension cũ được ghi đè', ...);   // giá trị cũ kết thúc bằng resources/wrapper.sh
test('script bọc của người dùng không bị ghi đè', async () => {
  config.values.claudeProcessWrapper = '/usr/local/bin/my-wrapper';
  await expect(createApplier(deps).apply(p)).rejects.toBeInstanceOf(ForeignWrapperError);
  expect(config.written.claudeProcessWrapper).toBeUndefined();
});
test('wrapper.sh chuyển biến và giữ nguyên tham số có dấu cách', ...);  // bỏ qua trên win32: chạy
// resources/wrapper.sh bằng child_process với CLAUDE_ACCOUNTS_CONFIG_DIR='/tmp/Thư Mục A',
// lệnh con là `node -e "console.log(process.env.CLAUDE_CONFIG_DIR, process.argv[1])" "a b"`,
// mong đợi stdout '/tmp/Thư Mục A a b'
```

Nội dung script (điều chỉnh thứ tự tham số theo log của bản thử nếu khác `wrapper <lệnh> <tham số…>`):

```sh
#!/bin/sh
[ -n "$CLAUDE_ACCOUNTS_CONFIG_DIR" ] && export CLAUDE_CONFIG_DIR="$CLAUDE_ACCOUNTS_CONFIG_DIR"
exec "$@"
```

```bat
@echo off
if defined CLAUDE_ACCOUNTS_CONFIG_DIR set "CLAUDE_CONFIG_DIR=%CLAUDE_ACCOUNTS_CONFIG_DIR%"
%*
```

`apply` cũng `chmod 0o755` cho `wrapper.sh` vì file `.vsix` có thể làm mất quyền chạy.

`envSetting` (`perWindow: false`):

```ts
test('thêm CLAUDE_CONFIG_DIR, giữ nguyên biến khác và thứ tự', async () => {
  config.values.environmentVariables = [{ name: 'ANTHROPIC_MODEL', value: 'm' }, { name: 'CLAUDE_CONFIG_DIR', value: '/cũ' }];
  await createApplier(deps).apply(profile('/mới'));
  expect(config.written.environmentVariables).toEqual(
    [{ name: 'ANTHROPIC_MODEL', value: 'm' }, { name: 'CLAUDE_CONFIG_DIR', value: '/mới' }]);
});
test('hồ sơ Mặc định gỡ CLAUDE_CONFIG_DIR, giữ biến khác', ...);
test('giá trị thiết lập không phải mảng được coi như mảng rỗng', ...);
```

- [ ] **Step 2: Chạy test, mong đợi FAIL. Viết biến thể được chọn trong `src/applier.ts`.** Chạy lại, mong đợi PASS.
- [ ] **Step 3: Commit.** `git commit -am "feat: apply profile to Claude Code (<APPLY_MODE>)"`

---

### Task 7: Giao diện: thanh trạng thái, chuyển nhanh, kích hoạt

**Files:**
- Create: `src/extension.ts`, `src/statusBar.ts`, `src/switchCommand.ts`, `src/versionCheck.ts`
- Modify: `package.json` (mục `contributes.commands`)
- Test: `test/statusBar.test.ts`, `test/versionCheck.test.ts`

**Interfaces:**
- Consumes: mọi thứ từ Task 2–6; `MIN_CLAUDE_CODE_VERSION` từ bản thử.
- Produces:

```ts
// src/statusBar.ts — thuần, không import vscode
export interface StatusView { text: string; tooltip: string; color: string; warning: boolean }
export function statusView(res: Resolution, email: string | undefined, perWindow: boolean): StatusView;

// src/versionCheck.ts
export function isSupported(installed: string | undefined, min: string): boolean;

// src/extension.ts
export function activate(ctx: vscode.ExtensionContext): Promise<void>;
```

Lệnh: `claudeAccounts.switch` ("Claude Accounts: Đổi tài khoản"), `claudeAccounts.add` ("Claude Accounts: Thêm tài khoản"), `claudeAccounts.manage` ("Claude Accounts: Quản lý hồ sơ").

- [ ] **Step 1: Viết test thất bại.**

```ts
test('hồ sơ đã gắn', () => {
  expect(statusView({ profile: p('Công ty A', 'charts.green'), reason: 'bound' }, 'a@x.com', true))
    .toEqual({ text: '$(account) Claude: Công ty A', tooltip: 'a@x.com', color: 'charts.green', warning: false });
});
test('chưa đăng nhập', ...);          // tooltip 'Chưa đăng nhập', warning true
test('unbound', ...);                 // text '$(account) Claude: Mặc định (chưa chọn)', warning true
test('missing-profile', ...);         // text '$(warning) Claude: thiếu hồ sơ, đang dùng Mặc định', warning true
test('envSetting thêm ghi chú áp dụng cho mọi cửa sổ vào tooltip', ...); // perWindow false → tooltip kết thúc bằng ' · áp dụng cho mọi cửa sổ'

test('isSupported so sánh từng phần số', () => {
  expect(isSupported('2.1.200', '2.1.193')).toBe(true);
  expect(isSupported('2.1.99', '2.1.193')).toBe(false);
  expect(isSupported(undefined, '2.1.193')).toBe(false);
});
```

- [ ] **Step 2: Chạy test, mong đợi FAIL. Viết `statusBar.ts` và `versionCheck.ts`.** Chạy lại, mong đợi PASS.

- [ ] **Step 3: Viết `activate` trong `src/extension.ts`** theo đúng thứ tự:
  1. Tạo `ProfileStore`, `BindingStore` trên `ctx.globalState`, `home = os.homedir()`.
  2. `resolveActiveProfile(workspaceFolders → fsPath, …, fs.existsSync)`.
  3. `applier.apply(resolution.profile)` trước mọi `await` khác, để biến môi trường có trước khi Claude Code khởi tiến trình. Bắt `ForeignWrapperError` và hiện lỗi: "Bạn đang dùng claudeProcessWrapper riêng nên Claude Accounts không đổi tài khoản được."
  4. Tạo `StatusBarItem` (căn trái, ưu tiên 100, `command: 'claudeAccounts.switch'`), vẽ bằng `statusView`; `warning` → `backgroundColor = new ThemeColor('statusBarItem.warningBackground')`.
  5. Nếu `isSupported(extensions.getExtension('anthropic.claude-code')?.packageJSON.version, MIN_CLAUDE_CODE_VERSION)` là false, hiện cảnh báo một lần: "Claude Accounts cần Claude Code từ bản <MIN> trở lên."
  6. Nếu `reason === 'unbound'` và `ctx.workspaceState.get('claudeAccounts.asked')` chưa đặt: gọi `claudeAccounts.switch` với tiêu đề "Dự án này dùng tài khoản Claude nào?", rồi đặt `asked = true` dù người dùng chọn hay bỏ qua.

- [ ] **Step 4: Viết `src/switchCommand.ts`.** Danh sách chọn theo đúng bản phác trong spec: mỗi hồ sơ một dòng (`label` là tên, `description` là email hoặc "Chưa đăng nhập", `$(check)` trước hồ sơ đang dùng), một dòng ngăn cách, "$(add) Thêm tài khoản…", "$(gear) Quản lý hồ sơ…". Khi chọn một hồ sơ: `bindings.set(thư mục đầu tiên, id)` nếu có thư mục, `applier.apply`, vẽ lại thanh trạng thái; nếu hồ sơ khác hồ sơ trước đó, hỏi "Tải lại cửa sổ để Claude dùng tài khoản <tên>?" với nút "Tải lại" gọi `workbench.action.reloadWindow`.

- [ ] **Step 5: Kiểm tra bằng tay.** `npm run build`, nhấn F5 mở Extension Development Host. Mong đợi: thanh trạng thái hiện "Claude: Mặc định"; bấm vào thấy danh sách có một hồ sơ và hai mục lệnh.
- [ ] **Step 6: Commit.** `git commit -am "feat: status bar, quick switch, activation"`

---

### Task 8: Thêm tài khoản và đăng nhập

**Files:**
- Create: `src/addAccount.ts`, `src/login.ts`
- Modify: `src/extension.ts` (đăng ký `claudeAccounts.add`)
- Test: `test/login.test.ts`

**Interfaces:**
- Consumes: `ProfileStore.add`, `linkShared`, `readAccountEmail`, `LOGIN_COMMAND` từ bản thử.
- Produces:

```ts
// src/login.ts — thuần, phụ thuộc được truyền vào
export interface LoginDeps {
  hasCli(): Promise<boolean>;
  openTerminal(name: string, env: Record<string, string>, command: string): { dispose(): void };
  readEmail(): Promise<string | undefined>;
  sleep(ms: number): Promise<void>;
}
export const POLL_MS = 2000;
export const TIMEOUT_MS = 300_000;
export async function runLogin(profile: Profile, deps: LoginDeps): Promise<'signed-in' | 'timeout' | 'no-cli'>;
```

- [ ] **Step 1: Viết test thất bại** (deps giả, `sleep` trả về ngay).

```ts
test('mở terminal với CLAUDE_CONFIG_DIR của hồ sơ và lệnh đăng nhập', ...);
// openTerminal được gọi với ('Claude: đăng nhập Công ty A', { CLAUDE_CONFIG_DIR: profile.configDir }, LOGIN_COMMAND)
test('thấy email thì trả signed-in và đóng terminal', ...);       // readEmail: undefined, undefined, 'a@x.com'
test('quá 150 lần hỏi không thấy email thì trả timeout, không đóng terminal', ...);
test('không có lệnh claude thì trả no-cli và không mở terminal', ...);
```

- [ ] **Step 2: Chạy test, mong đợi FAIL. Viết `src/login.ts`.** Chạy lại, mong đợi PASS.

- [ ] **Step 3: Viết `src/addAccount.ts`** theo đúng thứ tự:
  1. `showInputBox` hỏi tên ("Tên tài khoản, ví dụ: Công ty A"); kiểm tra bằng `validateInput` dùng cùng quy tắc với `ProfileStore.add`.
  2. `profiles.add(name)`, `fs.mkdir(configDir, { recursive: true })`, `linkShared(...)`. Nếu `LinkReport.skipped` có mục thuộc `SHARED_DIRS`, hiện cảnh báo nêu tên các mục đó.
  3. `runLogin`. `signed-in`: thông báo "Đã đăng nhập <email>" và hỏi có dùng ngay cho dự án này không (đi qua cùng đường với chọn hồ sơ ở Task 7). `timeout`: thông báo "Chưa thấy đăng nhập; hồ sơ vẫn được giữ, bạn có thể đăng nhập lại từ Quản lý hồ sơ." `no-cli`: áp dụng hồ sơ cho cửa sổ này, tải lại và nhắc "Hãy đăng nhập trong khung Claude."
  4. `hasCli` thật: chạy `claude --version` qua `child_process.execFile` với `shell: true`, coi mã thoát 0 là có.

- [ ] **Step 4: Kiểm tra bằng tay** trong Extension Development Host: thêm một tài khoản thật. Mong đợi: thư mục `~/.claude-profiles/<id>` có các liên kết, terminal tự đóng sau khi đăng nhập, email hiện trong danh sách chọn.
- [ ] **Step 5: Commit.** `git commit -am "feat: add account and sign-in flow"`

---

### Task 9: Quản lý hồ sơ: đổi tên, đăng nhập lại, xoá

**Files:**
- Create: `src/manageCommand.ts`
- Modify: `src/extension.ts` (đăng ký `claudeAccounts.manage`)
- Test: `test/manageCommand.test.ts`

**Interfaces:**
- Consumes: `ProfileStore`, `BindingStore.removeProfile`, `removeProfileDir`, `profilesRoot`, `runLogin`.
- Produces:

```ts
export async function deleteProfile(id: string, deps: {
  profiles: ProfileStore; bindings: BindingStore; root: string;
  removeDir: (dir: string, root: string) => Promise<void>;
}): Promise<void>;
```

- [ ] **Step 1: Viết test thất bại.**

```ts
test('deleteProfile xoá thư mục, gỡ cặp gắn rồi mới xoá khỏi kho', ...);   // kiểm tra thứ tự gọi
test('removeDir lỗi thì hồ sơ vẫn còn trong kho và cặp gắn còn nguyên', ...);
test('deleteProfile từ chối hồ sơ Mặc định', ...);
```

- [ ] **Step 2: Chạy test, mong đợi FAIL. Viết `deleteProfile`.** Chạy lại, mong đợi PASS.

- [ ] **Step 3: Viết phần giao diện của `manageCommand.ts`.** Chọn hồ sơ, rồi chọn "Đổi tên", "Đăng nhập lại" (gọi `runLogin`) hoặc "Xoá" (ẩn với Mặc định). Xoá dùng hộp thoại modal với nội dung chính xác: "Xoá hồ sơ <tên>? Đăng nhập của hồ sơ này sẽ bị xoá. Lịch sử hội thoại dùng chung được giữ lại." Trên macOS thêm câu: "Mục đăng nhập trong Keychain không bị xoá; hãy đăng xuất trong Claude trước nếu muốn gỡ hẳn." Nếu hồ sơ bị xoá đang dùng ở cửa sổ này, áp dụng lại Mặc định và đề nghị tải lại cửa sổ.

- [ ] **Step 4: Kiểm tra bằng tay:** xoá hồ sơ vừa tạo ở Task 8. Mong đợi: thư mục hồ sơ biến mất, `~/.claude/projects` còn nguyên số file như trước khi xoá.
- [ ] **Step 5: Commit.** `git commit -am "feat: manage profiles (rename, re-login, remove)"`

---

### Task 10: Đóng gói và kiểm tra trên ba hệ điều hành

**Files:**
- Create: `README.md`, `docs/verification.md`
- Modify: `.vscodeignore` (loại `src/`, `test/`, `docs/`; giữ `dist/`, `resources/`)

- [ ] **Step 1: Viết `README.md`:** cách cài file `.vsix`, ba lệnh, phần nào dùng chung và phần nào tách riêng, ngoại lệ Claude Console không kèm khoá API (không tách được bằng thư mục), và nếu `APPLY_MODE = 'envSetting'` thì ghi rõ mọi cửa sổ dùng chung một tài khoản.
- [ ] **Step 2: Đóng gói.** Chạy `npm test && npm run build && npm run package`. Mong đợi: mọi test PASS và có file `claude-account-switcher-0.1.0.vsix`.
- [ ] **Step 3: Kiểm tra trên từng hệ điều hành** (Windows, macOS, Linux), ghi kết quả vào `docs/verification.md`:
  1. Cài `.vsix` trên máy đã có Claude Code đang đăng nhập. Đạt khi đăng nhập hiện có không đổi và thanh trạng thái hiện "Claude: Mặc định".
  2. Thêm hai tài khoản. Đạt khi cả hai hiện email.
  3. Mở dự án A, chọn tài khoản 1; mở dự án B, chọn tài khoản 2. Đóng và mở lại cả hai. Đạt khi mỗi cửa sổ tự hiện đúng tài khoản và khung chat Claude chạy bằng tài khoản đó.
  4. Mở một dự án mới chưa gắn. Đạt khi được hỏi đúng một lần.
  5. Từ tài khoản 2, mở tiếp một hội thoại tạo bằng tài khoản 1. Đạt khi hội thoại hiện đủ.
  6. Xoá thư mục hồ sơ của tài khoản 2 bằng tay rồi mở dự án B. Đạt khi thanh trạng thái hiện cảnh báo thiếu hồ sơ.
  7. Xoá tài khoản 1 qua "Quản lý hồ sơ". Đạt khi lịch sử trong `~/.claude/projects` còn nguyên.
  8. Khởi động lại máy. Đạt khi các tài khoản còn lại vẫn đăng nhập.
- [ ] **Step 4: Commit.** `git add -A && git commit -m "docs: README and cross-platform verification"`
