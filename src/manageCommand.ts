import * as vscode from 'vscode';
import type { App } from './app';
import { deleteProfile } from './deleteProfile';
import { profilesRoot } from './paths';
import { DEFAULT_PROFILE_ID, type Profile } from './profileStore';
import { removeProfileDir } from './sharedLinks';

export async function renameProfile(app: App, profile: Profile): Promise<void> {
  const name = await vscode.window.showInputBox({
    title: `Rename profile ${profile.name}`,
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

export async function removeProfile(app: App, profile: Profile): Promise<void> {
  // Claude đang chạy bằng hồ sơ này trong cửa sổ này sẽ tiếp tục ghi vào thư mục của nó và tạo lại thư mục sau khi xoá.
  // Chuyển cửa sổ về Mặc định và tải lại trước, rồi mới xoá.
  if (app.resolution.profile.id === profile.id) {
    const fallback = app.profiles.get(DEFAULT_PROFILE_ID)!;
    const move = `Switch to ${fallback.name}`;
    const choice = await vscode.window.showWarningMessage(
      `This window is using profile ${profile.name}. Switch this window to ${fallback.name} and reload first, then open Manage Profiles again to delete it.`, move);
    if (choice === move) await app.selectProfile(fallback);
    return;
  }

  let detail = 'This profile\'s sign-in will be deleted. Shared conversation history is kept.';
  if (process.platform === 'darwin') {
    detail += ' The sign-in entry in Keychain is not removed; sign out in Claude first if you want it gone completely.';
  }
  const confirm = 'Delete';
  const choice = await vscode.window.showWarningMessage(`Delete profile ${profile.name}?`, { modal: true, detail }, confirm);
  if (choice !== confirm) return;

  try {
    await deleteProfile(profile.id, {
      profiles: app.profiles, bindings: app.bindings, root: profilesRoot(app.home), removeDir: removeProfileDir,
    });
  } catch (err) {
    // Xoá có thể đã gỡ liên kết trước khi lỗi: nối lại ngay để hồ sơ còn lại không tách lịch sử.
    await app.prepare(profile).catch(() => {});
    void vscode.window.showErrorMessage(
      `Could not delete profile ${profile.name}: ${(err as Error).message}. If Claude is running with this profile, close those windows and try again.`);
    return;
  }

  app.resolution = app.resolve();
  await app.render();
}

