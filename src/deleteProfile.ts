import type { BindingStore } from './bindingStore';
import { DEFAULT_PROFILE_ID, type ProfileStore } from './profileStore';

/**
 * Xoá hồ sơ theo thứ tự an toàn: thư mục trên đĩa trước, rồi các cặp gắn, cuối cùng mới xoá khỏi kho.
 * Xoá thư mục lỗi thì kho và cặp gắn còn nguyên, người dùng thử lại được.
 */
export async function deleteProfile(id: string, deps: {
  profiles: ProfileStore; bindings: BindingStore; root: string;
  removeDir: (dir: string, root: string) => Promise<void>;
}): Promise<void> {
  if (id === DEFAULT_PROFILE_ID) throw new Error('Không xoá được hồ sơ Mặc định.');
  const profile = deps.profiles.get(id);
  if (!profile) throw new Error(`Không có hồ sơ ${id}.`);
  await deps.removeDir(profile.configDir, deps.root);
  await deps.bindings.removeProfile(id);
  await deps.profiles.remove(id);
}
