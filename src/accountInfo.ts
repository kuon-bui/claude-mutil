import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { Profile } from './profileStore';

/** Một hạn mức trong quota của gói: phần trăm đã dùng và lúc đặt lại (ms từ epoch, nếu biết). */
export interface UsageLimit { label: string; percent: number; resetsAt?: number }
/** Quota Claude Code lưu lần gần nhất, kèm thời điểm lấy (ms từ epoch). */
export interface AccountUsage { fetchedAt: number; limits: UsageLimit[] }
export interface AccountKind { label: string; organization?: string }
export interface AccountInfo { email?: string; usage?: AccountUsage; kind: AccountKind }

/** Type gói từ `oauthAccount.organizationType`: Pro / Team / nguyên chuỗi / Unknown. */
export function accountKind(oauth: unknown): AccountKind {
  const obj = oauth !== null && typeof oauth === 'object' ? oauth as { organizationType?: unknown; organizationName?: unknown } : undefined;
  const t = obj?.organizationType;
  const label = t === 'claude_pro' ? 'Pro' : t === 'claude_team' ? 'Team' : typeof t === 'string' ? t : 'Unknown';
  const name = obj?.organizationName;
  const organization = typeof t === 'string' && typeof name === 'string' && name ? name : undefined;
  return organization === undefined ? { label } : { label, organization };
}

/** `.claude.json` của hồ sơ, như Claude Code: trong CLAUDE_CONFIG_DIR nếu biến được đặt, không thì trong home. */
function claudeJsonPath(profile: Profile, home: string): string {
  const dir = profile.isDefault ? profile.envDir ?? home : profile.configDir;
  return path.join(dir, '.claude.json');
}

/**
 * Email và quota của tài khoản đang đăng nhập trong hồ sơ, đọc từ `.claude.json`:
 * email ở `oauthAccount.emailAddress`, quota ở `cachedUsageUtilization` (Claude Code tự lưu mỗi lần lấy quota).
 * Chỉ mở đúng file này; không bao giờ đọc `.credentials.json` hay token, không gọi mạng.
 * Hồ sơ Mặc định (không đặt `CLAUDE_CONFIG_DIR`) dùng `<home>/.claude.json`; hồ sơ khác dùng `<configDir>/.claude.json`.
 */
export async function readAccountInfo(profile: Profile, home: string): Promise<AccountInfo> {
  let data: unknown;
  try {
    data = JSON.parse(await fs.readFile(claudeJsonPath(profile, home), 'utf8'));
  } catch {
    return { kind: accountKind(undefined) };
  }
  const account = (data as { oauthAccount?: { emailAddress?: unknown } } | null)?.oauthAccount;
  const email = typeof account?.emailAddress === 'string' && account.emailAddress ? account.emailAddress : undefined;
  return { email, usage: email === undefined ? undefined : parseUsage(data), kind: accountKind(account) };
}

export async function readAccountEmail(profile: Profile, home: string): Promise<string | undefined> {
  return (await readAccountInfo(profile, home)).email;
}

interface RawLimit { kind?: unknown; percent?: unknown; resets_at?: unknown; scope?: { model?: { display_name?: unknown } | null; surface?: unknown } | null }
interface RawWindow { utilization?: unknown; resets_at?: unknown }

const WINDOW_LABELS: Record<string, string> = {
  five_hour: 'Session (5h)', seven_day: 'Weekly', seven_day_opus: 'Weekly (Opus)', seven_day_sonnet: 'Weekly (Sonnet)',
};

function time(value: unknown): number | undefined {
  if (typeof value !== 'string') return undefined;
  const ms = Date.parse(value);
  return Number.isNaN(ms) ? undefined : ms;
}

function limitLabel(l: RawLimit): string {
  if (l.kind === 'session') return 'Session (5h)';
  if (l.kind === 'weekly_all') return 'Weekly';
  const scope = l.scope?.model?.display_name ?? l.scope?.surface;
  if (l.kind === 'weekly_scoped') return typeof scope === 'string' && scope ? `Weekly (${scope})` : 'Weekly (scoped)';
  return String(l.kind).replace(/_/g, ' ');
}

/**
 * Quota trong `cachedUsageUtilization`. Bỏ qua nếu bản lưu thuộc tài khoản khác (đăng nhập lại bằng tài khoản khác
 * mà Claude Code chưa lấy quota mới). Ưu tiên danh sách `limits`; bản cũ chỉ có các cửa sổ `five_hour`, `seven_day`….
 */
function parseUsage(data: unknown): AccountUsage | undefined {
  const root = data as { oauthAccount?: { accountUuid?: unknown }; cachedUsageUtilization?: unknown };
  const cache = root.cachedUsageUtilization as { fetchedAtMs?: unknown; accountUuid?: unknown; utilization?: Record<string, unknown> } | undefined;
  if (!cache || typeof cache !== 'object' || typeof cache.fetchedAtMs !== 'number' || !cache.utilization) return undefined;
  const uuid = root.oauthAccount?.accountUuid;
  if (typeof uuid === 'string' && typeof cache.accountUuid === 'string' && uuid !== cache.accountUuid) return undefined;

  const u = cache.utilization;
  let limits: UsageLimit[];
  if (Array.isArray(u.limits)) {
    limits = (u.limits as RawLimit[])
      .filter((l) => l && typeof l.percent === 'number' && typeof l.kind === 'string')
      .map((l) => ({ label: limitLabel(l), percent: l.percent as number, resetsAt: time(l.resets_at) }));
  } else {
    limits = Object.entries(WINDOW_LABELS).flatMap(([key, label]) => {
      const w = u[key] as RawWindow | null | undefined;
      return w && typeof w.utilization === 'number' ? [{ label, percent: w.utilization, resetsAt: time(w.resets_at) }] : [];
    });
  }
  return limits.length > 0 ? { fetchedAt: cache.fetchedAtMs, limits } : undefined;
}
