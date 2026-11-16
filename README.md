# Claude Accounts

A VS Code extension that keeps several Claude Code accounts signed in at once. Each project remembers its own account, and you switch accounts with one click on the status bar. The extension never reads, copies, or sends tokens.

> **Version 0.1.0 has only been checked by hand on Windows 11.** Checked: installing, adding an account, one account per window, asking once for a new project, shared history, and the warning when a profile is missing. Not yet checked by hand: deleting a profile through "Manage Profiles" and staying signed in after a reboot. Not yet tried on macOS or Linux. If you hit a bug, please report it with your OS and Claude Code version.

## Installation

1. You need the **Claude Code** extension (`anthropic.claude-code`), version 2.1.323 or later.
2. Install **Claude Accounts** (`kuon.claude-multi-account`) from the VS Code Marketplace,
   or from a terminal: `code --install-extension kuon.claude-multi-account`.
   A `.vsix` for each version is also attached to the [GitHub releases](https://github.com/kuon-bui/claude-mutil/releases) (**Extensions** → `…` → **Install from VSIX…**).
3. Reload the window. The status bar (bottom right) shows **Claude: Default**, which is the account you are already signed in with.

## Commands

| Command | What it does |
|---|---|
| **Claude Accounts: Switch Account** (or click the status bar) | Pick the account for the open project. The choice is remembered per folder. |
| **Claude Accounts: Add Account** | Give it a name, then sign in from the terminal that opens (your browser opens the sign-in page). |
| **Claude Accounts: Manage Profiles** | Rename, sign in again, or delete a profile. |

After you switch accounts, the extension offers to **reload the window**. Claude Code only picks up the new account when it restarts.

When you open a project that has no account yet, the extension asks once. If you skip it, the project uses **Default** and the status bar shows "(not chosen)".

## How it works

- The **Default** profile is your existing `~/.claude`. Every other profile is a folder `~/.claude-profiles/<id>`.
- Each VS Code window sets `CLAUDE_CONFIG_DIR` for its own Claude Code, so two windows can run two accounts at the same time.
- Project-to-account pairs are stored in the extension's own storage, not in the project's `.vscode/settings.json`.

### Shared vs. separate

| Part | Across profiles |
|---|---|
| Sign-in | **Separate** |
| Conversation history (`projects/`) | Shared: one account can resume another account's conversations |
| `skills/`, `plugins/`, `commands/` | Shared |
| `settings.json`, `CLAUDE.md` | **Copied** from `~/.claude` when the profile is created, then each profile keeps its own copy |

`settings.json` and `CLAUDE.md` can't be shared through links: Claude Code saves them by replacing the file, which breaks the link. So a change to settings (including the model and which plugins are enabled) or to `CLAUDE.md` only applies to the profile where you made it.

## Caveats

- **The `claudeCode.environmentVariables` setting:** if you set `CLAUDE_CONFIG_DIR` there, Claude Code gives it priority and the extension can't switch accounts. The extension warns you about this; remove `CLAUDE_CONFIG_DIR` from that setting.
- **Claude Console (API keys):** accounts that use an API key set through an environment variable (`ANTHROPIC_API_KEY`) can't be separated per folder. The extension only separates sign-ins stored in the config folder.
- **Deleting a profile** only removes the `~/.claude-profiles/<id>` folder (including that profile's sign-in). Conversation history and the shared folders are kept. On macOS, the sign-in entry in Keychain is not removed; sign out inside Claude first if you want it gone completely.
- **Remote / WSL:** the extension runs on the same machine as Claude Code, and profiles live in that machine's home folder.
- On Windows, the shared folders are junctions (no admin rights needed).
