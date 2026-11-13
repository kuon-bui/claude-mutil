import path from 'node:path';
import type { Profile } from './profileStore';

/** Bọc `vscode.workspace.getConfiguration('claudeCode')`. */
export interface ConfigAccess {
  get<T>(key: string): T | undefined;
  updateGlobal(key: string, value: unknown): Thenable<void>;
}
export interface ApplierDeps { env: NodeJS.ProcessEnv; config: ConfigAccess; extensionPath: string; platform: NodeJS.Platform }
export interface ProfileApplier {
  apply(profile: Profile): Promise<void>;
  readonly perWindow: boolean;
}

const VAR = 'CLAUDE_CONFIG_DIR';

/**
 * Cách `processEnv` (bản thử Task 1): đặt `CLAUDE_CONFIG_DIR` trong `process.env` của extension host cửa sổ này.
 * Claude Code chép `process.env` mỗi lần khởi tiến trình, nên mỗi cửa sổ có thể dùng một hồ sơ.
 * Gán biến chạy đồng bộ ngay khi gọi `apply`, trước mọi `await`, để kịp trước khi Claude Code khởi tiến trình.
 */
export function createApplier(deps: ApplierDeps): ProfileApplier {
  return {
    perWindow: true,
    apply(profile: Profile): Promise<void> {
      if (profile.isDefault) delete deps.env[VAR];
      else deps.env[VAR] = profile.configDir;
      return Promise.resolve();
    },
  };
}

function isAbsoluteFor(value: string, platform: NodeJS.Platform): boolean {
  if (platform !== 'win32') return path.posix.isAbsolute(value);
  return /^([A-Za-z]:[\\/]|[\\/]{2}[^\\/]+[\\/]+[^\\/])/.test(value);
}

/**
 * Giá trị `CLAUDE_CONFIG_DIR` trong thiết lập `claudeCode.environmentVariables`, nếu có. Claude Code để giá trị này
 * thắng `process.env`, nên khi nó có mặt thì extension không đổi được tài khoản. Theo đúng cách Claude Code 2.1.323
 * đọc thiết lập: mảng `{name, value}` hoặc đối tượng `{TÊN: giá trị}`; tên không phân biệt hoa thường trên Windows;
 * chỉ tính giá trị là đường dẫn tuyệt đối; nhiều mục thì mục cuối thắng.
 */
export function configDirOverride(config: ConfigAccess, platform: NodeJS.Platform): string | undefined {
  const raw = config.get<unknown>('environmentVariables');
  let entries: { name: string; value: string }[] = [];
  if (Array.isArray(raw)) {
    entries = raw
      .filter((e): e is { name: string; value?: unknown } => e != null && typeof e === 'object' && typeof e.name === 'string')
      .map((e) => ({ name: e.name, value: e.value == null ? '' : String(e.value) }));
  } else if (raw != null && typeof raw === 'object') {
    entries = Object.entries(raw).map(([name, value]) => ({ name, value: value == null ? '' : String(value) }));
  }
  let found: string | undefined;
  for (const { name, value } of entries) {
    const matches = platform === 'win32' ? name.toUpperCase() === VAR : name === VAR;
    if (matches && isAbsoluteFor(value, platform)) found = value;
  }
  return found;
}
