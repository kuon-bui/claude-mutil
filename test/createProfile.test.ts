import path from 'node:path';
import { expect, test, vi } from 'vitest';
import { createProfile } from '../src/createProfile';
import { ProfileStore } from '../src/profileStore';
import { memoryStore } from './helpers/memoryStore';

const root = path.join('/home/a', '.claude-profiles');

test('createProfile thêm hồ sơ rồi chuẩn bị thư mục của nó', async () => {
  const profiles = new ProfileStore(memoryStore(), '/home/a');
  const prepare = vi.fn(async () => {});
  const p = await createProfile('Công ty A', { profiles, prepare, removeDir: async () => {}, root });
  expect(profiles.get(p.id)?.name).toBe('Công ty A');
  expect(prepare).toHaveBeenCalledWith(p);
});

test('chuẩn bị thư mục lỗi thì gỡ hồ sơ khỏi kho, dọn thư mục dở và báo lỗi', async () => {
  const profiles = new ProfileStore(memoryStore(), '/home/a');
  const removed: string[] = [];
  const deps = {
    profiles, root,
    prepare: async () => { throw new Error('EPERM: junction'); },
    removeDir: async (dir: string) => { removed.push(dir); },
  };
  await expect(createProfile('Công ty A', deps)).rejects.toThrow('EPERM: junction');
  expect(profiles.list().map((p) => p.name)).toEqual(['Default']);
  expect(removed).toHaveLength(1);
  expect(removed[0].startsWith(root)).toBe(true);
});

test('tên không hợp lệ thì không tạo gì', async () => {
  const profiles = new ProfileStore(memoryStore(), '/home/a');
  const prepare = vi.fn(async () => {});
  await expect(createProfile('  ', { profiles, prepare, removeDir: async () => {}, root })).rejects.toThrow();
  expect(prepare).not.toHaveBeenCalled();
});
