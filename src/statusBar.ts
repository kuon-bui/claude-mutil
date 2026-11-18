import type { AccountUsage } from './accountInfo';
import type { Resolution } from './activeProfile';

/** `tooltip` là Markdown (đã thoát ký tự đặc biệt của phần chữ). */
export interface StatusView { text: string; tooltip: string; color: string; warning: boolean }

/**
 * Nội dung mục thanh trạng thái. Thuần, không import vscode.
 * `override`: giá trị `CLAUDE_CONFIG_DIR` trong thiết lập `claudeCode.environmentVariables`, nếu có. Claude Code để nó
 * thắng hồ sơ của extension, nên khi có thì thanh trạng thái báo điều đó thay vì tên hồ sơ.
 * `usage`: quota Claude Code lưu lần gần nhất cho tài khoản này; có thì thêm vào tooltip.
 */
export function statusView(
  res: Resolution, email: string | undefined, perWindow: boolean, override?: string,
  usage?: AccountUsage, now: number = Date.now(),
): StatusView {
  const { profile, reason } = res;
  if (override !== undefined) {
    return {
      text: '$(warning) Claude: a setting is forcing the config folder',
      tooltip: `\`claudeCode.environmentVariables\` sets \`CLAUDE_CONFIG_DIR\` = ${escapeMarkdown(override)}; Claude Accounts cannot switch accounts.`,
      color: profile.color,
      warning: true,
    };
  }
  let text = `$(${profile.icon}) Claude: ${profile.name}`;
  if (reason === 'unbound') text += ' (not chosen)';
  if (reason === 'missing-profile') text = `$(warning) Claude: profile missing, using ${profile.name}`;

  let tooltip = escapeMarkdown(email ?? 'Not signed in');
  if (!perWindow) tooltip += ' · applies to all windows';
  if (usage !== undefined) tooltip += `\n\n${usageTable(usage, now)}`;

  const warning = email === undefined || reason === 'unbound' || reason === 'missing-profile';
  return { text, tooltip, color: profile.color, warning };
}

/**
 * Bảng quota (Markdown): mỗi hạn mức một hàng để các cột thẳng hàng (tooltip dùng font không đều nên không căn bằng
 * khoảng trắng được), rồi dòng cho biết số liệu lấy lúc nào (đây là bản lưu, không phải số trực tiếp).
 */
export function usageTable(usage: AccountUsage, now: number): string {
  const rows = usage.limits.map((l) => {
    let resets = '';
    if (l.resetsAt !== undefined) resets = l.resetsAt > now ? `in ${duration(l.resetsAt - now)}` : 'since last update';
    return `| ${escapeMarkdown(l.label)} | ${quotaBar(l.percent)} | ${Math.round(l.percent)}% | ${resets} |`;
  });
  const age = now - usage.fetchedAt;
  const updated = age < 60_000 ? 'Updated just now' : `Updated ${duration(age)} ago`;
  return ['| Quota | | Used | Resets |', '|:--|:--|--:|:--|', ...rows, '', updated].join('\n');
}

export const REFRESH_QUOTA_COMMAND = 'claudeAccounts.refreshQuota';

/**
 * Dòng cuối tooltip: VS Code không báo khi rê chuột lên mục thanh trạng thái, nên quota được lấy lại ngầm, và tooltip có
 * link để lấy ngay. Cần `MarkdownString` cho phép lệnh này và bật `supportThemeIcons`.
 */
export function refreshLine(running: boolean): string {
  return running ? '$(sync~spin) Refreshing quota…' : `[$(refresh) Refresh quota](command:${REFRESH_QUOTA_COMMAND})`;
}

/** Thoát ký tự Markdown như `MarkdownString.appendText` của VS Code, để email hay đường dẫn hiện đúng nguyên văn. */
function escapeMarkdown(text: string): string {
  return text.replace(/[\\`*_{}[\]()#+\-!~|<>]/g, '\\$&');
}

export function quotaBar(percent: number): string {
  const filled = Math.min(10, Math.max(0, Math.round(percent / 10)));
  return '▰'.repeat(filled) + '▱'.repeat(10 - filled);
}

/** Khoảng thời gian ngắn gọn: "45m", "1h 10m", "5d 3h". */
export function duration(ms: number): string {
  const minutes = Math.max(1, Math.floor(ms / 60_000));
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return minutes % 60 ? `${hours}h ${minutes % 60}m` : `${hours}h`;
  const days = Math.floor(hours / 24);
  return hours % 24 ? `${days}d ${hours % 24}h` : `${days}d`;
}
