import type { AccountInfo } from './accountInfo';
import { PROFILE_COLORS, PROFILE_ICONS, type Profile } from './profileStore';
import { duration, quotaBar } from './statusBar';

export interface AccountsState {
  prompt?: string;
  override?: string;
  /** Tooltip của nút Use: dùng cho project hay cho cửa sổ. */
  useTitle: string;
  /** Có hồ sơ đang lấy lại quota: nút Refresh quota tạm khoá. */
  refreshing: boolean;
  accounts: AccountRow[];
  /** Các icon và màu chọn được trong khung Appearance. */
  icons: string[];
  colors: ColorOption[];
}

export interface ColorOption { id: string; css: string; label: string }

export interface AccountRow {
  id: string;
  name: string;
  /** Tên codicon cho avatar. */
  icon: string;
  /** Id `ThemeColor` của hồ sơ (để đánh dấu màu đang chọn). */
  colorId: string;
  /** Màu của hồ sơ dạng CSS (biến theme của VS Code), cho avatar. */
  color: string;
  email: string;
  kind: string;
  active: boolean;
  missing: boolean;
  missingHint?: string;
  refreshing: boolean;
  usage?: { limits: { label: string; percent: number; bar: string; resets?: string }[]; updated: string };
  actions: { use: boolean; rename: true; appearance: true; login: true; delete: boolean };
}

/** Id `ThemeColor` (vd. `charts.blue`) thành biến CSS mà VS Code đưa vào webview (`--vscode-charts-blue`). */
export function themeColorCss(id: string): string {
  return `var(--vscode-${id.replace(/\./g, '-')})`;
}

const COLOR_LABELS: Record<string, string> = {
  'charts.blue': 'Blue', 'charts.green': 'Green', 'charts.orange': 'Orange', 'charts.purple': 'Purple',
  'charts.red': 'Red', 'charts.yellow': 'Yellow', 'terminal.ansiCyan': 'Cyan', 'terminal.ansiBrightBlack': 'Gray',
};

const COLOR_OPTIONS: ColorOption[] = PROFILE_COLORS.map((id) => ({ id, css: themeColorCss(id), label: COLOR_LABELS[id] ?? id }));

const MISSING_HINT = 'Profile folder missing: select to recreate it, then sign in again';

export function accountsState(input: {
  profiles: Profile[];
  infos: AccountInfo[];
  activeId: string;
  dirExists: (dir: string) => boolean;
  unbound: boolean;
  hasFolder: boolean;
  override?: string;
  now?: number;
  /** Hồ sơ nào đang lấy lại quota. */
  refreshing?: (id: string) => boolean;
}): AccountsState {
  const now = input.now ?? Date.now();
  const canUse = input.override === undefined;
  const refreshing = input.refreshing ?? (() => false);
  const accounts = input.profiles.map((profile, i) =>
    row(profile, input.infos[i], input.activeId, input.dirExists, canUse, input.unbound, refreshing(profile.id), now));
  return {
    prompt: input.override === undefined && input.unbound ? 'Which Claude account should this project use?' : undefined,
    override: input.override,
    useTitle: input.hasFolder ? 'Use this account for this project' : 'Use this account for this window',
    refreshing: accounts.some((a) => a.refreshing),
    accounts,
    icons: [...PROFILE_ICONS],
    colors: COLOR_OPTIONS,
  };
}

function row(
  profile: Profile, info: AccountInfo | undefined, activeId: string,
  dirExists: (dir: string) => boolean, canUse: boolean, unbound: boolean, refreshing: boolean, now: number,
): AccountRow {
  const active = profile.id === activeId;
  const missing = !profile.isDefault && !dirExists(profile.configDir);
  const kind = info?.kind.organization ? `${info.kind.label} · ${info.kind.organization}` : (info?.kind.label ?? 'Unknown');
  return {
    id: profile.id,
    name: profile.name,
    icon: profile.icon,
    colorId: profile.color,
    color: themeColorCss(profile.color),
    email: info?.email ?? 'Not signed in',
    kind,
    active,
    missing,
    missingHint: missing ? MISSING_HINT : undefined,
    refreshing,
    usage: usageView(info?.usage, now),
    // Hồ sơ đang dùng không cần nút Use, trừ khi project chưa chọn hồ sơ (bấm để ghi lựa chọn).
    actions: { use: canUse && (!active || unbound), rename: true, appearance: true, login: true, delete: !profile.isDefault },
  };
}

function usageView(usage: AccountInfo['usage'], now: number): AccountRow['usage'] {
  if (usage === undefined) return undefined;
  const age = now - usage.fetchedAt;
  return {
    limits: usage.limits.map((l) => {
      const item: { label: string; percent: number; bar: string; resets?: string } = {
        label: l.label, percent: l.percent, bar: quotaBar(l.percent),
      };
      if (l.resetsAt !== undefined) item.resets = l.resetsAt > now ? `in ${duration(l.resetsAt - now)}` : 'since last update';
      return item;
    }),
    updated: age < 60_000 ? 'Updated just now' : `Updated ${duration(age)} ago`,
  };
}
