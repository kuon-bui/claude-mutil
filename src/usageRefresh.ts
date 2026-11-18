import { spawn } from 'node:child_process';
import path from 'node:path';
import type { Profile } from './profileStore';

/**
 * `claude -p /usage`: Claude Code tự lấy quota bằng đăng nhập của chính nó (không gọi model) rồi lưu vào
 * `cachedUsageUtilization` trong `.claude.json`. Extension chỉ đọc lại file đó, vẫn không đụng tới token.
 * Đã thử với Claude Code 2.1.326: mất khoảng 4 giây.
 */
export const USAGE_ARGS = ['-p', '/usage'] as const;
/** Quota lưu cũ hơn mức này thì tự lấy lại cho hồ sơ đang dùng. */
export const STALE_MS = 5 * 60_000;
const RUN_TIMEOUT_MS = 60_000;

export type RefreshResult = 'ok' | 'no-cli' | 'failed';

export interface UsageRefreshDeps {
  findCli(): Promise<string | undefined>;
  /** Chạy `cli args` với `CLAUDE_CONFIG_DIR = configDir` (`null`: gỡ biến); `true` nếu thoát mã 0. */
  run(cli: string, args: string[], configDir: string | null): Promise<boolean>;
}

/** Giá trị `CLAUDE_CONFIG_DIR` cho tiến trình `claude` chạy bằng hồ sơ này (`null`: gỡ biến). */
export function configDirEnv(profile: Profile): string | null {
  return profile.isDefault ? profile.envDir ?? null : profile.configDir;
}

export function isStale(fetchedAt: number | undefined, now: number): boolean {
  return fetchedAt === undefined || now - fetchedAt >= STALE_MS;
}

/** Lấy lại quota từng hồ sơ; mỗi hồ sơ chỉ chạy một lần tại một thời điểm. */
export function createUsageRefresher(deps: UsageRefreshDeps) {
  const inFlight = new Map<string, Promise<RefreshResult>>();
  async function work(profile: Profile): Promise<RefreshResult> {
    const cli = await deps.findCli();
    if (cli === undefined) return 'no-cli';
    return (await deps.run(cli, [...USAGE_ARGS], configDirEnv(profile))) ? 'ok' : 'failed';
  }
  return {
    isRefreshing: (id: string) => inFlight.has(id),
    busy: () => inFlight.size > 0,
    refresh(profile: Profile): Promise<RefreshResult> {
      const running = inFlight.get(profile.id);
      if (running !== undefined) return running;
      const p = work(profile).catch((): RefreshResult => 'failed').finally(() => inFlight.delete(profile.id));
      inFlight.set(profile.id, p);
      return p;
    },
  };
}

export type UsageRefresher = ReturnType<typeof createUsageRefresher>;

/**
 * Chạy `claude` nền, không cửa sổ, bỏ qua đầu ra. Môi trường chép từ extension host (đang mang `CLAUDE_CONFIG_DIR`
 * của hồ sơ đang dùng) rồi đặt lại theo hồ sơ cần lấy. `claude` trên PATH (không phải đường dẫn đầy đủ) cần shell.
 */
export function runCli(cwd: string): UsageRefreshDeps['run'] {
  return (cli, args, configDir) => new Promise((resolve) => {
    const env = { ...process.env };
    if (configDir === null) delete env.CLAUDE_CONFIG_DIR;
    else env.CLAUDE_CONFIG_DIR = configDir;
    const child = spawn(cli, args, {
      cwd, env, stdio: 'ignore', windowsHide: true, shell: !path.isAbsolute(cli), timeout: RUN_TIMEOUT_MS,
    });
    child.on('error', () => resolve(false));
    child.on('close', (code) => resolve(code === 0));
  });
}
