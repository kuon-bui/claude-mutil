import { expect, test } from 'vitest';
import { BindingStore } from '../src/bindingStore';
import { memoryStore } from './helpers/memoryStore';

test('get trả về hồ sơ đã gắn, khoá đã chuẩn hoá', async () => {
  const b = new BindingStore(memoryStore(), 'win32');
  await b.set('C:\\Du An\\Web', 'x1');
  expect(b.get('c:\\du an\\web\\')).toBe('x1');
});

test('thư mục chưa gắn trả về undefined', () => {
  expect(new BindingStore(memoryStore(), 'linux').get('/a')).toBeUndefined();
});

test('Linux phân biệt hoa thường', async () => {
  const b = new BindingStore(memoryStore(), 'linux');
  await b.set('/home/a/Web', 'x1');
  expect(b.get('/home/a/web')).toBeUndefined();
});

test('set lại cùng thư mục thì ghi đè hồ sơ cũ', async () => {
  const b = new BindingStore(memoryStore(), 'linux');
  await b.set('/a', 'x1');
  await b.set('/a/', 'x2');
  expect(b.get('/a')).toBe('x2');
});

test('removeProfile gỡ mọi thư mục đang gắn với hồ sơ đó', async () => {
  const b = new BindingStore(memoryStore(), 'linux');
  await b.set('/a', 'x1'); await b.set('/b', 'x2'); await b.set('/c', 'x1');
  await b.removeProfile('x1');
  expect(b.get('/a')).toBeUndefined();
  expect(b.get('/c')).toBeUndefined();
  expect(b.get('/b')).toBe('x2');
});

test('dữ liệu còn nguyên khi tạo lại BindingStore trên cùng kho', async () => {
  const mem = memoryStore();
  await new BindingStore(mem, 'linux').set('/a', 'x1');
  expect(new BindingStore(mem, 'linux').get('/a')).toBe('x1');
});
