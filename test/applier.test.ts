import { expect, test } from 'vitest';
import { configDirOverride, createApplier, type ApplierDeps, type ConfigAccess } from '../src/applier';
import type { Profile } from '../src/profileStore';

function fakeConfig(values: Record<string, unknown> = {}): ConfigAccess {
  return {
    get: <T>(key: string) => values[key] as T | undefined,
    updateGlobal: async () => { throw new Error('processEnv không được ghi thiết lập'); },
  };
}
const deps = (env: NodeJS.ProcessEnv): ApplierDeps => ({ env, config: fakeConfig(), extensionPath: '/ext', platform: 'linux' });
const profile = (configDir: string): Profile => ({ id: 'x1', name: 'Công ty A', color: 'charts.green', icon: 'account', configDir, isDefault: false });
const defaultProfile: Profile = { id: 'default', name: 'Default', color: 'charts.blue', icon: 'account', configDir: '/h/.claude', isDefault: true };

test('hồ sơ thường đặt CLAUDE_CONFIG_DIR', async () => {
  const env: NodeJS.ProcessEnv = {};
  await createApplier(deps(env)).apply(profile('/h/Nguyễn Văn A/.claude-profiles/x1'));
  expect(env.CLAUDE_CONFIG_DIR).toBe('/h/Nguyễn Văn A/.claude-profiles/x1');
});

test('hồ sơ Mặc định xoá CLAUDE_CONFIG_DIR', async () => {
  const env: NodeJS.ProcessEnv = { CLAUDE_CONFIG_DIR: '/cũ' };
  await createApplier(deps(env)).apply(defaultProfile);
  expect('CLAUDE_CONFIG_DIR' in env).toBe(false);
});

test('hồ sơ Mặc định có envDir (CLAUDE_CONFIG_DIR có sẵn ngoài VS Code) thì đặt lại đúng giá trị đó, không xoá', async () => {
  const env: NodeJS.ProcessEnv = { CLAUDE_CONFIG_DIR: '/p/x1' };
  await createApplier(deps(env)).apply({ ...defaultProfile, configDir: '/data/claude', envDir: '/data/claude' });
  expect(env.CLAUDE_CONFIG_DIR).toBe('/data/claude');
});

test('biến môi trường được đặt ngay khi gọi apply, trước khi chờ promise', () => {
  const env: NodeJS.ProcessEnv = {};
  void createApplier(deps(env)).apply(profile('/p/x1'));
  expect(env.CLAUDE_CONFIG_DIR).toBe('/p/x1');
});

test('processEnv áp dụng theo từng cửa sổ', () => {
  expect(createApplier(deps({})).perWindow).toBe(true);
});

test('configDirOverride: có CLAUDE_CONFIG_DIR tuyệt đối trong environmentVariables thì trả giá trị đó', () => {
  const config = fakeConfig({ environmentVariables: [
    { name: 'ANTHROPIC_MODEL', value: 'm' }, { name: 'CLAUDE_CONFIG_DIR', value: '/khác' }] });
  expect(configDirOverride(config, 'linux')).toBe('/khác');
});

test('configDirOverride: không có, rỗng hoặc không phải mảng/đối tượng thì undefined', () => {
  expect(configDirOverride(fakeConfig({ environmentVariables: [{ name: 'ANTHROPIC_MODEL', value: 'm' }] }), 'linux')).toBeUndefined();
  expect(configDirOverride(fakeConfig({}), 'linux')).toBeUndefined();
  expect(configDirOverride(fakeConfig({ environmentVariables: 'CLAUDE_CONFIG_DIR=/x' }), 'linux')).toBeUndefined();
});

test('configDirOverride: giá trị tương đối bị Claude Code bỏ qua nên không tính', () => {
  const config = fakeConfig({ environmentVariables: [{ name: 'CLAUDE_CONFIG_DIR', value: 'tuong-doi' }] });
  expect(configDirOverride(config, 'linux')).toBeUndefined();
});

test('configDirOverride: Windows không phân biệt hoa thường tên biến và cần ổ đĩa hoặc UNC', () => {
  expect(configDirOverride(fakeConfig({ environmentVariables: [{ name: 'claude_config_dir', value: 'D:\\cfg' }] }), 'win32')).toBe('D:\\cfg');
  expect(configDirOverride(fakeConfig({ environmentVariables: [{ name: 'claude_config_dir', value: '/cfg' }] }), 'linux')).toBeUndefined();
  expect(configDirOverride(fakeConfig({ environmentVariables: [{ name: 'CLAUDE_CONFIG_DIR', value: '\\cfg' }] }), 'win32')).toBeUndefined();
});

test('configDirOverride: dạng đối tượng { TÊN: giá trị } cũng được Claude Code chấp nhận', () => {
  expect(configDirOverride(fakeConfig({ environmentVariables: { CLAUDE_CONFIG_DIR: '/khác' } }), 'linux')).toBe('/khác');
});

test('configDirOverride: nhiều mục thì mục cuối thắng', () => {
  const config = fakeConfig({ environmentVariables: [
    { name: 'CLAUDE_CONFIG_DIR', value: '/một' }, { name: 'CLAUDE_CONFIG_DIR', value: '/hai' }] });
  expect(configDirOverride(config, 'linux')).toBe('/hai');
});
