import { expect, test } from 'vitest';
import type { Reason } from '../src/activeProfile';
import type { Profile } from '../src/profileStore';
import { statusView } from '../src/statusBar';

const p = (name: string, color: string, isDefault = false): Profile =>
  ({ id: isDefault ? 'default' : 'x1', name, color, configDir: '/c', isDefault });
const def = p('Default', 'charts.blue', true);
const res = (profile: Profile, reason: Reason) => ({ profile, reason });

test('hồ sơ đã gắn', () => {
  expect(statusView(res(p('Công ty A', 'charts.green'), 'bound'), 'a@x.com', true))
    .toEqual({ text: '$(account) Claude: Công ty A', tooltip: 'a@x.com', color: 'charts.green', warning: false });
});

test('chỉ có Mặc định hoặc không mở thư mục: không cảnh báo', () => {
  expect(statusView(res(def, 'default-only'), 'me@x.com', true))
    .toEqual({ text: '$(account) Claude: Default', tooltip: 'me@x.com', color: 'charts.blue', warning: false });
  expect(statusView(res(def, 'no-folder'), 'me@x.com', true).warning).toBe(false);
});

test('chưa đăng nhập', () => {
  const v = statusView(res(p('Công ty A', 'charts.green'), 'bound'), undefined, true);
  expect(v.text).toBe('$(account) Claude: Công ty A');
  expect(v.tooltip).toBe('Not signed in');
  expect(v.warning).toBe(true);
});

test('unbound', () => {
  const v = statusView(res(def, 'unbound'), 'me@x.com', true);
  expect(v.text).toBe('$(account) Claude: Default (not chosen)');
  expect(v.tooltip).toBe('me@x.com');
  expect(v.warning).toBe(true);
});

test('unbound dùng tên đã đổi của hồ sơ Mặc định', () => {
  expect(statusView(res(p('Cá nhân', 'charts.blue', true), 'unbound'), 'me@x.com', true).text)
    .toBe('$(account) Claude: Cá nhân (not chosen)');
});

test('missing-profile', () => {
  const v = statusView(res(def, 'missing-profile'), 'me@x.com', true);
  expect(v.text).toBe('$(warning) Claude: profile missing, using Default');
  expect(v.warning).toBe(true);
});

test('envSetting thêm ghi chú áp dụng cho mọi cửa sổ vào tooltip', () => {
  expect(statusView(res(p('Công ty A', 'charts.green'), 'bound'), 'a@x.com', false).tooltip)
    .toBe('a@x.com · applies to all windows');
});

test('thiết lập claudeCode.environmentVariables đang ép CLAUDE_CONFIG_DIR: cảnh báo, nêu thư mục bị ép', () => {
  const v = statusView(res(p('Công ty A', 'charts.green'), 'bound'), 'a@x.com', true, 'D:\\khac');
  expect(v.text).toBe('$(warning) Claude: a setting is forcing the config folder');
  expect(v.tooltip).toBe('`claudeCode.environmentVariables` sets `CLAUDE_CONFIG_DIR` = D:\\\\khac; Claude Accounts cannot switch accounts.');
  expect(v.warning).toBe(true);
});

test('có quota: bảng hạn mức, thời gian đến lúc đặt lại và lúc cập nhật trong tooltip', () => {
  const now = Date.parse('2026-11-16T04:20:00Z');
  const usage = {
    fetchedAt: now - 12 * 60_000,
    limits: [
      { label: 'Session (5h)', percent: 40, resetsAt: now + 70 * 60_000 },
      { label: 'Weekly', percent: 7.4, resetsAt: now + (5 * 24 + 3) * 3_600_000 },
      { label: 'Weekly (Fable)', percent: 100 },
      { label: 'Old', percent: 55, resetsAt: now - 1 },
    ],
  };
  expect(statusView(res(def, 'bound'), 'me@x.com', false, undefined, usage, now).tooltip).toBe([
    'me@x.com · applies to all windows',
    '',
    '| Quota | | Used | Resets |',
    '|:--|:--|--:|:--|',
    '| Session \\(5h\\) | ▰▰▰▰▱▱▱▱▱▱ | 40% | in 1h 10m |',
    '| Weekly | ▰▱▱▱▱▱▱▱▱▱ | 7% | in 5d 3h |',
    '| Weekly \\(Fable\\) | ▰▰▰▰▰▰▰▰▰▰ | 100% |  |',
    '| Old | ▰▰▰▰▰▰▱▱▱▱ | 55% | since last update |',
    '',
    'Updated 12m ago',
  ].join('\n'));
});

test('quota vừa cập nhật; thiết lập đè thì tooltip không kèm quota', () => {
  const usage = { fetchedAt: 1000, limits: [{ label: 'Weekly', percent: 0, resetsAt: 1000 + 2 * 3_600_000 }] };
  expect(statusView(res(def, 'bound'), 'me@x.com', true, undefined, usage, 1000).tooltip)
    .toBe('me@x.com\n\n| Quota | | Used | Resets |\n|:--|:--|--:|:--|\n| Weekly | ▱▱▱▱▱▱▱▱▱▱ | 0% | in 2h |\n\nUpdated just now');
  expect(statusView(res(def, 'bound'), 'me@x.com', true, 'D:\\khac', usage, 1000).tooltip).not.toContain('Quota');
});

test('tooltip là Markdown: thoát ký tự đặc biệt trong email và đường dẫn', () => {
  expect(statusView(res(def, 'bound'), 'a_b-c@x.com', true).tooltip).toBe('a\\_b\\-c@x.com');
  expect(statusView(res(def, 'bound'), 'a@x.com', true, 'D:\\my_dir').tooltip).toContain('D:\\\\my\\_dir');
});
