import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { Profile } from './profileStore';

/**
 * Email của tài khoản đang đăng nhập trong hồ sơ, đọc từ trường `oauthAccount.emailAddress` của `.claude.json`.
 * Chỉ mở đúng file này; không bao giờ đọc `.credentials.json` hay token.
 * Hồ sơ Mặc định (không đặt `CLAUDE_CONFIG_DIR`) dùng `<home>/.claude.json`; hồ sơ khác dùng `<configDir>/.claude.json`.
 */
export async function readAccountEmail(profile: Profile, home: string): Promise<string | undefined> {
  const file = path.join(profile.isDefault ? home : profile.configDir, '.claude.json');
  try {
    const data = JSON.parse(await fs.readFile(file, 'utf8')) as { oauthAccount?: { emailAddress?: unknown } };
    const email = data?.oauthAccount?.emailAddress;
    return typeof email === 'string' && email ? email : undefined;
  } catch {
    return undefined;
  }
}
