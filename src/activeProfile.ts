import type { BindingStore } from './bindingStore';
import { DEFAULT_PROFILE_ID, type Profile, type ProfileStore } from './profileStore';

export type Reason = 'bound' | 'default-only' | 'no-folder' | 'unbound' | 'missing-profile';
export interface Resolution { profile: Profile; reason: Reason }

/**
 * Hồ sơ dùng cho một cửa sổ, theo thư mục gốc đầu tiên. Mọi trường hợp không dùng được hồ sơ đã gắn
 * đều rơi về Mặc định, kèm lý do để thanh trạng thái báo đúng (không lặng lẽ chạy bằng Mặc định).
 */
export function resolveActiveProfile(
  folders: readonly string[], profiles: ProfileStore, bindings: BindingStore,
  dirExists: (dir: string) => boolean,
): Resolution {
  const fallback = profiles.get(DEFAULT_PROFILE_ID)!;
  const folder = folders[0];
  if (folder === undefined) return { profile: fallback, reason: 'no-folder' };

  const boundId = bindings.get(folder);
  if (boundId !== undefined) {
    const bound = profiles.get(boundId);
    if (bound && (bound.isDefault || dirExists(bound.configDir))) return { profile: bound, reason: 'bound' };
    return { profile: fallback, reason: 'missing-profile' };
  }
  return { profile: fallback, reason: profiles.list().length === 1 ? 'default-only' : 'unbound' };
}
