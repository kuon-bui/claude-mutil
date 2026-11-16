import type * as vscode from 'vscode';
import { showAccounts } from './accountsPanel';
import type { App } from './app';

export function runSwitch(app: App, ctx: vscode.ExtensionContext): void {
  showAccounts(app, ctx);
}

export function runManage(app: App, ctx: vscode.ExtensionContext): void {
  showAccounts(app, ctx);
}
