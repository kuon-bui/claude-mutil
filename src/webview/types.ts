export interface AccountsState {
  prompt?: string;
  override?: string;
  useLabel: string;
  refreshing: boolean;
  accounts: AccountRow[];
  icons: string[];
  colors: ColorOption[];
}

export interface ColorOption { id: string; css: string; label: string }

export interface AccountRow {
  id: string;
  name: string;
  icon: string;
  colorId: string;
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

export type PanelMessage =
  | { type: 'add' | 'ready' | 'refresh' }
  | { type: 'use' | 'rename' | 'login' | 'delete'; id: string }
  | { type: 'appearance'; id: string; icon?: string; color?: string };
