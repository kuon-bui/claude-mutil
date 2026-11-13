import os from 'node:os';
import * as vscode from 'vscode';
import { runAddAccount } from './addAccount';
import { App } from './app';
import { configDirOverride, createApplier, type ConfigAccess } from './applier';
import { BindingStore } from './bindingStore';
import { runManage } from './manageCommand';
import { ProfileStore } from './profileStore';
import { runSwitch } from './switchCommand';
import { isSupported } from './versionCheck';

/** Bản Claude Code đã thử trong bản thử Task 1 (docs/spike-results.md). */
export const MIN_CLAUDE_CODE_VERSION = '2.1.323';

function claudeCodeConfig(): ConfigAccess {
  return {
    get: <T>(key: string) => vscode.workspace.getConfiguration('claudeCode').get<T>(key),
    updateGlobal: (key, value) => vscode.workspace.getConfiguration('claudeCode').update(key, value, vscode.ConfigurationTarget.Global),
  };
}

export async function activate(ctx: vscode.ExtensionContext): Promise<void> {
  // 1. Kho hồ sơ và cặp thư mục–hồ sơ. CLAUDE_CONFIG_DIR có sẵn lúc này đến từ ngoài VS Code (mỗi lần tải lại cửa sổ,
  //    extension host nhận lại môi trường gốc): coi đó là thư mục của hồ sơ Mặc định thay vì xoá nó.
  const home = os.homedir();
  const externalConfigDir = process.env.CLAUDE_CONFIG_DIR?.trim() || undefined;
  const profiles = new ProfileStore(ctx.globalState, home, externalConfigDir);
  const bindings = new BindingStore(ctx.globalState, process.platform);
  const config = claudeCodeConfig();
  const applier = createApplier({ env: process.env, config, extensionPath: ctx.extensionPath, platform: process.platform });

  // 2–3. Xác định hồ sơ và áp dụng NGAY, trước mọi await, để biến môi trường có trước khi Claude Code khởi tiến trình.
  const item = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
  const app = new App(home, profiles, bindings, applier, item);
  void applier.apply(app.resolution.profile);

  // 4. Thanh trạng thái.
  item.command = 'claudeAccounts.switch';
  item.name = 'Claude Accounts';
  ctx.subscriptions.push(
    item,
    vscode.commands.registerCommand('claudeAccounts.switch', (options?: { title?: string }) => runSwitch(app, options)),
    vscode.commands.registerCommand('claudeAccounts.add', () => runAddAccount(app)),
    vscode.commands.registerCommand('claudeAccounts.manage', () => runManage(app)),
    // Hồ sơ có thể bị đổi tên/xoá ở cửa sổ khác, thư mục bị xoá bên ngoài, email đổi: kiểm lại mỗi khi cửa sổ được focus.
    vscode.window.onDidChangeWindowState((s) => { if (s.focused) void app.refresh(); }),
  );
  await app.render();
  // Nối lại phần dùng chung nếu hồ sơ đang dùng bị mất liên kết (ví dụ lần xoá trước thất bại giữa chừng).
  if (app.resolution.reason === 'bound') void app.prepare(app.resolution.profile);

  // Thiết lập claudeCode.environmentVariables có CLAUDE_CONFIG_DIR sẽ thắng process.env (bản thử Task 1).
  const override = configDirOverride(config, process.platform);
  if (override !== undefined) {
    const open = 'Mở thiết lập';
    void vscode.window.showWarningMessage(
      `Thiết lập claudeCode.environmentVariables đang đặt CLAUDE_CONFIG_DIR (${override}), nên Claude Accounts không đổi được tài khoản. Hãy xoá CLAUDE_CONFIG_DIR khỏi thiết lập đó.`,
      open,
    ).then((choice) => {
      if (choice === open) void vscode.commands.executeCommand('workbench.action.openSettings', 'claudeCode.environmentVariables');
    });
  }

  // 5. Cảnh báo phiên bản Claude Code, một lần cho mỗi bản đang cài.
  const installed = vscode.extensions.getExtension('anthropic.claude-code')?.packageJSON?.version as string | undefined;
  const warnedKey = 'claudeAccounts.versionWarned';
  if (!isSupported(installed, MIN_CLAUDE_CODE_VERSION) && ctx.globalState.get(warnedKey) !== (installed ?? 'none')) {
    await ctx.globalState.update(warnedKey, installed ?? 'none');
    void vscode.window.showWarningMessage(`Claude Accounts cần Claude Code từ bản ${MIN_CLAUDE_CODE_VERSION} trở lên.`);
  }

  // 6. Dự án chưa gắn hồ sơ: hỏi đúng một lần.
  const askedKey = 'claudeAccounts.asked';
  if (app.resolution.reason === 'unbound' && !ctx.workspaceState.get(askedKey)) {
    await ctx.workspaceState.update(askedKey, true);
    void vscode.commands.executeCommand('claudeAccounts.switch', { title: 'Dự án này dùng tài khoản Claude nào?' });
  }
}

export function deactivate(): void {}
