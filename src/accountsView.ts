import type { AccountInfo } from './accountInfo';
import type { Profile } from './profileStore';
import { duration, quotaBar } from './statusBar';

export interface AccountsState {
  prompt?: string;
  override?: string;
  useLabel: string;
  /** Có hồ sơ đang lấy lại quota: nút Refresh quota tạm khoá. */
  refreshing: boolean;
  accounts: AccountRow[];
}

export interface AccountRow {
  id: string;
  name: string;
  email: string;
  kind: string;
  active: boolean;
  missing: boolean;
  missingHint?: string;
  refreshing: boolean;
  usage?: { limits: { label: string; percent: number; bar: string; resets?: string }[]; updated: string };
  actions: { use: boolean; rename: true; login: true; delete: boolean };
}

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
    row(profile, input.infos[i], input.activeId, input.dirExists, canUse, refreshing(profile.id), now));
  return {
    prompt: input.override === undefined && input.unbound ? 'Which Claude account should this project use?' : undefined,
    override: input.override,
    useLabel: input.hasFolder ? 'Use for This Project' : 'Use for This Window',
    refreshing: accounts.some((a) => a.refreshing),
    accounts,
  };
}

function row(
  profile: Profile, info: AccountInfo | undefined, activeId: string,
  dirExists: (dir: string) => boolean, canUse: boolean, refreshing: boolean, now: number,
): AccountRow {
  const missing = !profile.isDefault && !dirExists(profile.configDir);
  const kind = info?.kind.organization ? `${info.kind.label} · ${info.kind.organization}` : (info?.kind.label ?? 'Unknown');
  return {
    id: profile.id,
    name: profile.name,
    email: info?.email ?? 'Not signed in',
    kind,
    active: profile.id === activeId,
    missing,
    missingHint: missing ? MISSING_HINT : undefined,
    refreshing,
    usage: usageView(info?.usage, now),
    actions: { use: canUse, rename: true, login: true, delete: !profile.isDefault },
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
