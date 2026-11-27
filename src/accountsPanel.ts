import { randomBytes } from 'node:crypto';
import fs from 'node:fs';
import * as vscode from 'vscode';
import { readAccountInfo } from './accountInfo';
import { loginWithProgress, reportLogin, runAddAccount } from './addAccount';
import { accountsState } from './accountsView';
import { configDirOverride } from './applier';
import type { App } from './app';
import { createLatestGate } from './latestGate';
import { changeAppearance, renameProfile, removeProfile } from './manageCommand';
import type { Profile } from './profileStore';
import type { RefreshResult } from './usageRefresh';

/** Nơi đặt trang Accounts: tab trong editor hoặc view ở sidebar (activity bar). Nhớ chung cho mọi cửa sổ. */
export type AccountsLocation = 'editor' | 'sidebar';

const PANEL_TYPE = 'claudeAccounts.accounts';
export const VIEW_ID = 'claudeAccounts.accountsView';
const LOCATION_KEY = 'claudeAccounts.location';
/** Context key bật view ở sidebar (`when` trong package.json): view chỉ hiện khi trang đã được đưa về sidebar. */
const SIDEBAR_CONTEXT = 'claudeAccounts.inSidebar';

interface Host { webview: vscode.Webview; location: AccountsLocation; gate: ReturnType<typeof createLatestGate> }

let panel: (Host & { panel: vscode.WebviewPanel }) | undefined;
let view: (Host & { view: vscode.WebviewView }) | undefined;

function location(ctx: vscode.ExtensionContext): AccountsLocation {
  return ctx.globalState.get<AccountsLocation>(LOCATION_KEY) === 'sidebar' ? 'sidebar' : 'editor';
}

/** Đăng ký view ở sidebar và bật context key theo vị trí đã nhớ. Gọi một lần lúc activate. */
export function registerAccountsView(app: App, ctx: vscode.ExtensionContext): void {
  void vscode.commands.executeCommand('setContext', SIDEBAR_CONTEXT, location(ctx) === 'sidebar');
  const dist = vscode.Uri.joinPath(ctx.extensionUri, 'dist');
  ctx.subscriptions.push(vscode.window.registerWebviewViewProvider(VIEW_ID, {
    resolveWebviewView(webviewView) {
      webviewView.webview.options = { enableScripts: true, localResourceRoots: [dist] };
      const host = { view: webviewView, webview: webviewView.webview, location: 'sidebar' as const, gate: createLatestGate() };
      view = host;
      setup(app, ctx, host, dist);
      webviewView.onDidDispose(() => { if (view === host) view = undefined; });
      webviewView.onDidChangeVisibility(() => { if (webviewView.visible) void pushState(app, host); });
    },
  }, { webviewOptions: { retainContextWhenHidden: true } }));
}

/** Mở trang Accounts ở vị trí đã chọn (tab editor hoặc sidebar). */
export function showAccounts(app: App, ctx: vscode.ExtensionContext): void {
  if (location(ctx) === 'sidebar') {
    void vscode.commands.executeCommand(`${VIEW_ID}.focus`);
    refreshAccounts(app);
    return;
  }
  showPanel(app, ctx);
}

/** Chuyển trang Accounts giữa tab editor và sidebar (đóng chỗ cũ, mở chỗ mới) và nhớ lựa chọn. */
export async function moveAccounts(app: App, ctx: vscode.ExtensionContext, to: AccountsLocation): Promise<void> {
  await ctx.globalState.update(LOCATION_KEY, to);
  await vscode.commands.executeCommand('setContext', SIDEBAR_CONTEXT, to === 'sidebar');
  if (to === 'sidebar') {
    panel?.panel.dispose();
    await vscode.commands.executeCommand(`${VIEW_ID}.focus`);
  } else {
    showPanel(app, ctx);
  }
  refreshAccounts(app);
}

function showPanel(app: App, ctx: vscode.ExtensionContext): void {
  if (panel) {
    panel.panel.reveal(vscode.ViewColumn.One);
    refreshAccounts(app);
    return;
  }
  const dist = vscode.Uri.joinPath(ctx.extensionUri, 'dist');
  const webviewPanel = vscode.window.createWebviewPanel(
    PANEL_TYPE,
    'Accounts',
    vscode.ViewColumn.One,
    { enableScripts: true, retainContextWhenHidden: true, localResourceRoots: [dist] },
  );
  const host = { panel: webviewPanel, webview: webviewPanel.webview, location: 'editor' as const, gate: createLatestGate() };
  panel = host;
  setup(app, ctx, host, dist);
  webviewPanel.onDidDispose(() => { if (panel === host) panel = undefined; });
  ctx.subscriptions.push(webviewPanel);
}

