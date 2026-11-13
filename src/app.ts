import fs from 'node:fs';
import * as vscode from 'vscode';
import { readAccountEmail } from './accountInfo';
import { resolveActiveProfile, type Resolution } from './activeProfile';
import type { ProfileApplier } from './applier';
import type { BindingStore } from './bindingStore';
import type { Profile, ProfileStore } from './profileStore';
import { statusView } from './statusBar';

/** Trạng thái chung của một cửa sổ: hồ sơ đang dùng, thanh trạng thái, và thao tác chọn hồ sơ. */
export class App {
  resolution: Resolution;

  constructor(
    readonly home: string,
    readonly profiles: ProfileStore,
    readonly bindings: BindingStore,
    readonly applier: ProfileApplier,
    private readonly item: vscode.StatusBarItem,
  ) {
    this.resolution = this.resolve();
  }

  /** Thư mục gốc của workspace (chỉ thư mục trên đĩa của máy đang chạy extension). */
  folders(): string[] {
    return (vscode.workspace.workspaceFolders ?? []).filter((f) => f.uri.scheme === 'file').map((f) => f.uri.fsPath);
  }

  resolve(): Resolution {
    return resolveActiveProfile(this.folders(), this.profiles, this.bindings, fs.existsSync);
  }

  async render(): Promise<void> {
    const email = await readAccountEmail(this.resolution.profile, this.home);
    const view = statusView(this.resolution, email, this.applier.perWindow);
    this.item.text = view.text;
    this.item.tooltip = view.tooltip;
    this.item.color = new vscode.ThemeColor(view.color);
    this.item.backgroundColor = view.warning ? new vscode.ThemeColor('statusBarItem.warningBackground') : undefined;
    this.item.show();
  }

  /**
   * Dùng `profile` cho cửa sổ này (và gắn với thư mục đầu tiên nếu có). Claude Code chỉ nhận hồ sơ mới khi khởi
   * tiến trình lại, nên nếu hồ sơ đổi thì đề nghị tải lại cửa sổ.
   */
  async selectProfile(profile: Profile): Promise<void> {
    const previous = this.resolution.profile;
    const folder = this.folders()[0];
    if (folder !== undefined) await this.bindings.set(folder, profile.id);
    await this.applier.apply(profile);
    this.resolution = { profile, reason: folder === undefined ? 'no-folder' : 'bound' };
    await this.render();
    if (profile.id !== previous.id) await this.offerReload(profile);
  }

  async offerReload(profile: Profile): Promise<void> {
    const reload = 'Tải lại';
    const choice = await vscode.window.showInformationMessage(`Tải lại cửa sổ để Claude dùng tài khoản ${profile.name}?`, reload);
    if (choice === reload) await vscode.commands.executeCommand('workbench.action.reloadWindow');
  }
}
