import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, expect, test } from 'vitest';
import { accountKind, readAccountEmail, readAccountInfo } from '../src/accountInfo';
import type { Profile } from '../src/profileStore';

let home: string;
let dir: string;
let p: Profile;

beforeEach(async () => {
  home = await fs.mkdtemp(path.join(os.tmpdir(), 'Nguyễn Văn A '));
  dir = path.join(home, '.claude-profiles', 'x1');
  await fs.mkdir(dir, { recursive: true });
  p = { id: 'x1', name: 'Công ty A', color: 'charts.green', icon: 'account', configDir: dir, isDefault: false };
});
afterEach(async () => {
  await fs.rm(home, { recursive: true, force: true });
});

const claudeJson = (email: unknown) => JSON.stringify({
  numStartups: 3,
  oauthAccount: { accountUuid: 'u', emailAddress: email, organizationName: 'Org', organizationType: 'claude_team' },
});

test('accountKind: Pro, Team, chuỗi khác, thiếu', () => {
  expect(accountKind({ organizationType: 'claude_pro' })).toEqual({ label: 'Pro' });
  expect(accountKind({ organizationType: 'claude_team', organizationName: 'Godgroup' }))
    .toEqual({ label: 'Team', organization: 'Godgroup' });
  expect(accountKind({ organizationType: 'enterprise' })).toEqual({ label: 'enterprise' });
  expect(accountKind(undefined)).toEqual({ label: 'Unknown' });
  expect(accountKind({ organizationType: 1, organizationName: 'X' })).toEqual({ label: 'Unknown' });
});

test('readAccountInfo: kind từ oauthAccount, không có file thì Unknown', async () => {
  await fs.writeFile(path.join(dir, '.claude.json'), claudeJson('a@x.com'));
  const info = await readAccountInfo(p, home);
  expect(info.kind).toEqual({ label: 'Team', organization: 'Org' });
  expect((await readAccountInfo({ ...p, configDir: path.join(dir, 'missing') }, home)).kind).toEqual({ label: 'Unknown' });
});

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

const withUsage = (accountUuid: string, utilization: Record<string, unknown>) => JSON.stringify({
  oauthAccount: { accountUuid: 'u', emailAddress: 'a@x.com' },
  cachedUsageUtilization: { fetchedAtMs: 1000, accountUuid, utilization },
});

test('quota: đọc danh sách limits trong cachedUsageUtilization', async () => {
  await fs.writeFile(path.join(dir, '.claude.json'), withUsage('u', {
    five_hour: { utilization: 99, resets_at: '2026-11-16T05:30:00+00:00' },
    limits: [
      { kind: 'session', percent: 40, resets_at: '2026-11-16T05:30:00.917973+00:00' },
      { kind: 'weekly_all', percent: 7, resets_at: '2026-11-21T08:00:00+00:00' },
      { kind: 'weekly_scoped', percent: 0, resets_at: null, scope: { model: { id: null, display_name: 'Fable' } } },
      { kind: 'weekly_all', percent: null },
    ],
  }));
  expect(await readAccountInfo(p, home)).toEqual({
    email: 'a@x.com',
    kind: { label: 'Unknown' },
    usage: {
      fetchedAt: 1000,
      limits: [
        { label: 'Session (5h)', percent: 40, resetsAt: Date.parse('2026-11-16T05:30:00.917Z') },
        { label: 'Weekly', percent: 7, resetsAt: Date.parse('2026-11-21T08:00:00Z') },
        { label: 'Weekly (Fable)', percent: 0, resetsAt: undefined },
      ],
    },
  });
});

test('quota: bản cũ không có limits thì đọc five_hour, seven_day', async () => {
  await fs.writeFile(path.join(dir, '.claude.json'), withUsage('u', {
    five_hour: { utilization: 12, resets_at: '2026-11-16T05:30:00+00:00' },
    seven_day: { utilization: 3, resets_at: null },
    seven_day_opus: null,
  }));
  expect((await readAccountInfo(p, home)).usage?.limits).toEqual([
    { label: 'Session (5h)', percent: 12, resetsAt: Date.parse('2026-11-16T05:30:00Z') },
    { label: 'Weekly', percent: 3, resetsAt: undefined },
  ]);
});

test('quota: bản lưu của tài khoản khác, thiếu hoặc hỏng thì bỏ qua, email vẫn đọc được', async () => {
  await fs.writeFile(path.join(dir, '.claude.json'), withUsage('khac', { limits: [{ kind: 'session', percent: 40 }] }));
  expect(await readAccountInfo(p, home)).toEqual({ email: 'a@x.com', usage: undefined, kind: { label: 'Unknown' } });
  await fs.writeFile(path.join(dir, '.claude.json'), claudeJson('a@x.com'));
  expect(await readAccountInfo(p, home)).toEqual({
    email: 'a@x.com', usage: undefined, kind: { label: 'Team', organization: 'Org' },
  });
  await fs.writeFile(path.join(dir, '.claude.json'), withUsage('u', { limits: 'hỏng' }));
  expect((await readAccountInfo(p, home)).usage).toBeUndefined();
});
