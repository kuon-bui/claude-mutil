// Extension thử cho Task 1 (cách processEnv): đặt CLAUDE_CONFIG_DIR trong extension host của cửa sổ này
// ngay khi kích hoạt, giống extension thật sẽ làm. Ghi log ra spike/probe-log.txt.
const fs = require('fs');
const os = require('os');
const path = require('path');
const vscode = require('vscode');

const LOG = path.join(__dirname, '..', 'probe-log.txt');
const log = (msg) => fs.appendFileSync(LOG, `[${new Date().toISOString()}] ${msg}\n`);

exports.activate = function activate() {
  const claude = vscode.extensions.getExtension('anthropic.claude-code');
  const before = process.env.CLAUDE_CONFIG_DIR;
  process.env.CLAUDE_CONFIG_DIR = path.join(os.homedir(), '.claude-profiles', 'spike');
  log(`activate: Claude Code đã kích hoạt trước chưa = ${claude ? claude.isActive : 'không cài'}; ` +
      `CLAUDE_CONFIG_DIR trước = ${before ?? '(trống)'}; sau = ${process.env.CLAUDE_CONFIG_DIR}; ` +
      `envSetting có CLAUDE_CONFIG_DIR = ${JSON.stringify((vscode.workspace.getConfiguration('claudeCode').get('environmentVariables') || []))
        .includes('CLAUDE_CONFIG_DIR')}`);
};

exports.deactivate = function deactivate() {};
