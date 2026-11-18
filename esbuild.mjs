import fs from 'node:fs';
import { build } from 'esbuild';

// Font codicon cho webview (avatar hồ sơ): codicon.css trỏ tới ./codicon.ttf nên chép cả hai vào dist.
fs.mkdirSync('dist', { recursive: true });
for (const file of ['codicon.css', 'codicon.ttf']) {
  fs.copyFileSync(`node_modules/@vscode/codicons/dist/${file}`, `dist/${file}`);
}

await build({
  entryPoints: ['src/extension.ts'],
  outfile: 'dist/extension.js',
  bundle: true,
  platform: 'node',
  format: 'cjs',
  target: 'node20',
  external: ['vscode'],
  sourcemap: true,
  logLevel: 'info',
});

await build({
  entryPoints: ['src/webview/index.tsx'],
  outfile: 'dist/webview.js',
  bundle: true,
  platform: 'browser',
  format: 'iife',
  target: 'es2022',
  jsx: 'automatic',
  sourcemap: true,
  logLevel: 'info',
});
