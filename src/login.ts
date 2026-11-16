import type { Profile } from './profileStore';

/** Lệnh đăng nhập đã kiểm trong bản thử Task 1: `claude auth login`. */
export const LOGIN_ARGS = ['auth', 'login'] as const;
export const POLL_MS = 2000;
export const TIMEOUT_MS = 300_000;

export interface LoginTerminal {
  /** Terminal chạy thẳng file `claude` nên biết được mã thoát; `false` khi lệnh được gõ vào một shell. */
  readonly reportsExit: boolean;
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
 * Mở terminal đăng nhập vào hồ sơ rồi chờ.
 * - Terminal báo được mã thoát: chờ tiến trình tự thoát (không đóng giữa chừng khi nó còn có thể đang ghi đăng nhập);
 *   thoát mã 0 và có email → `signed-in`, ngược lại → `failed`. Đăng nhập lại đúng tài khoản cũ cũng nhận ra được.
 * - Không biết mã thoát (lệnh gõ vào shell): xong khi có email khác email trước khi mở; terminal bị đóng → `failed`.
 */
export async function runLogin(profile: Profile, deps: LoginDeps): Promise<LoginResult> {
  const cli = await deps.findCli();
  if (!cli) return 'no-cli';
  const baseline = await deps.readEmail();
  const env = { CLAUDE_CONFIG_DIR: profile.isDefault ? profile.envDir ?? null : profile.configDir };
  const terminal = deps.openTerminal(`Claude sign-in: ${profile.name}`, env, cli, [...LOGIN_ARGS]);
  for (let i = 0; i < TIMEOUT_MS / POLL_MS; i++) {
    await deps.sleep(POLL_MS);
    const code = terminal.exitCode();
    const email = await deps.readEmail();
    if (terminal.reportsExit) {
      if (code === undefined) continue;
      if (code === 0 && email) {
        terminal.dispose();
        return 'signed-in';
      }
      return 'failed';
    }
    if (email && email !== baseline) {
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
