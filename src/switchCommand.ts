import * as vscode from 'vscode';
import { readAccountEmail } from './accountInfo';
import type { App } from './app';
import type { Profile } from './profileStore';

type Item = vscode.QuickPickItem & { profile?: Profile; command?: string };

/** Danh sách chọn nhanh: mỗi hồ sơ một dòng, rồi "Thêm tài khoản…" và "Quản lý hồ sơ…". */
export async function runSwitch(app: App, options: { title?: string } = {}): Promise<void> {
  const activeId = app.resolution.profile.id;
  const profiles = app.profiles.list();
  const emails = await Promise.all(profiles.map((p) => readAccountEmail(p, app.home)));
  const items: Item[] = [
    ...profiles.map((profile, i): Item => ({
      label: `${profile.id === activeId ? '$(check) ' : ''}${profile.name}`,
      description: emails[i] ?? 'Chưa đăng nhập',
      profile,
    })),
    { label: '', kind: vscode.QuickPickItemKind.Separator },
    { label: '$(add) Thêm tài khoản…', command: 'claudeAccounts.add' },
    { label: '$(gear) Quản lý hồ sơ…', command: 'claudeAccounts.manage' },
  ];
  const picked = await vscode.window.showQuickPick(items, {
    title: options.title ?? 'Đổi tài khoản Claude',
    placeHolder: 'Chọn tài khoản cho cửa sổ này',
  });
  if (!picked) return;
  if (picked.command) await vscode.commands.executeCommand(picked.command);
  else if (picked.profile) await app.selectProfile(picked.profile);
}
