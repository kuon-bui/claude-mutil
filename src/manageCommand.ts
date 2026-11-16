import * as vscode from 'vscode';
import { readAccountEmail } from './accountInfo';
import { loginWithProgress, reportLogin } from './addAccount';
import type { App } from './app';
import { deleteProfile } from './deleteProfile';
import { profilesRoot } from './paths';
import { DEFAULT_PROFILE_ID, type Profile } from './profileStore';
import { removeProfileDir } from './sharedLinks';

type ProfileItem = vscode.QuickPickItem & { profile: Profile };

async function pickProfile(app: App): Promise<Profile | undefined> {
  const profiles = app.profiles.list();
  const emails = await Promise.all(profiles.map((p) => readAccountEmail(p, app.home)));
  const picked = await vscode.window.showQuickPick<ProfileItem>(
    profiles.map((profile, i) => ({ label: profile.name, description: emails[i] ?? 'Chưa đăng nhập', profile })),
    { title: 'Quản lý hồ sơ Claude', placeHolder: 'Chọn hồ sơ' },
  );
  return picked?.profile;
}

async function rename(app: App, profile: Profile): Promise<void> {
  const name = await vscode.window.showInputBox({
    title: `Đổi tên hồ sơ ${profile.name}`,
    value: profile.name,
    validateInput: (value) => {
      try {
        app.profiles.validateName(value, profile.id);
        return undefined;
      } catch (err) {
        return (err as Error).message;
      }
    },
  });
  if (name === undefined) return;
  await app.profiles.rename(profile.id, name);
  app.resolution = app.resolve();
  await app.render();
}

async function remove(app: App, profile: Profile): Promise<void> {
  // Claude đang chạy bằng hồ sơ này trong cửa sổ này sẽ tiếp tục ghi vào thư mục của nó và tạo lại thư mục sau khi xoá.
  // Chuyển cửa sổ về Mặc định và tải lại trước, rồi mới xoá.
  if (app.resolution.profile.id === profile.id) {
    const fallback = app.profiles.get(DEFAULT_PROFILE_ID)!;
    const move = `Chuyển về ${fallback.name}`;
    const choice = await vscode.window.showWarningMessage(
      `Cửa sổ này đang dùng hồ sơ ${profile.name}. Chuyển cửa sổ về ${fallback.name} và tải lại trước, rồi mở lại Quản lý hồ sơ để xoá.`, move);
    if (choice === move) await app.selectProfile(fallback);
    return;
  }

  let detail = 'Đăng nhập của hồ sơ này sẽ bị xoá. Lịch sử hội thoại dùng chung được giữ lại.';
  if (process.platform === 'darwin') {
    detail += ' Mục đăng nhập trong Keychain không bị xoá; hãy đăng xuất trong Claude trước nếu muốn gỡ hẳn.';
  }
  const confirm = 'Xoá';
  const choice = await vscode.window.showWarningMessage(`Xoá hồ sơ ${profile.name}?`, { modal: true, detail }, confirm);
  if (choice !== confirm) return;

  try {
    await deleteProfile(profile.id, {
      profiles: app.profiles, bindings: app.bindings, root: profilesRoot(app.home), removeDir: removeProfileDir,
    });
  } catch (err) {
    // Xoá có thể đã gỡ liên kết trước khi lỗi: nối lại ngay để hồ sơ còn lại không tách lịch sử.
    await app.prepare(profile).catch(() => {});
    void vscode.window.showErrorMessage(
      `Không xoá được hồ sơ ${profile.name}: ${(err as Error).message}. Nếu Claude đang chạy bằng hồ sơ này, hãy đóng các cửa sổ đó rồi thử lại.`);
    return;
  }

  app.resolution = app.resolve();
  await app.render();
}

export async function runManage(app: App): Promise<void> {
  const profile = await pickProfile(app);
  if (!profile) return;
  const actions = ['Đổi tên', 'Đăng nhập lại', ...(profile.isDefault ? [] : ['Xoá'])];
  const action = await vscode.window.showQuickPick(actions, { title: `Hồ sơ ${profile.name}`, placeHolder: 'Chọn thao tác' });
  if (action === 'Đổi tên') await rename(app, profile);
  else if (action === 'Đăng nhập lại') await reportLogin(app, profile, await loginWithProgress(app, profile));
  else if (action === 'Xoá') await remove(app, profile);
}
