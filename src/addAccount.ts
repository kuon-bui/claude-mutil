import { execFile } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import * as vscode from 'vscode';
import { readAccountEmail } from './accountInfo';
import type { App } from './app';
import { createProfile } from './createProfile';
import { profilesRoot } from './paths';
import { removeProfileDir } from './sharedLinks';
import { resolveCli, runLogin, type LoginDeps, type LoginResult } from './login';
import type { Profile } from './profileStore';

function claudeOnPath(): Promise<boolean> {
  return new Promise((resolve) => {
    execFile('claude', ['--version'], { shell: true, timeout: 10_000, windowsHide: true }, (err) => resolve(!err));
  });
}

async function findCli(): Promise<string | undefined> {
  const ext = vscode.extensions.getExtension('anthropic.claude-code');
  const bundled = ext && path.join(ext.extensionPath, 'resources', 'native-binary', process.platform === 'win32' ? 'claude.exe' : 'claude');
  const bundledExists = bundled !== undefined && fs.existsSync(bundled);
  return resolveCli({ bundled, bundledExists, onPath: bundledExists ? false : await claudeOnPath() });
}

/** Phụ thuộc thật của `runLogin`: terminal VS Code chạy thẳng file `claude` (không qua shell) khi có đường dẫn đầy đủ. */
export function vscodeLoginDeps(app: App, profile: Profile): LoginDeps {
  return {
    findCli,
    openTerminal(name, env, cli, args) {
      const direct = path.isAbsolute(cli);
      const terminal = direct
        ? vscode.window.createTerminal({ name, env, shellPath: cli, shellArgs: args, isTransient: true })
        : vscode.window.createTerminal({ name, env, isTransient: true });
      if (!direct) terminal.sendText(`${cli} ${args.join(' ')}`);
      terminal.show();
      return {
        reportsExit: direct,
        dispose: () => terminal.dispose(),
        exitCode: () => (terminal.exitStatus ? terminal.exitStatus.code ?? -1 : undefined),
      };
    },
    readEmail: () => readAccountEmail(profile, app.home),
    sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  };
}

/**
 * Chạy đăng nhập kèm thông báo tiến trình; dùng cho cả thêm tài khoản và đăng nhập lại. Chuẩn bị thư mục hồ sơ trước,
 * vì `claude auth login` tự tạo thư mục cấu hình nếu nó đã bị xoá, nhưng không có liên kết dùng chung.
 */
export async function loginWithProgress(app: App, profile: Profile): Promise<LoginResult> {
  await app.prepare(profile);
  return vscode.window.withProgress(
    { location: vscode.ProgressLocation.Notification, title: `Waiting for ${profile.name} to sign in from the terminal…` },
    () => runLogin(profile, vscodeLoginDeps(app, profile)),
  );
}

export async function reportLogin(app: App, profile: Profile, result: LoginResult): Promise<void> {
  switch (result) {
    case 'signed-in': {
      const email = await readAccountEmail(profile, app.home);
      const use = app.folders().length > 0 ? 'Use for This Project' : 'Use for This Window';
      await app.render();
      if (app.resolution.profile.id === profile.id) {
        void vscode.window.showInformationMessage(`Signed in as ${email ?? profile.name}.`);
        return;
      }
      const choice = await vscode.window.showInformationMessage(`Signed in as ${email ?? profile.name}.`, use);
      if (choice === use) await app.selectProfile(profile);
      return;
    }
    case 'timeout':
      void vscode.window.showWarningMessage('No sign-in detected yet. The profile was kept; you can sign in again from Manage Profiles.');
      return;
    case 'failed':
      void vscode.window.showWarningMessage('Sign-in did not succeed (see the terminal). The profile was kept; you can sign in again from Manage Profiles.');
      return;
    case 'no-cli':
      void vscode.window.showInformationMessage(
        `Could not find the claude command. This window will switch to ${profile.name}; sign in from the Claude panel.`);
      await app.selectProfile(profile);
      return;
  }
}

export async function runAddAccount(app: App): Promise<void> {
  // 1. Hỏi tên, cùng quy tắc với ProfileStore.add.
  const name = await vscode.window.showInputBox({
    title: 'Add Claude Account',
    prompt: 'Account name, e.g. Work',
    validateInput: (value) => {
      try {
        app.profiles.validateName(value);
        return undefined;
      } catch (err) {
        return (err as Error).message;
      }
    },
  });
  if (name === undefined) return;

  // 2. Tạo hồ sơ cùng thư mục và phần dùng chung; lỗi thì gỡ sạch, không để hồ sơ nửa vời.
  let profile: Profile;
  try {
    profile = await createProfile(name, {
      profiles: app.profiles, root: profilesRoot(app.home), prepare: (p) => app.prepare(p), removeDir: removeProfileDir,
    });
  } catch (err) {
    void vscode.window.showErrorMessage(`Could not create profile ${name.trim()}: ${(err as Error).message}`);
    return;
  }

  // 3. Đăng nhập.
  await reportLogin(app, profile, await loginWithProgress(app, profile));
}
