import { randomBytes } from 'node:crypto';
import fs from 'node:fs';
import * as vscode from 'vscode';
import { readAccountInfo } from './accountInfo';
import { loginWithProgress, reportLogin, runAddAccount } from './addAccount';
import { accountsState } from './accountsView';
import { configDirOverride } from './applier';
import type { App } from './app';
import { renameProfile, removeProfile } from './manageCommand';

let panel: vscode.WebviewPanel | undefined;

export function showAccounts(app: App, ctx: vscode.ExtensionContext): void {
  if (panel) {
    panel.reveal(vscode.ViewColumn.One);
    void refreshAccounts(app);
    return;
  }
  const dist = vscode.Uri.joinPath(ctx.extensionUri, 'dist');
  panel = vscode.window.createWebviewPanel(
    'claudeAccounts.accounts',
    'Accounts',
    vscode.ViewColumn.One,
    { enableScripts: true, retainContextWhenHidden: true, localResourceRoots: [dist] },
  );
  panel.webview.html = html(panel.webview, dist);
  panel.webview.onDidReceiveMessage((msg: { type?: string; id?: string }) => { void onMessage(app, msg); });
  panel.onDidDispose(() => { panel = undefined; });
  ctx.subscriptions.push(panel);
  void refreshAccounts(app);
}

export function refreshAccounts(app: App): void {
  if (panel === undefined) return;
  void pushState(app, panel);
}

async function pushState(app: App, target: vscode.WebviewPanel): Promise<void> {
  const profiles = app.profiles.list();
  const infos = await Promise.all(profiles.map((p) => readAccountInfo(p, app.home)));
  const payload = accountsState({
    profiles,
    infos,
    activeId: app.resolution.profile.id,
    dirExists: fs.existsSync,
    unbound: app.resolution.reason === 'unbound',
    hasFolder: app.folders().length > 0,
    override: configDirOverride(app.config, process.platform),
    now: Date.now(),
  });
  if (panel !== target) return;
  void target.webview.postMessage({ type: 'state', payload });
}

async function onMessage(app: App, msg: { type?: string; id?: string }): Promise<void> {
  if (msg.type === 'ready') {
    refreshAccounts(app);
    return;
  }
  if (msg.type === 'add') {
    await runAddAccount(app);
    await app.render();
    return;
  }
  if (msg.id === undefined) return;
  const profile = app.profiles.get(msg.id);
  if (profile === undefined) return;
  if (msg.type === 'use') await app.selectProfile(profile);
  else if (msg.type === 'rename') await renameProfile(app, profile);
  else if (msg.type === 'login') await reportLogin(app, profile, await loginWithProgress(app, profile));
  else if (msg.type === 'delete') await removeProfile(app, profile);
  await app.render();
}

function html(webview: vscode.Webview, dist: vscode.Uri): string {
  const nonce = randomBytes(16).toString('hex');
  const script = webview.asWebviewUri(vscode.Uri.joinPath(dist, 'webview.js'));
  const style = webview.asWebviewUri(vscode.Uri.joinPath(dist, 'webview.css'));
  const csp = [
    "default-src 'none'",
    `script-src 'nonce-${nonce}'`,
    `style-src ${webview.cspSource} 'unsafe-inline'`,
  ].join('; ');
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta http-equiv="Content-Security-Policy" content="${csp}">
<link rel="stylesheet" href="${style}">
</head>
<body>
<div id="root"></div>
<script nonce="${nonce}" src="${script}"></script>
</body>
</html>`;
}
