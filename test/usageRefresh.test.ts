import { expect, test } from 'vitest';
import type { Profile } from '../src/profileStore';
import { createUsageRefresher, isStale, STALE_MS, USAGE_ARGS, type UsageRefreshDeps } from '../src/usageRefresh';

const profile: Profile = { id: 'x1', name: 'Công ty A', color: 'charts.green', configDir: 'C:\\h\\.claude-profiles\\x1', isDefault: false };
const def: Profile = { id: 'default', name: 'Default', color: 'charts.blue', configDir: 'C:\\h\\.claude', isDefault: true };
const CLI = 'C:\\ext\\resources\\native-binary\\claude.exe';

function fakeDeps(opts: { cli?: string; ok?: boolean; throws?: boolean } = {}) {
  const runs: [string, string[], string | null][] = [];
  let finish: (ok: boolean) => void = () => {};
  const deps: UsageRefreshDeps = {
    findCli: async () => ('cli' in opts ? opts.cli : CLI),
    run: (cli, args, configDir) => {
      runs.push([cli, args, configDir]);
      if (opts.throws) return Promise.reject(new Error('spawn failed'));
      if (opts.ok !== undefined) return Promise.resolve(opts.ok);
      return new Promise<boolean>((resolve) => { finish = resolve; });
    },
  };
  return { deps, runs, finish: (ok: boolean) => finish(ok) };
}

test('chạy `claude -p /usage` với CLAUDE_CONFIG_DIR của hồ sơ', async () => {
  const { deps, runs } = fakeDeps({ ok: true });
  expect(await createUsageRefresher(deps).refresh(profile)).toBe('ok');
  expect(runs).toEqual([[CLI, ['-p', '/usage'], profile.configDir]]);
  expect(USAGE_ARGS).toEqual(['-p', '/usage']);
});

test('hồ sơ Mặc định: gỡ CLAUDE_CONFIG_DIR, hoặc giữ giá trị đặt sẵn ngoài VS Code', async () => {
  const { deps, runs } = fakeDeps({ ok: true });
  const refresher = createUsageRefresher(deps);
  await refresher.refresh(def);
  await refresher.refresh({ ...def, envDir: 'D:\\claude' });
  expect(runs.map((r) => r[2])).toEqual([null, 'D:\\claude']);
});

test('không có claude: no-cli, không chạy gì', async () => {
  const { deps, runs } = fakeDeps({ cli: undefined });
  expect(await createUsageRefresher(deps).refresh(profile)).toBe('no-cli');
  expect(runs).toEqual([]);
});

test('lệnh thoát lỗi hoặc không chạy được: failed', async () => {
  expect(await createUsageRefresher(fakeDeps({ ok: false }).deps).refresh(profile)).toBe('failed');
  expect(await createUsageRefresher(fakeDeps({ throws: true }).deps).refresh(profile)).toBe('failed');
});

test('đang lấy thì không chạy lần thứ hai cho cùng hồ sơ; xong thì hết refreshing', async () => {
  const { deps, runs, finish } = fakeDeps();
  const refresher = createUsageRefresher(deps);
  const first = refresher.refresh(profile);
  const second = refresher.refresh(profile);
  expect(refresher.isRefreshing(profile.id)).toBe(true);
  expect(refresher.busy()).toBe(true);
  await Promise.resolve(); await Promise.resolve();
  finish(true);
  expect(await first).toBe('ok');
  expect(await second).toBe('ok');
  expect(runs).toHaveLength(1);
  expect(refresher.isRefreshing(profile.id)).toBe(false);
  expect(refresher.busy()).toBe(false);
});

test('isStale: không có bản lưu hoặc cũ hơn STALE_MS', () => {
  const now = 10 * STALE_MS;
  expect(isStale(undefined, now)).toBe(true);
  expect(isStale(now - STALE_MS, now)).toBe(true);
  expect(isStale(now - STALE_MS + 1, now)).toBe(false);
});
