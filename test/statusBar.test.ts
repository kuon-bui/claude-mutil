import { expect, test } from 'vitest';
import type { Reason } from '../src/activeProfile';
import type { Profile } from '../src/profileStore';
import { statusView } from '../src/statusBar';

const p = (name: string, color: string, isDefault = false): Profile =>
  ({ id: isDefault ? 'default' : 'x1', name, color, configDir: '/c', isDefault });
const def = p('Mặc định', 'charts.blue', true);
const res = (profile: Profile, reason: Reason) => ({ profile, reason });

test('hồ sơ đã gắn', () => {
  expect(statusView(res(p('Công ty A', 'charts.green'), 'bound'), 'a@x.com', true))
    .toEqual({ text: '$(account) Claude: Công ty A', tooltip: 'a@x.com', color: 'charts.green', warning: false });
});

test('chỉ có Mặc định hoặc không mở thư mục: không cảnh báo', () => {
  expect(statusView(res(def, 'default-only'), 'me@x.com', true))
    .toEqual({ text: '$(account) Claude: Mặc định', tooltip: 'me@x.com', color: 'charts.blue', warning: false });
  expect(statusView(res(def, 'no-folder'), 'me@x.com', true).warning).toBe(false);
});

test('chưa đăng nhập', () => {
  const v = statusView(res(p('Công ty A', 'charts.green'), 'bound'), undefined, true);
  expect(v.text).toBe('$(account) Claude: Công ty A');
  expect(v.tooltip).toBe('Chưa đăng nhập');
  expect(v.warning).toBe(true);
});

test('unbound', () => {
  const v = statusView(res(def, 'unbound'), 'me@x.com', true);
  expect(v.text).toBe('$(account) Claude: Mặc định (chưa chọn)');
  expect(v.tooltip).toBe('me@x.com');
  expect(v.warning).toBe(true);
});

test('unbound dùng tên đã đổi của hồ sơ Mặc định', () => {
  expect(statusView(res(p('Cá nhân', 'charts.blue', true), 'unbound'), 'me@x.com', true).text)
    .toBe('$(account) Claude: Cá nhân (chưa chọn)');
});

test('missing-profile', () => {
  const v = statusView(res(def, 'missing-profile'), 'me@x.com', true);
  expect(v.text).toBe('$(warning) Claude: thiếu hồ sơ, đang dùng Mặc định');
  expect(v.warning).toBe(true);
});

test('envSetting thêm ghi chú áp dụng cho mọi cửa sổ vào tooltip', () => {
  expect(statusView(res(p('Công ty A', 'charts.green'), 'bound'), 'a@x.com', false).tooltip)
    .toBe('a@x.com · áp dụng cho mọi cửa sổ');
});
