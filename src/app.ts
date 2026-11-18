import fs from 'node:fs';
import * as vscode from 'vscode';
import { readAccountInfo } from './accountInfo';
import { recheckActive, resolveActiveProfile, type Resolution } from './activeProfile';
import { configDirOverride, type ConfigAccess, type ProfileApplier } from './applier';
import type { BindingStore } from './bindingStore';
import { DEFAULT_PROFILE_ID, type Profile, type ProfileStore } from './profileStore';
import { prepareProfileDir } from './sharedLinks';
import { refreshLine, REFRESH_QUOTA_COMMAND, statusView } from './statusBar';
import { isStale, type RefreshResult, type UsageRefresher } from './usageRefresh';

/** Trạng thái chung của một cửa sổ: hồ sơ đang dùng, thanh trạng thái, và thao tác chọn hồ sơ. */
export class App {
  resolution: Resolution;
  onDidRender?: () => void;

  constructor(
    readonly home: string,
    readonly profiles: ProfileStore,
    readonly bindings: BindingStore,
    readonly applier: ProfileApplier,
    private readonly item: vscode.StatusBarItem,
    readonly config: ConfigAccess,
    readonly usage: UsageRefresher,
  ) {
    this.resolution = this.resolve();
  }

  /**
   * Lấy lại quota (qua `claude -p /usage`) cho các hồ sơ đã đăng nhập và còn thư mục; vẽ lại khi bắt đầu (hiện
   * "Refreshing…") và khi xong.
   */
  async refreshUsage(profiles: Profile[]): Promise<{ profile: Profile; result: RefreshResult }[]> {
    const infos = await Promise.all(profiles.map((p) => readAccountInfo(p, this.home)));
    const targets = profiles.filter((p, i) => infos[i].email !== undefined && (p.isDefault || fs.existsSync(p.configDir)));
    const work = Promise.all(targets.map(async (profile) => ({ profile, result: await this.usage.refresh(profile) })));
    await this.render();
    const results = await work;
    await this.render();
    return results;
  }

  private readonly autoTried = new Map<string, number>();

  /**
   * Tự lấy lại quota của hồ sơ đang dùng khi bản lưu đã cũ, để tooltip mới khi rê chuột tới (VS Code không báo sự kiện
   * rê chuột). Mỗi hồ sơ tự thử tối đa một lần mỗi `STALE_MS`, kể cả khi lần trước không ra quota.
   */
  async refreshActiveUsageIfStale(now = Date.now()): Promise<void> {
    const { profile } = this.resolution;
    const tried = this.autoTried.get(profile.id);
    if (tried !== undefined && !isStale(tried, now)) return;
    const { usage } = await readAccountInfo(profile, this.home);
    if (!isStale(usage?.fetchedAt, now)) return;
    this.autoTried.set(profile.id, now);
    await this.refreshUsage([profile]);
  }

  /** Thư mục gốc của workspace (chỉ thư mục trên đĩa của máy đang chạy extension). */
  folders(): string[] {
    return (vscode.workspace.workspaceFolders ?? []).filter((f) => f.uri.scheme === 'file').map((f) => f.uri.fsPath);
  }

  resolve(): Resolution {
    return resolveActiveProfile(this.folders(), this.profiles, this.bindings, fs.existsSync);
  }

  async render(): Promise<void> {
    const { profile } = this.resolution;
    const { email, usage } = await readAccountInfo(profile, this.home);
    const override = configDirOverride(this.config, process.platform);
    const view = statusView(this.resolution, email, this.applier.perWindow, override, usage);
    const tooltip = new vscode.MarkdownString(view.tooltip);
    if (email !== undefined && override === undefined) {
      tooltip.appendMarkdown(`\n\n${refreshLine(this.usage.isRefreshing(profile.id))}`);
      tooltip.supportThemeIcons = true;
      tooltip.isTrusted = { enabledCommands: [REFRESH_QUOTA_COMMAND] };
    }
    this.item.text = view.text;
    this.item.tooltip = tooltip;
    this.item.color = new vscode.ThemeColor(view.color);
    this.item.backgroundColor = view.warning ? new vscode.ThemeColor('statusBarItem.warningBackground') : undefined;
    this.item.show();
    this.onDidRender?.();
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
        `Profile ${profile.name} could not share: ${notShared.join(', ')} (already exists as a real folder in ${profile.configDir}). This profile's conversation history is kept separate.`);
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
      const reload = 'Reload';
      const choice = await vscode.window.showWarningMessage(
        `Profile ${lostName} no longer exists; this window switched to ${next.profile.name}. Reload the window so Claude uses ${next.profile.name}?`, reload);
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
        `This window uses ${profile.name} for new Claude conversations. No folder is open, so the choice is not saved: reloading the window goes back to ${this.profiles.get(DEFAULT_PROFILE_ID)!.name}.`);
    }
  }

  async offerReload(profile: Profile): Promise<void> {
    const reload = 'Reload';
    const choice = await vscode.window.showInformationMessage(`Reload the window so Claude uses the ${profile.name} account?`, reload);
    if (choice === reload) await vscode.commands.executeCommand('workbench.action.reloadWindow');
  }
}
