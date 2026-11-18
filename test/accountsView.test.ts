import { expect, test } from 'vitest';
import type { AccountInfo } from '../src/accountInfo';
import { accountsState } from '../src/accountsView';
import type { Profile } from '../src/profileStore';
import { duration, quotaBar } from '../src/statusBar';

const def: Profile = { id: 'default', name: 'Default', color: 'charts.blue', configDir: '/h/.claude', isDefault: true };
const a: Profile = { id: 'a1', name: 'Công ty A', color: 'charts.green', configDir: '/h/.claude-profiles/a1', isDefault: false };
const b: Profile = { id: 'b2', name: 'Khách B', color: 'charts.orange', configDir: '/h/.claude-profiles/b2', isDefault: false };

const now = Date.parse('2026-11-16T04:20:00Z');
const defInfo: AccountInfo = { email: 'me@x.com', kind: { label: 'Pro' } };
const aInfo: AccountInfo = {
  email: 'a@x.com',
  kind: { label: 'Team', organization: 'Godgroup' },
  usage: {
    fetchedAt: now - 12 * 60_000,
    limits: [
      { label: 'Session (5h)', percent: 40, resetsAt: now + 70 * 60_000 },
      { label: 'Weekly', percent: 7 },
    ],
  },
};
const bInfo: AccountInfo = { kind: { label: 'Unknown' } };

const base = {
  profiles: [def, a, b],
  infos: [defInfo, aInfo, bInfo],
  activeId: 'a1',
  dirExists: (dir: string) => dir !== b.configDir,
  unbound: true,
  hasFolder: false,
  now,
};

test('kind line, default no delete, missing still use, unbound prompt', () => {
  const state = accountsState(base);
  expect(state.useLabel).toBe('Use for This Window');
  expect(state.prompt).toBe('Which Claude account should this project use?');
  expect(state.override).toBeUndefined();

  expect(state.accounts[0]).toMatchObject({
    id: 'default', name: 'Default', email: 'me@x.com', kind: 'Pro',
    active: false, missing: false, actions: { use: true, rename: true, login: true, delete: false },
  });
  expect(state.accounts[0].missingHint).toBeUndefined();
  expect(state.accounts[0].usage).toBeUndefined();

  expect(state.accounts[1].kind).toBe('Team · Godgroup');
  expect(state.accounts[1].active).toBe(true);
  expect(state.accounts[1].actions.delete).toBe(true);

  expect(state.accounts[2]).toMatchObject({
    id: 'b2', missing: true, email: 'Not signed in',
    missingHint: 'Profile folder missing: select to recreate it, then sign in again',
    actions: { use: true, rename: true, login: true, delete: true },
  });
});

test('override disables use and sets banner', () => {
  const state = accountsState({ ...base, unbound: false, hasFolder: true, override: '/tmp/x' });
  expect(state.override).toBe('/tmp/x');
  expect(state.prompt).toBeUndefined();
  expect(state.useLabel).toBe('Use for This Project');
  expect(state.accounts.every((row) => row.actions.use === false)).toBe(true);
});

test('quota bars and reset copy match status bar', () => {
  const state = accountsState(base);
  expect(state.accounts[1].usage).toEqual({
    limits: [
      { label: 'Session (5h)', percent: 40, bar: quotaBar(40), resets: `in ${duration(70 * 60_000)}` },
      { label: 'Weekly', percent: 7, bar: quotaBar(7) },
    ],
    updated: `Updated ${duration(12 * 60_000)} ago`,
  });
  expect(duration(70 * 60_000)).toBe('1h 10m');
});

test('refreshing: hàng đang lấy quota và cờ chung cho nút Refresh', () => {
  expect(accountsState(base).refreshing).toBe(false);
  expect(accountsState(base).accounts.every((row) => row.refreshing === false)).toBe(true);
  const state = accountsState({ ...base, refreshing: (id: string) => id === 'a1' });
  expect(state.refreshing).toBe(true);
  expect(state.accounts.map((row) => row.refreshing)).toEqual([false, true, false]);
});
