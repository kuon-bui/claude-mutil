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

/** Thiết lập claudeCode.environmentVariables có CLAUDE_CONFIG_DIR sẽ thắng process.env (bản thử Task 1). */
function warnOverride(config: ConfigAccess): void {
  const override = configDirOverride(config, process.platform);
  if (override === undefined) return;
  const open = 'Open Settings';
  void vscode.window.showWarningMessage(
    `The claudeCode.environmentVariables setting sets CLAUDE_CONFIG_DIR (${override}), so Claude Accounts cannot switch accounts. Remove CLAUDE_CONFIG_DIR from that setting.`,
    open,
  ).then((choice) => {
    if (choice === open) void vscode.commands.executeCommand('workbench.action.openSettings', 'claudeCode.environmentVariables');
  });
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
  const app = new App(home, profiles, bindings, applier, item, config);
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
    // Thiết lập đè có thể được thêm hoặc gỡ khi cửa sổ đang mở: vẽ lại và cảnh báo nếu vừa xuất hiện.
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (!e.affectsConfiguration('claudeCode.environmentVariables')) return;
      void app.render();
      warnOverride(config);
    }),
  );
  await app.render();
  // Nối lại phần dùng chung nếu hồ sơ đang dùng bị mất liên kết (ví dụ lần xoá trước thất bại giữa chừng).
  if (app.resolution.reason === 'bound') void app.prepare(app.resolution.profile);
  warnOverride(config);

  // 5. Cảnh báo phiên bản Claude Code, một lần cho mỗi bản đang cài.
  const installed = vscode.extensions.getExtension('anthropic.claude-code')?.packageJSON?.version as string | undefined;
  const warnedKey = 'claudeAccounts.versionWarned';
  if (!isSupported(installed, MIN_CLAUDE_CODE_VERSION) && ctx.globalState.get(warnedKey) !== (installed ?? 'none')) {
    await ctx.globalState.update(warnedKey, installed ?? 'none');
    void vscode.window.showWarningMessage(`Claude Accounts requires Claude Code ${MIN_CLAUDE_CODE_VERSION} or later.`);
  }

  // 6. Dự án chưa gắn hồ sơ: hỏi đúng một lần.
  const askedKey = 'claudeAccounts.asked';
  if (app.resolution.reason === 'unbound' && !ctx.workspaceState.get(askedKey)) {
    await ctx.workspaceState.update(askedKey, true);
    void vscode.commands.executeCommand('claudeAccounts.switch', { title: 'Which Claude account should this project use?' });
  }
}

export function deactivate(): void {}
