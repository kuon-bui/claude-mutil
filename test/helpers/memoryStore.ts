import type { KeyValueStore } from '../../src/store';

/**
 * `KeyValueStore` bằng `Map`. Giá trị được sao chép qua JSON khi ghi và đọc,
 * giống `globalState` thật (lưu dạng JSON), để test bắt được lỗi giữ tham chiếu sống.
 */
export function memoryStore(): KeyValueStore {
  const data = new Map<string, string>();
  return {
    get<T>(key: string): T | undefined {
      const raw = data.get(key);
      return raw === undefined ? undefined : (JSON.parse(raw) as T);
    },
    async update(key: string, value: unknown): Promise<void> {
      if (value === undefined) data.delete(key);
      else data.set(key, JSON.stringify(value));
    },
  };
}
