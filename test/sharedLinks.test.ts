import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, expect, test } from 'vitest';
import type { Profile } from '../src/profileStore';
import { linkShared, prepareProfileDir, removeProfileDir, unlinkShared } from '../src/sharedLinks';

// Mọi test chạy dưới thư mục có dấu cách và ký tự tiếng Việt, với process.platform thật (junction trên Windows).
let tmp: string;
let def: string;
let root: string;
let prof: string;

beforeEach(async () => {
  tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'cas-'));
  const home = path.join(tmp, 'Nguyễn Văn A');
  def = path.join(home, '.claude');
  root = path.join(home, '.claude-profiles');
  prof = path.join(root, 'x1');
  await fs.mkdir(def, { recursive: true });
  await fs.mkdir(prof, { recursive: true });
});
afterEach(async () => {
  // Gỡ liên kết trước để dọn dẹp không bao giờ đi xuyên vào dữ liệu thật.
  await unlinkShared(prof).catch(() => {});
  await fs.rm(tmp, { recursive: true, force: true });
});

const read = (p: string) => fs.readFile(p, 'utf8');
const exists = (p: string) => fs.lstat(p).then(() => true, () => false);

test('linkShared: ghi vào projects qua hồ sơ thì thấy ở thư mục mặc định', async () => {
  await fs.mkdir(path.join(def, 'projects'), { recursive: true });
  const r = await linkShared(def, prof, process.platform);
  await fs.writeFile(path.join(prof, 'projects', 's1.jsonl'), 'x');
  expect(await read(path.join(def, 'projects', 's1.jsonl'))).toBe('x');
  expect(r.linked.sort()).toEqual(['commands', 'plugins', 'projects', 'skills']);
});

test('linkShared: settings.json và CLAUDE.md được chép; sửa bản của hồ sơ không đổi bản mặc định', async () => {
  await fs.writeFile(path.join(def, 'settings.json'), '{"model":"opus"}');
  await fs.writeFile(path.join(def, 'CLAUDE.md'), '# chung');
  const r = await linkShared(def, prof, process.platform);
  expect(r.copied.sort()).toEqual(['CLAUDE.md', 'settings.json']);
  expect(await read(path.join(prof, 'settings.json'))).toBe('{"model":"opus"}');
  // Claude Code lưu bằng cách thay file; mô phỏng bằng xoá rồi ghi mới.
  await fs.rm(path.join(prof, 'settings.json'));
  await fs.writeFile(path.join(prof, 'settings.json'), '{"model":"haiku"}');
  expect(await read(path.join(def, 'settings.json'))).toBe('{"model":"opus"}');
});

test('linkShared: thư mục nguồn chưa có thì tạo rỗng rồi liên kết; file nguồn chưa có thì bỏ qua', async () => {
  const r = await linkShared(def, prof, process.platform);
  expect((await fs.stat(path.join(def, 'skills'))).isDirectory()).toBe(true);
  expect(r.linked).toContain('skills');
  expect(r.skipped).toContain('CLAUDE.md');
  expect(await exists(path.join(prof, 'CLAUDE.md'))).toBe(false);
});

test('linkShared: thư mục đã có sẵn và không phải liên kết thì giữ nguyên, báo skipped', async () => {
  await fs.mkdir(path.join(prof, 'plugins'), { recursive: true });
  await fs.writeFile(path.join(prof, 'plugins', 'keep.txt'), 'k');
  const r = await linkShared(def, prof, process.platform);
  expect(r.skipped).toContain('plugins');
  expect(r.linked).not.toContain('plugins');
  expect(await read(path.join(prof, 'plugins', 'keep.txt'))).toBe('k');
});

test('linkShared: settings.json đã có trong hồ sơ thì không bị ghi đè', async () => {
  await fs.writeFile(path.join(def, 'settings.json'), '{"model":"opus"}');
  await fs.writeFile(path.join(prof, 'settings.json'), '{"model":"haiku"}');
  const r = await linkShared(def, prof, process.platform);
  expect(r.skipped).toContain('settings.json');
  expect(await read(path.join(prof, 'settings.json'))).toBe('{"model":"haiku"}');
});

test('linkShared: thư mục hồ sơ chưa có thì được tạo', async () => {
  const fresh = path.join(root, 'moi');
  const r = await linkShared(def, fresh, process.platform);
  expect(r.linked).toContain('projects');
  await unlinkShared(fresh);
});

test('linkShared chạy hai lần không lỗi và vẫn báo các thư mục là đã liên kết', async () => {
  await fs.writeFile(path.join(def, 'settings.json'), '{}');
  await linkShared(def, prof, process.platform);
  const second = await linkShared(def, prof, process.platform);
  expect(second.linked.sort()).toEqual(['commands', 'plugins', 'projects', 'skills']);
  expect(second.copied).toEqual([]);
});

