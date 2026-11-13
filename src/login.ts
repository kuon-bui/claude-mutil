import type { Profile } from './profileStore';

/** Lệnh đăng nhập đã kiểm trong bản thử Task 1: `claude auth login`. */
export const LOGIN_ARGS = ['auth', 'login'] as const;
export const POLL_MS = 2000;
export const TIMEOUT_MS = 300_000;

export interface LoginTerminal {
  dispose(): void;
  /** Mã thoát của tiến trình đăng nhập; `undefined` khi còn chạy (hoặc không biết được). */
  exitCode(): number | undefined;
}

/** Thuần: mọi phụ thuộc được truyền vào. */
export interface LoginDeps {
  /** Đường dẫn file chạy `claude`, hoặc `undefined` nếu không có. */
  findCli(): Promise<string | undefined>;
  /** `env` có giá trị `null` nghĩa là gỡ biến đó khỏi môi trường terminal. */
  openTerminal(name: string, env: Record<string, string | null>, cli: string, args: string[]): LoginTerminal;
  readEmail(): Promise<string | undefined>;
  sleep(ms: number): Promise<void>;
}

export type LoginResult = 'signed-in' | 'timeout' | 'no-cli' | 'failed';

/**
 * Mở terminal đăng nhập vào hồ sơ rồi chờ. Xong khi: có email mới khác email trước khi mở, hoặc tiến trình thoát
 * mã 0 và có email (trường hợp đăng nhập lại đúng tài khoản cũ). Tiến trình thoát mã khác 0 → `failed`.
 */
export async function runLogin(profile: Profile, deps: LoginDeps): Promise<LoginResult> {
  const cli = await deps.findCli();
  if (!cli) return 'no-cli';
  const baseline = await deps.readEmail();
  const env = { CLAUDE_CONFIG_DIR: profile.isDefault ? null : profile.configDir };
  const terminal = deps.openTerminal(`Claude: đăng nhập ${profile.name}`, env, cli, [...LOGIN_ARGS]);
  for (let i = 0; i < TIMEOUT_MS / POLL_MS; i++) {
    await deps.sleep(POLL_MS);
    const email = await deps.readEmail();
    const code = terminal.exitCode();
    if (email && (email !== baseline || code === 0)) {
      terminal.dispose();
      return 'signed-in';
    }
    if (code !== undefined) return 'failed';
  }
  return 'timeout';
}

/**
 * Chọn file chạy `claude`: ưu tiên bản đi kèm extension Claude Code (luôn có khi Claude Code đã cài, cùng phiên bản),
 * rồi tới `claude` trên PATH. Bản thử Task 1: máy người dùng không có `claude` trên PATH.
 */
export function resolveCli(found: { bundled: string | undefined; bundledExists: boolean; onPath: boolean }): string | undefined {
  if (found.bundled && found.bundledExists) return found.bundled;
  return found.onPath ? 'claude' : undefined;
}
