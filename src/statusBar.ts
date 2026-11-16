import type { Resolution } from './activeProfile';

export interface StatusView { text: string; tooltip: string; color: string; warning: boolean }

/**
 * Nội dung mục thanh trạng thái. Thuần, không import vscode.
 * `override`: giá trị `CLAUDE_CONFIG_DIR` trong thiết lập `claudeCode.environmentVariables`, nếu có. Claude Code để nó
 * thắng hồ sơ của extension, nên khi có thì thanh trạng thái báo điều đó thay vì tên hồ sơ.
 */
export function statusView(res: Resolution, email: string | undefined, perWindow: boolean, override?: string): StatusView {
  const { profile, reason } = res;
  if (override !== undefined) {
    return {
      text: '$(warning) Claude: a setting is forcing the config folder',
      tooltip: `claudeCode.environmentVariables sets CLAUDE_CONFIG_DIR = ${override}; Claude Accounts cannot switch accounts.`,
      color: profile.color,
      warning: true,
    };
  }
  let text = `$(account) Claude: ${profile.name}`;
  if (reason === 'unbound') text += ' (not chosen)';
  if (reason === 'missing-profile') text = `$(warning) Claude: profile missing, using ${profile.name}`;

  let tooltip = email ?? 'Not signed in';
  if (!perWindow) tooltip += ' · applies to all windows';

  const warning = email === undefined || reason === 'unbound' || reason === 'missing-profile';
  return { text, tooltip, color: profile.color, warning };
}
