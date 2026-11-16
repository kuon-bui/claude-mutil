import { expect, test } from 'vitest';
import type { Profile } from '../src/profileStore';
import { switchItems } from '../src/switchItems';

const def: Profile = { id: 'default', name: 'Default', color: 'charts.blue', configDir: '/h/.claude', isDefault: true };
const a: Profile = { id: 'a1', name: 'Công ty A', color: 'charts.green', configDir: '/h/.claude-profiles/a1', isDefault: false };
const b: Profile = { id: 'b2', name: 'Khách B', color: 'charts.orange', configDir: '/h/.claude-profiles/b2', isDefault: false };

test('mỗi hồ sơ một dòng, dấu ✓ ở hồ sơ đang dùng, mô tả là email hoặc Chưa đăng nhập', () => {
  const items = switchItems([def, a], ['me@x.com', undefined], 'a1', () => true);
  expect(items).toEqual([
    { label: 'Default', description: 'me@x.com', profile: def },
    { label: '$(check) Công ty A', description: 'Not signed in', profile: a },
  ]);
});

test('hồ sơ mất thư mục: ghi rõ, kể cả khi đang dùng Mặc định vì thiếu hồ sơ đó', () => {
  const items = switchItems([def, a, b], ['me@x.com', 'a@x.com', 'b@x.com'], 'default', (dir) => dir !== b.configDir);
  expect(items[0].label).toBe('$(check) Default');
  expect(items[2]).toEqual({ label: '$(warning) Khách B', description: 'Profile folder missing: select to recreate it, then sign in again', profile: b });
});

test('hồ sơ Mặc định không bị coi là mất thư mục', () => {
  expect(switchItems([def], [undefined], 'default', () => false)[0].description).toBe('Not signed in');
});
