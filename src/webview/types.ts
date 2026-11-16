export interface AccountsState {
  prompt?: string;
  override?: string;
  useLabel: string;
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
  usage?: { limits: { label: string; percent: number; bar: string; resets?: string }[]; updated: string };
  actions: { use: boolean; rename: true; login: true; delete: boolean };
}

export type PanelMessage =
  | { type: 'add' | 'ready' }
  | { type: 'use' | 'rename' | 'login' | 'delete'; id: string };
