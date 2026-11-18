import { expect, test, vi } from 'vitest';
import type { App } from '../src/app';
import type { Profile } from '../src/profileStore';

vi.mock('vscode', () => ({
  window: {
    showInformationMessage: vi.fn(async () => undefined),
    showWarningMessage: vi.fn(async () => undefined),
    showErrorMessage: vi.fn(async () => undefined),
    showInputBox: vi.fn(),
    withProgress: vi.fn(),
    createTerminal: vi.fn(),
  },
  ProgressLocation: { Notification: 15 },
  extensions: { getExtension: () => undefined },
}));

import { refreshThenLogin, reportLogin } from '../src/addAccount';
import type { LoginResult } from '../src/login';

const profile: Profile = {
  id: 'a1', name: 'Work', color: 'charts.green', icon: 'account',
  configDir: '/h/.claude-profiles/a1', isDefault: false,
};

function fakeApp() {
  let renders = 0;
  const app = {
    home: '/h',
    folders: () => [],
    resolution: { profile: { id: 'default' } },
    render: async () => { renders++; },
    selectProfile: async () => {},
  } as unknown as App;
  return { app, count: () => renders };
}

test('reportLogin timeout still refreshes the Accounts panel', async () => {
  const { app, count } = fakeApp();
  await reportLogin(app, profile, 'timeout');
  expect(count()).toBeGreaterThan(0);
});

test('reportLogin failed still refreshes the Accounts panel', async () => {
  const { app, count } = fakeApp();
  await reportLogin(app, profile, 'failed');
  expect(count()).toBeGreaterThan(0);
});

test('refreshThenLogin renders before waiting for login', async () => {
  const order: string[] = [];
  const app = { render: async () => { order.push('render'); } };
  let finish!: (result: LoginResult) => void;
  const login = () => {
    order.push('login');
    return new Promise<LoginResult>((resolve) => { finish = resolve; });
  };
  const p = refreshThenLogin(app, login, async (result) => { order.push(result); });
  await Promise.resolve();
  expect(order).toEqual(['render', 'login']);
  finish('timeout');
  await p;
  expect(order).toEqual(['render', 'login', 'timeout']);
});
