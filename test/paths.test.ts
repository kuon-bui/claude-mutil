import path from 'node:path';
import { expect, test } from 'vitest';
import { defaultConfigDir, normalizeFolderKey, profileDir, profilesRoot } from '../src/paths';

test('defaultConfigDir là <home>/.claude', () => {
  expect(defaultConfigDir('/home/a')).toBe(path.join('/home/a', '.claude'));
});

test('profilesRoot là <home>/.claude-profiles', () => {
  expect(profilesRoot('/home/a')).toBe(path.join('/home/a', '.claude-profiles'));
});

test('profileDir nằm trong .claude-profiles', () => {
  expect(profileDir('/home/a', 'x1')).toBe(path.join('/home/a', '.claude-profiles', 'x1'));
});

test('normalizeFolderKey: Windows không phân biệt hoa thường và bỏ dấu gạch cuối', () => {
  expect(normalizeFolderKey('C:\\Du An\\Web\\', 'win32')).toBe('c:\\du an\\web');
});

test('normalizeFolderKey: Windows coi / và \\ như nhau', () => {
  expect(normalizeFolderKey('c:/Du An/Web', 'win32')).toBe('c:\\du an\\web');
});

test('normalizeFolderKey: Windows giữ gạch chéo của gốc ổ đĩa', () => {
  expect(normalizeFolderKey('C:\\', 'win32')).toBe('c:\\');
});

test('normalizeFolderKey: Linux giữ nguyên hoa thường', () => {
  expect(normalizeFolderKey('/home/a/Dự Án/', 'linux')).toBe('/home/a/Dự Án');
});

test('normalizeFolderKey: Linux giữ gốc /', () => {
  expect(normalizeFolderKey('/', 'linux')).toBe('/');
});

test('normalizeFolderKey: chuẩn hoá Unicode NFC (macOS trả tên tiếng Việt dạng NFD)', () => {
  const nfd = '/Users/a/Dự Án'.normalize('NFD');
  expect(normalizeFolderKey(nfd, 'darwin')).toBe('/Users/a/Dự Án'.normalize('NFC'));
});
