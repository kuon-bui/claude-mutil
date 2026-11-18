import path from 'node:path';
import { expect, test } from 'vitest';
import { profileDir } from '../src/paths';
import { DuplicateNameError, EmptyNameError, PROFILE_COLORS, PROFILE_ICONS, ProfileStore } from '../src/profileStore';
import { memoryStore } from './helpers/memoryStore';

test('kho rỗng vẫn có hồ sơ Mặc định trỏ vào ~/.claude', () => {
  const s = new ProfileStore(memoryStore(), '/home/a');
  expect(s.list()).toEqual([{ id: 'default', name: 'Default', color: 'charts.blue', icon: 'account',
    configDir: path.join('/home/a', '.claude'), isDefault: true }]);
});

test('add gán icon xoay vòng theo số hồ sơ hiện có', async () => {
  const s = new ProfileStore(memoryStore(), '/home/a');
  expect((await s.add('A')).icon).toBe(PROFILE_ICONS[1]);
  expect((await s.add('B')).icon).toBe(PROFILE_ICONS[2]);
});

test('setAppearance đổi icon và màu của hồ sơ thường và hồ sơ Mặc định, giữ qua lần tạo lại kho', async () => {
  const mem = memoryStore();
  const s = new ProfileStore(mem, '/home/a');
  const a = await s.add('Công ty A');
  await s.setAppearance(a.id, { icon: 'rocket', color: 'charts.red' });
  await s.setAppearance('default', { icon: 'home', color: 'charts.purple' });
  const again = new ProfileStore(mem, '/home/a');
  expect(again.get(a.id)).toMatchObject({ icon: 'rocket', color: 'charts.red', name: 'Công ty A' });
  expect(again.get('default')).toMatchObject({ icon: 'home', color: 'charts.purple', isDefault: true });
});

test('setAppearance chỉ đổi phần được truyền', async () => {
  const s = new ProfileStore(memoryStore(), '/home/a');
  const a = await s.add('Công ty A');
  await s.setAppearance(a.id, { color: 'charts.yellow' });
  expect(s.get(a.id)).toMatchObject({ icon: a.icon, color: 'charts.yellow' });
  await s.setAppearance('default', { icon: 'zap' });
  expect(s.get('default')).toMatchObject({ icon: 'zap', color: PROFILE_COLORS[0] });
});

test('setAppearance từ chối icon lạ, màu lạ và hồ sơ không tồn tại', async () => {
  const s = new ProfileStore(memoryStore(), '/home/a');
  await expect(s.setAppearance('default', { icon: 'not-an-icon' })).rejects.toThrow();
  await expect(s.setAppearance('default', { color: 'editor.background' })).rejects.toThrow();
  await expect(s.setAppearance('nope', { icon: 'rocket' })).rejects.toThrow();
  expect(s.get('default')).toMatchObject({ icon: 'account', color: PROFILE_COLORS[0] });
});

test('hồ sơ lưu từ bản cũ (chưa có icon) dùng icon account', () => {
  const mem = memoryStore();
  void mem.update('claudeAccounts.profiles', { profiles: [{ id: 'ab12cd34', name: 'Cũ', color: 'charts.green' }] });
  expect(new ProfileStore(mem, '/home/a').get('ab12cd34')?.icon).toBe('account');
});

test('CLAUDE_CONFIG_DIR có sẵn ngoài VS Code: hồ sơ Mặc định dùng thư mục đó và giữ giá trị để đặt lại', () => {
  const s = new ProfileStore(memoryStore(), '/home/a', '/data/claude');
  const def = s.get('default')!;
  expect(def.configDir).toBe('/data/claude');
  expect(def.envDir).toBe('/data/claude');
});

test('không có CLAUDE_CONFIG_DIR ngoài VS Code: hồ sơ Mặc định không mang envDir', () => {
  expect(new ProfileStore(memoryStore(), '/home/a').get('default')!.envDir).toBeUndefined();
});

