import { expect, test } from 'vitest';
import { LOGIN_ARGS, POLL_MS, resolveCli, runLogin, TIMEOUT_MS, type LoginDeps } from '../src/login';
import type { Profile } from '../src/profileStore';

const profile: Profile = { id: 'x1', name: 'Công ty A', color: 'charts.green', configDir: 'C:\\Users\\Nguyễn Văn A\\.claude-profiles\\x1', isDefault: false };
const defaultProfile: Profile = { id: 'default', name: 'Default', color: 'charts.blue', configDir: 'C:\\Users\\a\\.claude', isDefault: true };
const CLI = 'C:\\ext\\resources\\native-binary\\claude.exe';

/**
 * Deps giả có kịch bản: `emails[i]` là kết quả lần đọc thứ i (lần 0 là mốc trước khi mở terminal),
 * `exitAt` là lần hỏi (tính từ 0, sau khi mở terminal) mà tiến trình đăng nhập thoát với `exitCode`.
 */
function fakeDeps(opts: { cli?: string; emails: (string | undefined)[]; exitAt?: number; exitCode?: number; reportsExit?: boolean }) {
  const calls = { opened: [] as unknown[][], disposed: 0, reads: 0, sleeps: [] as number[] };
  let polls = 0;
  const deps: LoginDeps = {
    findCli: async () => opts.cli,
    openTerminal: (...args) => {
      calls.opened.push(args);
      return {
        reportsExit: opts.reportsExit ?? opts.exitAt !== undefined,
        dispose: () => { calls.disposed++; },
        exitCode: () => (opts.exitAt !== undefined && polls >= opts.exitAt ? opts.exitCode ?? 0 : undefined),
      };
    },
    readEmail: async () => {
      const i = calls.reads++;
      return opts.emails[Math.min(i, opts.emails.length - 1)];
    },
    sleep: async (ms) => { calls.sleeps.push(ms); polls++; },
  };
  return { deps, calls };
}

test('mở terminal chạy lệnh đăng nhập với CLAUDE_CONFIG_DIR của hồ sơ', async () => {
  const { deps, calls } = fakeDeps({ cli: CLI, emails: [undefined, 'a@x.com'] });
  await runLogin(profile, deps);
  expect(calls.opened).toEqual([['Claude sign-in: Công ty A', { CLAUDE_CONFIG_DIR: profile.configDir }, CLI, ['auth', 'login']]]);
  expect(LOGIN_ARGS).toEqual(['auth', 'login']);
});

test('hồ sơ Mặc định: gỡ CLAUDE_CONFIG_DIR khỏi môi trường terminal (cửa sổ có thể đang đặt hồ sơ khác)', async () => {
  const { deps, calls } = fakeDeps({ cli: CLI, emails: [undefined, 'me@x.com'] });
  await runLogin(defaultProfile, deps);
  expect(calls.opened[0][1]).toEqual({ CLAUDE_CONFIG_DIR: null });
});

test('hồ sơ Mặc định có envDir: terminal dùng đúng CLAUDE_CONFIG_DIR đó', async () => {
  const { deps, calls } = fakeDeps({ cli: CLI, emails: [undefined, 'me@x.com'] });
  await runLogin({ ...defaultProfile, configDir: 'D:\\claude', envDir: 'D:\\claude' }, deps);
  expect(calls.opened[0][1]).toEqual({ CLAUDE_CONFIG_DIR: 'D:\\claude' });
});

test('thấy email thì trả signed-in và đóng terminal', async () => {
  const { deps, calls } = fakeDeps({ cli: CLI, emails: [undefined, undefined, undefined, 'a@x.com'] });
  expect(await runLogin(profile, deps)).toBe('signed-in');
  expect(calls.disposed).toBe(1);
  expect(calls.sleeps.every((ms) => ms === POLL_MS)).toBe(true);
});

test('quá 150 lần hỏi không thấy email thì trả timeout, không đóng terminal', async () => {
  const { deps, calls } = fakeDeps({ cli: CLI, emails: [undefined] });
  expect(await runLogin(profile, deps)).toBe('timeout');
  expect(TIMEOUT_MS / POLL_MS).toBe(150);
  expect(calls.sleeps.length).toBe(150);
  expect(calls.disposed).toBe(0);
});

test('không có lệnh claude thì trả no-cli và không mở terminal', async () => {
  const { deps, calls } = fakeDeps({ emails: [undefined] });
  expect(await runLogin(profile, deps)).toBe('no-cli');
  expect(calls.opened).toEqual([]);
});

test('đăng nhập lại: email cũ còn đó thì chưa tính là xong; xong khi tiến trình thoát mã 0', async () => {
  const { deps, calls } = fakeDeps({ cli: CLI, emails: ['cu@x.com'], exitAt: 3, exitCode: 0 });
  expect(await runLogin(profile, deps)).toBe('signed-in');
  expect(calls.sleeps.length).toBe(3);
  expect(calls.disposed).toBe(1);
});

test('đăng nhập lại sang tài khoản khác: email đổi thì xong ngay', async () => {
  const { deps } = fakeDeps({ cli: CLI, emails: ['cu@x.com', 'cu@x.com', 'moi@x.com'] });
  expect(await runLogin(profile, deps)).toBe('signed-in');
});

test('terminal báo được mã thoát: thấy email mới nhưng tiến trình chưa thoát thì chưa đóng (có thể đang ghi đăng nhập)', async () => {
  const { deps, calls } = fakeDeps({ cli: CLI, emails: [undefined, 'a@x.com'], exitAt: 3, exitCode: 0 });
  expect(await runLogin(profile, deps)).toBe('signed-in');
  expect(calls.sleeps.length).toBe(3);
  expect(calls.disposed).toBe(1);
});

test('tiến trình thoát mã khác 0 thì trả failed, giữ terminal để người dùng xem lỗi', async () => {
  const { deps, calls } = fakeDeps({ cli: CLI, emails: [undefined], exitAt: 2, exitCode: 1 });
  expect(await runLogin(profile, deps)).toBe('failed');
  expect(calls.disposed).toBe(0);
  expect(calls.sleeps.length).toBe(2);
});

test('resolveCli: ưu tiên file chạy đi kèm Claude Code, rồi tới claude trên PATH', () => {
  expect(resolveCli({ bundled: CLI, bundledExists: true, onPath: true })).toBe(CLI);
  expect(resolveCli({ bundled: CLI, bundledExists: false, onPath: true })).toBe('claude');
  expect(resolveCli({ bundled: undefined, bundledExists: false, onPath: true })).toBe('claude');
  expect(resolveCli({ bundled: CLI, bundledExists: false, onPath: false })).toBeUndefined();
});

test('CLI ghi email rồi thoát giữa hai lần đọc: vẫn tính là signed-in (đọc mã thoát trước email)', async () => {
  let polls = 0;
  let exitSeen = false;
  const deps: LoginDeps = {
    findCli: async () => CLI,
    openTerminal: () => ({
      reportsExit: true,
      dispose: () => {},
      // Tiến trình thoát ở lần hỏi thứ 2; .claude.json đã có email ngay khi nó thoát.
      exitCode: () => { if (polls >= 2) { exitSeen = true; return 0; } return undefined; },
    }),
    readEmail: async () => (exitSeen ? 'a@x.com' : undefined),
    sleep: async () => { polls++; },
  };
  expect(await runLogin(profile, deps)).toBe('signed-in');
});
