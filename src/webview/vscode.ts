import type { PanelMessage } from './types';

declare function acquireVsCodeApi(): { postMessage(msg: PanelMessage): void };

export const vscode = acquireVsCodeApi();