test('unlinkShared gỡ liên kết, giữ nguyên dữ liệu đích và các file thường trong hồ sơ', async () => {
  await fs.mkdir(path.join(def, 'projects'), { recursive: true });
  await fs.writeFile(path.join(def, 'projects', 'h.jsonl'), 'quan trọng');
  await fs.writeFile(path.join(def, 'settings.json'), '{}');
  await linkShared(def, prof, process.platform);
  await unlinkShared(prof);
  expect(await exists(path.join(prof, 'projects'))).toBe(false);
  expect(await exists(path.join(prof, 'settings.json'))).toBe(true);
  expect(await read(path.join(def, 'projects', 'h.jsonl'))).toBe('quan trọng');
});

const profileAt = (configDir: string, isDefault = false): Profile =>
  ({ id: isDefault ? 'default' : 'x1', name: 'Công ty A', color: 'charts.green', icon: 'account', configDir, isDefault });

test('prepareProfileDir: hồ sơ mất junction projects (xoá dở) thì được nối lại, lịch sử không tách', async () => {
  await fs.mkdir(path.join(def, 'projects'), { recursive: true });
  await linkShared(def, prof, process.platform);
  await unlinkShared(prof); // như removeProfileDir thất bại sau khi đã gỡ liên kết
  expect(await prepareProfileDir(profileAt(prof), def, process.platform)).toEqual([]);
  await fs.writeFile(path.join(prof, 'projects', 'moi.jsonl'), 'x');
  expect(await read(path.join(def, 'projects', 'moi.jsonl'))).toBe('x');
});

test('prepareProfileDir: thư mục hồ sơ bị xoá bên ngoài thì được tạo lại kèm liên kết', async () => {
  await fs.mkdir(path.join(def, 'projects'), { recursive: true });
  await fs.rm(prof, { recursive: true });
  expect(await prepareProfileDir(profileAt(prof), def, process.platform)).toEqual([]);
  expect((await fs.lstat(path.join(prof, 'projects'))).isSymbolicLink()).toBe(true);
});

test('prepareProfileDir: projects đã là thư mục thật thì báo lại để cảnh báo người dùng', async () => {
  await fs.mkdir(path.join(prof, 'projects'), { recursive: true });
  expect(await prepareProfileDir(profileAt(prof), def, process.platform)).toEqual(['projects']);
});

test('prepareProfileDir: hồ sơ Mặc định thì không làm gì', async () => {
  expect(await prepareProfileDir(profileAt(def, true), def, process.platform)).toEqual([]);
  expect(await exists(path.join(def, 'projects'))).toBe(false);
});

test('removeProfileDir xoá hồ sơ nhưng giữ nguyên dữ liệu dùng chung', async () => {
  await fs.mkdir(path.join(def, 'projects'), { recursive: true });
  await fs.writeFile(path.join(def, 'projects', 'history.jsonl'), 'quan trọng');
  await fs.mkdir(path.join(def, 'skills', 'my-skill'), { recursive: true });
  await fs.writeFile(path.join(def, 'skills', 'my-skill', 'SKILL.md'), 'kỹ năng');
  await fs.writeFile(path.join(def, 'settings.json'), '{"a":1}');
  await linkShared(def, prof, process.platform);
  await fs.writeFile(path.join(prof, '.credentials.json'), 'token');
  await removeProfileDir(prof, root);
  await expect(fs.stat(prof)).rejects.toThrow();
  expect(await read(path.join(def, 'projects', 'history.jsonl'))).toBe('quan trọng');
  expect(await read(path.join(def, 'skills', 'my-skill', 'SKILL.md'))).toBe('kỹ năng');
  expect(await read(path.join(def, 'settings.json'))).toBe('{"a":1}');
});

test('removeProfileDir không đi xuyên liên kết nằm sâu bên trong hồ sơ', async () => {
  await fs.mkdir(path.join(def, 'projects'), { recursive: true });
  await fs.writeFile(path.join(def, 'projects', 'history.jsonl'), 'quan trọng');
  await fs.mkdir(path.join(prof, 'backups'), { recursive: true });
  await fs.symlink(path.join(def, 'projects'), path.join(prof, 'backups', 'lối tắt'),
    process.platform === 'win32' ? 'junction' : 'dir');
  await removeProfileDir(prof, root);
  await expect(fs.stat(prof)).rejects.toThrow();
  expect(await read(path.join(def, 'projects', 'history.jsonl'))).toBe('quan trọng');
});

test('removeProfileDir từ chối đường dẫn ngoài root và chính root', async () => {
  await expect(removeProfileDir(def, root)).rejects.toThrow();
  await expect(removeProfileDir(root, root)).rejects.toThrow();
  await expect(removeProfileDir(path.join(root, '..', '.claude'), root)).rejects.toThrow();
  expect(await exists(def)).toBe(true);
  expect(await exists(root)).toBe(true);
});