function setup(app: App, ctx: vscode.ExtensionContext, host: Host, dist: vscode.Uri): void {
  host.webview.html = html(host.webview, dist);
  host.webview.onDidReceiveMessage((msg: Parameters<typeof onMessage>[1]) => {
    if (msg.type === 'ready') void pushState(app, host);
    else if (msg.type === 'move') void moveAccounts(app, ctx, host.location === 'sidebar' ? 'editor' : 'sidebar');
    else void onMessage(app, msg);
  });
}

export function refreshAccounts(app: App): void {
  for (const host of [panel, view]) if (host !== undefined) void pushState(app, host);
}

async function pushState(app: App, target: Host): Promise<void> {
  await target.gate.run(async () => {
    const profiles = app.profiles.list();
    const infos = await Promise.all(profiles.map((p) => readAccountInfo(p, app.home)));
    return accountsState({
      profiles,
      infos,
      activeId: app.resolution.profile.id,
      dirExists: fs.existsSync,
      unbound: app.resolution.reason === 'unbound',
      hasFolder: app.folders().length > 0,
      override: configDirOverride(app.config, process.platform),
      now: Date.now(),
      refreshing: (id) => app.usage.isRefreshing(id),
    });
  }, (payload) => {
    if (panel !== target && view !== target) return;
    void target.webview.postMessage({ type: 'state', payload, location: target.location });
  });
}

async function onMessage(app: App, msg: { type?: string; id?: string; icon?: unknown; color?: unknown }): Promise<void> {
  if (msg.type === 'add') {
    await runAddAccount(app);
    await app.render();
    return;
  }
  if (msg.type === 'refresh') {
    reportRefresh(await app.refreshUsage(app.profiles.list()));
    return;
  }
  if (msg.id === undefined) return;
  const profile = app.profiles.get(msg.id);
  if (profile === undefined) return;
  if (msg.type === 'use') await app.selectProfile(profile);
  else if (msg.type === 'rename') await renameProfile(app, profile);
  else if (msg.type === 'appearance') {
    await changeAppearance(app, profile, {
      ...(typeof msg.icon === 'string' && { icon: msg.icon }),
      ...(typeof msg.color === 'string' && { color: msg.color }),
    });
  }
  else if (msg.type === 'login') await reportLogin(app, profile, await loginWithProgress(app, profile));
  else if (msg.type === 'delete') await removeProfile(app, profile);
  await app.render();
}

/** Báo khi lấy lại quota không được: không tìm thấy `claude`, hoặc lệnh lỗi ở hồ sơ nào. */
export function reportRefresh(results: { profile: Profile; result: RefreshResult }[]): void {
  if (results.some((r) => r.result === 'no-cli')) {
    void vscode.window.showWarningMessage('Could not find the claude command, so the quota cannot be refreshed.');
    return;
  }
  const failed = results.filter((r) => r.result === 'failed').map((r) => r.profile.name);
  if (failed.length > 0) void vscode.window.showWarningMessage(`Could not refresh the quota for ${failed.join(', ')}.`);
}

function html(webview: vscode.Webview, dist: vscode.Uri): string {
  const nonce = randomBytes(16).toString('hex');
  const script = webview.asWebviewUri(vscode.Uri.joinPath(dist, 'webview.js'));
  const style = webview.asWebviewUri(vscode.Uri.joinPath(dist, 'webview.css'));
  const codicons = webview.asWebviewUri(vscode.Uri.joinPath(dist, 'codicon.css'));
  const csp = [
    "default-src 'none'",
    `script-src 'nonce-${nonce}'`,
    `style-src ${webview.cspSource} 'unsafe-inline'`,
    `font-src ${webview.cspSource}`,
  ].join('; ');
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta http-equiv="Content-Security-Policy" content="${csp}">
<link rel="stylesheet" href="${codicons}">
<link rel="stylesheet" href="${style}">
</head>
<body>
<div id="root"></div>
<script nonce="${nonce}" src="${script}"></script>
</body>
</html>`;
}
