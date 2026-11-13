import { expect, test, vi } from 'vitest';
import { BindingStore } from '../src/bindingStore';
import { deleteProfile } from '../src/deleteProfile';
import { ProfileStore } from '../src/profileStore';
import { memoryStore } from './helpers/memoryStore';

async function setup() {
  const mem = memoryStore();
  const profiles = new ProfileStore(mem, '/home/a');
  const bindings = new BindingStore(mem, 'linux');
  const a = await profiles.add('Công ty A');
  await bindings.set('/du-an/web', a.id);
  return { profiles, bindings, a, root: '/home/a/.claude-profiles' };
}

test('deleteProfile xoá thư mục, gỡ cặp gắn rồi mới xoá khỏi kho', async () => {
  const { profiles, bindings, a, root } = await setup();
  const order: string[] = [];
  const removeDir = vi.fn(async (dir: string, r: string) => {
    order.push('removeDir');
    expect([dir, r]).toEqual([a.configDir, root]);
  });
  const origUnbind = bindings.removeProfile.bind(bindings);
  vi.spyOn(bindings, 'removeProfile').mockImplementation(async (id) => { order.push('unbind'); await origUnbind(id); });
  const origRemove = profiles.remove.bind(profiles);
  vi.spyOn(profiles, 'remove').mockImplementation(async (id) => { order.push('remove'); await origRemove(id); });

  await deleteProfile(a.id, { profiles, bindings, root, removeDir });

  expect(order).toEqual(['removeDir', 'unbind', 'remove']);
  expect(profiles.get(a.id)).toBeUndefined();
  expect(bindings.get('/du-an/web')).toBeUndefined();
});

test('removeDir lỗi thì hồ sơ vẫn còn trong kho và cặp gắn còn nguyên', async () => {
  const { profiles, bindings, a, root } = await setup();
  const removeDir = async () => { throw new Error('EBUSY'); };
  await expect(deleteProfile(a.id, { profiles, bindings, root, removeDir })).rejects.toThrow('EBUSY');
  expect(profiles.get(a.id)?.name).toBe('Công ty A');
  expect(bindings.get('/du-an/web')).toBe(a.id);
});

test('deleteProfile từ chối hồ sơ Mặc định và không đụng đĩa', async () => {
  const { profiles, bindings, root } = await setup();
  const removeDir = vi.fn(async () => {});
  await expect(deleteProfile('default', { profiles, bindings, root, removeDir })).rejects.toThrow();
  expect(removeDir).not.toHaveBeenCalled();
});

test('deleteProfile từ chối id không có trong kho và không đụng đĩa', async () => {
  const { profiles, bindings, root } = await setup();
  const removeDir = vi.fn(async () => {});
  await expect(deleteProfile('khong-co', { profiles, bindings, root, removeDir })).rejects.toThrow();
  expect(removeDir).not.toHaveBeenCalled();
});
