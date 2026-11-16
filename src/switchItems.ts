import type { Profile } from './profileStore';

export interface SwitchItem { label: string; description: string; profile: Profile }

/**
 * Các dòng hồ sơ trong danh sách Đổi tài khoản. Thuần, không import vscode.
 * Hồ sơ mất thư mục được ghi rõ; chọn nó sẽ tạo lại thư mục (App.prepare) và người dùng cần đăng nhập lại.
 */
export function switchItems(
  profiles: Profile[], emails: (string | undefined)[], activeId: string, dirExists: (dir: string) => boolean,
): SwitchItem[] {
  return profiles.map((profile, i) => {
    const missing = !profile.isDefault && !dirExists(profile.configDir);
    const mark = profile.id === activeId ? '$(check) ' : missing ? '$(warning) ' : '';
    const description = missing ? 'Profile folder missing: select to recreate it, then sign in again' : emails[i] ?? 'Not signed in';
    return { label: `${mark}${profile.name}`, description, profile };
  });
}
