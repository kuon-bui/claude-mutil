import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, expect, test } from 'vitest';
import { readAccountEmail } from '../src/accountInfo';
import type { Profile } from '../src/profileStore';

let home: string;
let dir: string;
let p: Profile;

beforeEach(async () => {
  home = await fs.mkdtemp(path.join(os.tmpdir(), 'Nguyễn Văn A '));
  dir = path.join(home, '.claude-profiles', 'x1');
  await fs.mkdir(dir, { recursive: true });
  p = { id: 'x1', name: 'Công ty A', color: 'charts.green', configDir: dir, isDefault: false };
});
afterEach(async () => {
  await fs.rm(home, { recursive: true, force: true });
});

const claudeJson = (email: unknown) => JSON.stringify({ numStartups: 3, oauthAccount: { accountUuid: 'u', emailAddress: email, organizationName: 'Org' } });

test('hồ sơ thường: đọc <configDir>/.claude.json', async () => {
  await fs.writeFile(path.join(dir, '.claude.json'), claudeJson('a@x.com'));
  expect(await readAccountEmail({ ...p, configDir: dir, isDefault: false }, home)).toBe('a@x.com');
});

test('hồ sơ Mặc định: đọc <home>/.claude.json, không đọc trong configDir', async () => {
  await fs.writeFile(path.join(home, '.claude.json'), claudeJson('me@x.com'));
  await fs.writeFile(path.join(dir, '.claude.json'), claudeJson('wrong@x.com'));
  expect(await readAccountEmail({ ...p, configDir: dir, isDefault: true }, home)).toBe('me@x.com');
});

test('hồ sơ Mặc định có envDir (CLAUDE_CONFIG_DIR ngoài VS Code): đọc <envDir>/.claude.json như Claude Code', async () => {
  await fs.writeFile(path.join(home, '.claude.json'), claudeJson('wrong@x.com'));
  await fs.writeFile(path.join(dir, '.claude.json'), claudeJson('custom@x.com'));
  expect(await readAccountEmail({ ...p, configDir: dir, isDefault: true, envDir: dir }, home)).toBe('custom@x.com');
});

test('thiếu file, JSON hỏng hoặc chưa đăng nhập đều trả về undefined', async () => {
  expect(await readAccountEmail({ ...p, configDir: dir, isDefault: false }, home)).toBeUndefined();
  await fs.writeFile(path.join(dir, '.claude.json'), '{hỏng');
  expect(await readAccountEmail({ ...p, configDir: dir, isDefault: false }, home)).toBeUndefined();
  await fs.writeFile(path.join(dir, '.claude.json'), JSON.stringify({ numStartups: 1 }));
  expect(await readAccountEmail({ ...p, configDir: dir, isDefault: false }, home)).toBeUndefined();
});

test('emailAddress rỗng hoặc không phải chuỗi trả về undefined', async () => {
  await fs.writeFile(path.join(dir, '.claude.json'), claudeJson(''));
  expect(await readAccountEmail(p, home)).toBeUndefined();
  await fs.writeFile(path.join(dir, '.claude.json'), claudeJson(42));
  expect(await readAccountEmail(p, home)).toBeUndefined();
});
