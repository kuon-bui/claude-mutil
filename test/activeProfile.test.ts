import { expect, test } from 'vitest';
import { resolveActiveProfile } from '../src/activeProfile';
import { BindingStore } from '../src/bindingStore';
import { ProfileStore } from '../src/profileStore';
import { memoryStore } from './helpers/memoryStore';

const HOME = '/home/a';
const allDirsExist = () => true;

function setup() {
  const mem = memoryStore();
  return { profiles: new ProfileStore(mem, HOME), bindings: new BindingStore(mem, 'linux') };
}

test('thư mục đã gắn → hồ sơ đó, reason bound', async () => {
  const { profiles, bindings } = setup();
  const a = await profiles.add('Công ty A');
  await bindings.set('/du-an/web', a.id);
  const r = resolveActiveProfile(['/du-an/web'], profiles, bindings, allDirsExist);
  expect(r.profile.id).toBe(a.id);
  expect(r.reason).toBe('bound');
});

test('thư mục gắn với chính hồ sơ Mặc định → default, reason bound', async () => {
  const { profiles, bindings } = setup();
  await profiles.add('Công ty A');
  await bindings.set('/du-an/web', 'default');
  const r = resolveActiveProfile(['/du-an/web'], profiles, bindings, () => false);
  expect(r.profile.id).toBe('default');
  expect(r.reason).toBe('bound');
});

test('nhiều thư mục gốc → xét thư mục đầu tiên', async () => {
  const { profiles, bindings } = setup();
  const a = await profiles.add('Công ty A');
  const b = await profiles.add('Khách B');
  await bindings.set('/first', a.id);
  await bindings.set('/second', b.id);
  const r = resolveActiveProfile(['/first', '/second'], profiles, bindings, allDirsExist);
  expect(r.profile.id).toBe(a.id);
  expect(r.reason).toBe('bound');
});

test('nhiều thư mục gốc, thư mục đầu chưa gắn → unbound dù thư mục sau đã gắn', async () => {
  const { profiles, bindings } = setup();
  const b = await profiles.add('Khách B');
  await bindings.set('/second', b.id);
  const r = resolveActiveProfile(['/first', '/second'], profiles, bindings, allDirsExist);
  expect(r.profile.id).toBe('default');
  expect(r.reason).toBe('unbound');
});

test('chỉ có hồ sơ Mặc định → default, reason default-only', () => {
  const { profiles, bindings } = setup();
  const r = resolveActiveProfile(['/du-an/web'], profiles, bindings, allDirsExist);
  expect(r.profile.id).toBe('default');
  expect(r.reason).toBe('default-only');
});

test('không mở thư mục nào → default, reason no-folder', async () => {
  const { profiles, bindings } = setup();
  await profiles.add('Công ty A');
  const r = resolveActiveProfile([], profiles, bindings, allDirsExist);
  expect(r.profile.id).toBe('default');
  expect(r.reason).toBe('no-folder');
});

test('có hồ sơ khác nhưng thư mục chưa gắn → default, reason unbound', async () => {
  const { profiles, bindings } = setup();
  await profiles.add('Công ty A');
  const r = resolveActiveProfile(['/du-an/web'], profiles, bindings, allDirsExist);
  expect(r.profile.id).toBe('default');
  expect(r.reason).toBe('unbound');
});

test('gắn với hồ sơ đã bị xoá khỏi kho → default, reason missing-profile', async () => {
  const { profiles, bindings } = setup();
  const a = await profiles.add('Công ty A');
  await bindings.set('/du-an/web', a.id);
  await profiles.remove(a.id);
  const r = resolveActiveProfile(['/du-an/web'], profiles, bindings, allDirsExist);
  expect(r.profile.id).toBe('default');
  expect(r.reason).toBe('missing-profile');
});

test('gắn với hồ sơ có thư mục không còn trên đĩa → default, reason missing-profile', async () => {
  const { profiles, bindings } = setup();
  const a = await profiles.add('Công ty A');
  await bindings.set('/du-an/web', a.id);
  const asked: string[] = [];
  const r = resolveActiveProfile(['/du-an/web'], profiles, bindings, (dir) => { asked.push(dir); return false; });
  expect(r.profile.id).toBe('default');
  expect(r.reason).toBe('missing-profile');
  expect(asked).toEqual([a.configDir]);
});