test('add tạo id 8 ký tự hex, configDir trong .claude-profiles, màu xoay vòng', async () => {
  const s = new ProfileStore(memoryStore(), '/home/a');
  const p = await s.add('Công ty A');
  expect(p.id).toMatch(/^[0-9a-f]{8}$/);
  expect(p.configDir).toBe(profileDir('/home/a', p.id));
  expect(p.color).toBe('charts.green');
  expect(p.isDefault).toBe(false);
});

test('màu tiếp theo theo số hồ sơ hiện có', async () => {
  const s = new ProfileStore(memoryStore(), '/home/a');
  await s.add('A');
  const b = await s.add('B');
  expect(b.color).toBe('charts.orange');
});

test('list giữ Mặc định đầu tiên, các hồ sơ khác theo thứ tự thêm', async () => {
  const s = new ProfileStore(memoryStore(), '/home/a');
  await s.add('Khách B');
  await s.add('Công ty A');
  expect(s.list().map((p) => p.name)).toEqual(['Default', 'Khách B', 'Công ty A']);
});

test('add lưu tên đã bỏ khoảng trắng đầu cuối', async () => {
  const s = new ProfileStore(memoryStore(), '/home/a');
  expect((await s.add('  Công ty A ')).name).toBe('Công ty A');
});

test('tên trùng (không phân biệt hoa thường, bỏ khoảng trắng đầu cuối) bị từ chối', async () => {
  const s = new ProfileStore(memoryStore(), '/home/a');
  await s.add('Công ty A');
  await expect(s.add('  công ty a ')).rejects.toBeInstanceOf(DuplicateNameError);
  await expect(s.add('default')).rejects.toBeInstanceOf(DuplicateNameError);
});

test('tên rỗng bị từ chối', async () => {
  await expect(new ProfileStore(memoryStore(), '/h').add('   ')).rejects.toBeInstanceOf(EmptyNameError);
});

test('không xoá và không đổi id được hồ sơ Mặc định; đổi tên thì được', async () => {
  const s = new ProfileStore(memoryStore(), '/home/a');
  await expect(s.remove('default')).rejects.toThrow();
  await s.rename('default', 'Cá nhân');
  expect(s.get('default')?.name).toBe('Cá nhân');
  expect(s.get('default')?.isDefault).toBe(true);
});

test('rename hồ sơ thường: tên mới được lưu, tên trùng hồ sơ khác bị từ chối', async () => {
  const s = new ProfileStore(memoryStore(), '/home/a');
  const a = await s.add('Công ty A');
  await s.add('Khách B');
  await s.rename(a.id, 'Công ty A2');
  expect(s.get(a.id)?.name).toBe('Công ty A2');
  await expect(s.rename(a.id, 'khách b')).rejects.toBeInstanceOf(DuplicateNameError);
  await expect(s.rename(a.id, ' ')).rejects.toBeInstanceOf(EmptyNameError);
});

test('rename chỉ đổi hoa thường của chính nó thì được', async () => {
  const s = new ProfileStore(memoryStore(), '/home/a');
  const a = await s.add('công ty a');
  await s.rename(a.id, 'Công ty A');
  expect(s.get(a.id)?.name).toBe('Công ty A');
});

test('remove gỡ hồ sơ khỏi danh sách', async () => {
  const s = new ProfileStore(memoryStore(), '/home/a');
  const a = await s.add('Công ty A');
  await s.remove(a.id);
  expect(s.get(a.id)).toBeUndefined();
  expect(s.list().map((p) => p.id)).toEqual(['default']);
});

test('dữ liệu còn nguyên khi tạo lại ProfileStore trên cùng kho', async () => {
  const mem = memoryStore();
  const p = await new ProfileStore(mem, '/home/a').add('Khách B');
  await new ProfileStore(mem, '/home/a').rename('default', 'Cá nhân');
  const again = new ProfileStore(mem, '/home/a');
  expect(again.get(p.id)?.name).toBe('Khách B');
  expect(again.get('default')?.name).toBe('Cá nhân');
});
