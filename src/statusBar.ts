import type { Resolution } from './activeProfile';

export interface StatusView { text: string; tooltip: string; color: string; warning: boolean }

/** Nội dung mục thanh trạng thái. Thuần, không import vscode. */
export function statusView(res: Resolution, email: string | undefined, perWindow: boolean): StatusView {
  const { profile, reason } = res;
  let text = `$(account) Claude: ${profile.name}`;
  if (reason === 'unbound') text += ' (chưa chọn)';
  if (reason === 'missing-profile') text = `$(warning) Claude: thiếu hồ sơ, đang dùng ${profile.name}`;

  let tooltip = email ?? 'Chưa đăng nhập';
  if (!perWindow) tooltip += ' · áp dụng cho mọi cửa sổ';

  const warning = email === undefined || reason === 'unbound' || reason === 'missing-profile';
  return { text, tooltip, color: profile.color, warning };
}
