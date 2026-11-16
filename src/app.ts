import fs from 'node:fs';
import * as vscode from 'vscode';
import { readAccountEmail } from './accountInfo';
import { recheckActive, resolveActiveProfile, type Resolution } from './activeProfile';
import { configDirOverride, type ConfigAccess, type ProfileApplier } from './applier';
import type { BindingStore } from './bindingStore';
import { DEFAULT_PROFILE_ID, type Profile, type ProfileStore } from './profileStore';
import { prepareProfileDir } from './sharedLinks';
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
    private readonly config: ConfigAccess,
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
    const view = statusView(this.resolution, email, this.applier.perWindow, configDirOverride(this.config, process.platform));
    this.item.text = view.text;
    this.item.tooltip = view.tooltip;
    this.item.color = new vscode.ThemeColor(view.color);
    this.item.backgroundColor = view.warning ? new vscode.ThemeColor('statusBarItem.warningBackground') : undefined;
    this.item.show();
  }

  /**
   * Tạo lại thư mục hồ sơ nếu mất và nối lại phần dùng chung trước khi Claude Code có thể dùng nó, để lịch sử
   * không tách ra mà không ai biết. Cảnh báo nếu thư mục dùng chung nào không nối được.
   */
  async prepare(profile: Profile): Promise<void> {
    const defaultDir = this.profiles.get(DEFAULT_PROFILE_ID)!.configDir;
    const notShared = await prepareProfileDir(profile, defaultDir, process.platform);
    if (notShared.length > 0) {
      void vscode.window.showWarningMessage(
        `Hồ sơ ${profile.name} không dùng chung được: ${notShared.join(', ')} (đã có sẵn dạng thư mục thật trong ${profile.configDir}). Lịch sử hội thoại của hồ sơ này đang tách riêng.`);
    }
  }

  /**
   * Kiểm lại hồ sơ đang dùng (gọi khi cửa sổ được focus): kho dùng chung giữa các cửa sổ, nên hồ sơ có thể đã bị đổi tên
   * hay xoá ở cửa sổ khác, hoặc thư mục bị xoá bên ngoài. Mất hồ sơ thì chuyển về Mặc định ngay (để Claude không tạo lại
   * thư mục đã xoá), báo trên thanh trạng thái và đề nghị tải lại.
   */
  async refresh(): Promise<void> {
    const next = recheckActive(this.resolution, this.profiles, fs.existsSync);
    const lost = next.reason === 'missing-profile' && this.resolution.reason !== 'missing-profile';
    const lostName = this.resolution.profile.name;
    this.resolution = next;
    if (lost) await this.applier.apply(next.profile);
    await this.render();
    if (lost) {
      const reload = 'Tải lại';
      const choice = await vscode.window.showWarningMessage(
        `Hồ sơ ${lostName} không còn; cửa sổ này chuyển về ${next.profile.name}. Tải lại cửa sổ để Claude dùng ${next.profile.name}?`, reload);
      if (choice === reload) await vscode.commands.executeCommand('workbench.action.reloadWindow');
    }
  }

  /**
   * Dùng `profile` cho cửa sổ này. Có thư mục thì gắn với thư mục đầu tiên và đề nghị tải lại (Claude Code chỉ nhận
   * hồ sơ mới khi khởi tiến trình lại). Không có thư mục thì không có gì để nhớ qua lần tải lại, nên không đề nghị tải
   * lại: Claude Code đọc biến môi trường mỗi lần khởi tiến trình, cuộc trò chuyện mới sẽ dùng hồ sơ này.
   */
  async selectProfile(profile: Profile): Promise<void> {
    const previous = this.resolution.profile;
    const folder = this.folders()[0];
    await this.prepare(profile);
    if (folder !== undefined) await this.bindings.set(folder, profile.id);
    await this.applier.apply(profile);
    this.resolution = { profile, reason: folder === undefined ? 'no-folder' : 'bound' };
    await this.render();
    if (profile.id === previous.id) return;
    if (folder !== undefined) {
      await this.offerReload(profile);
    } else {
      void vscode.window.showInformationMessage(
        `Cửa sổ này dùng ${profile.name} cho các cuộc trò chuyện Claude mới. Chưa mở thư mục nên lựa chọn không được lưu: tải lại cửa sổ sẽ quay về ${this.profiles.get(DEFAULT_PROFILE_ID)!.name}.`);
    }
  }

  async offerReload(profile: Profile): Promise<void> {
    const reload = 'Tải lại';
    const choice = await vscode.window.showInformationMessage(`Tải lại cửa sổ để Claude dùng tài khoản ${profile.name}?`, reload);
    if (choice === reload) await vscode.commands.executeCommand('workbench.action.reloadWindow');
  }
}
