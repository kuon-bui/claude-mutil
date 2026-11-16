import type { Profile, ProfileStore } from './profileStore';

/**
 * Thêm hồ sơ rồi chuẩn bị thư mục của nó. Chuẩn bị lỗi (ví dụ ổ đĩa không tạo được junction) thì gỡ hồ sơ khỏi kho và
 * dọn thư mục dở, để không còn hồ sơ nửa vời trong danh sách.
 */
export async function createProfile(name: string, deps: {
  profiles: ProfileStore; root: string;
  prepare: (profile: Profile) => Promise<void>;
  removeDir: (dir: string, root: string) => Promise<void>;
}): Promise<Profile> {
  const profile = await deps.profiles.add(name);
  try {
    await deps.prepare(profile);
  } catch (err) {
    await deps.removeDir(profile.configDir, deps.root).catch(() => {});
    await deps.profiles.remove(profile.id);
    throw err;
  }
  return profile;
}
