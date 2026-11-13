import { execFile } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import * as vscode from 'vscode';
import { readAccountEmail } from './accountInfo';
import type { App } from './app';
import { resolveCli, runLogin, type LoginDeps, type LoginResult } from './login';
import { defaultConfigDir } from './paths';
import type { Profile } from './profileStore';
import { linkShared, SHARED_DIRS } from './sharedLinks';

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
        dispose: () => terminal.dispose(),
        exitCode: () => (terminal.exitStatus ? terminal.exitStatus.code ?? -1 : undefined),
      };
    },
    readEmail: () => readAccountEmail(profile, app.home),
    sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  };
}

/** Chạy đăng nhập kèm thông báo tiến trình; dùng cho cả thêm tài khoản và đăng nhập lại. */
export function loginWithProgress(app: App, profile: Profile): Thenable<LoginResult> {
  return vscode.window.withProgress(
    { location: vscode.ProgressLocation.Notification, title: `Đang chờ đăng nhập ${profile.name} trong terminal…` },
    () => runLogin(profile, vscodeLoginDeps(app, profile)),
  );
}

export async function reportLogin(app: App, profile: Profile, result: LoginResult): Promise<void> {
  switch (result) {
    case 'signed-in': {
      const email = await readAccountEmail(profile, app.home);
      const use = app.folders().length > 0 ? 'Dùng cho dự án này' : 'Dùng cho cửa sổ này';
      await app.render();
      if (app.resolution.profile.id === profile.id) {
        void vscode.window.showInformationMessage(`Đã đăng nhập ${email ?? profile.name}.`);
        return;
      }
      const choice = await vscode.window.showInformationMessage(`Đã đăng nhập ${email ?? profile.name}.`, use);
      if (choice === use) await app.selectProfile(profile);
      return;
    }
    case 'timeout':
      void vscode.window.showWarningMessage('Chưa thấy đăng nhập; hồ sơ vẫn được giữ, bạn có thể đăng nhập lại từ Quản lý hồ sơ.');
      return;
    case 'failed':
      void vscode.window.showWarningMessage('Đăng nhập chưa thành công (xem terminal); hồ sơ vẫn được giữ, bạn có thể đăng nhập lại từ Quản lý hồ sơ.');
      return;
    case 'no-cli':
      void vscode.window.showInformationMessage('Không tìm thấy lệnh claude. Sau khi tải lại cửa sổ, hãy đăng nhập trong khung Claude.');
      await app.selectProfile(profile);
      return;
  }
}

export async function runAddAccount(app: App): Promise<void> {
  // 1. Hỏi tên, cùng quy tắc với ProfileStore.add.
  const name = await vscode.window.showInputBox({
    title: 'Thêm tài khoản Claude',
    prompt: 'Tên tài khoản, ví dụ: Công ty A',
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

  // 2. Tạo hồ sơ, thư mục và phần dùng chung.
  const profile = await app.profiles.add(name);
  await fs.promises.mkdir(profile.configDir, { recursive: true });
  const report = await linkShared(defaultConfigDir(app.home), profile.configDir, process.platform);
  const notShared = report.skipped.filter((n) => (SHARED_DIRS as readonly string[]).includes(n));
  if (notShared.length > 0) {
    void vscode.window.showWarningMessage(`Không dùng chung được: ${notShared.join(', ')} (đã có sẵn trong ${profile.configDir}).`);
  }

  // 3. Đăng nhập.
  await reportLogin(app, profile, await loginWithProgress(app, profile));
}
