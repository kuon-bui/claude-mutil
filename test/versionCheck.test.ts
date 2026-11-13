import { expect, test } from 'vitest';
import { isSupported } from '../src/versionCheck';

test('isSupported so sánh từng phần số', () => {
  expect(isSupported('2.1.200', '2.1.193')).toBe(true);
  expect(isSupported('2.1.99', '2.1.193')).toBe(false);
  expect(isSupported(undefined, '2.1.193')).toBe(false);
});

test('bằng đúng bản tối thiểu thì được', () => {
  expect(isSupported('2.1.323', '2.1.323')).toBe(true);
});

test('phần lớn hơn thắng dù phần sau nhỏ hơn', () => {
  expect(isSupported('3.0.0', '2.1.323')).toBe(true);
  expect(isSupported('2.0.999', '2.1.0')).toBe(false);
});

test('hậu tố pre-release và số phần khác nhau', () => {
  expect(isSupported('2.1.324-beta.1', '2.1.323')).toBe(true);
  expect(isSupported('2.2', '2.1.323')).toBe(true);
  expect(isSupported('chuỗi lạ', '2.1.323')).toBe(false);
});
