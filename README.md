# Claude Account Profiles

A VS Code extension that keeps several Claude Code accounts signed in at once. Each project remembers its own account, and you switch accounts with one click on the status bar. The extension never reads, copies, or sends tokens.

> **Version 0.1.0 has only been checked by hand on Windows 11.** Checked: installing, adding an account, one account per window, asking once for a new project, shared history, and the warning when a profile is missing. Not yet checked by hand: deleting a profile through "Manage Profiles" and staying signed in after a reboot. Not yet tried on macOS or Linux. If you hit a bug, please report it with your OS and Claude Code version.

## Installation

1. You need the **Claude Code** extension (`anthropic.claude-code`), version 2.1.323 or later.
2. Install **Claude Account Profiles** (`kuon.claude-account-profiles`) from the VS Code Marketplace,
   or from a terminal: `code --install-extension kuon.claude-account-profiles`.
   A `.vsix` for each version is also attached to the [GitHub releases](https://github.com/kuon-bui/claude-mutil/releases) (**Extensions** → `…` → **Install from VSIX…**).
3. Reload the window. The status bar (bottom right) shows **Claude: Default**, which is the account you are already signed in with.

## Commands

| Command | What it does |
|---|---|
| **Claude Accounts: Switch Account** (or click the status bar) | Opens the Accounts tab: pick an account, see its type and quota. The choice is remembered per folder. |
| **Claude Accounts: Add Account** | Opens the Accounts tab, then asks for a name and signs in from the terminal (your browser opens the sign-in page). |
| **Claude Accounts: Manage Profiles** | Opens the same Accounts tab to rename, sign in again, or delete a profile. |
| **Claude Accounts: Refresh Quota** (or **Refresh quota** in the status bar tooltip) | Fetches the latest quota for the account this window uses. The **Refresh quota** button on the Accounts tab does this for every signed-in account. |

The quota shown is the copy Claude Code saves in `.claude.json`. To refresh it, the extension runs `claude -p /usage` with that profile's `CLAUDE_CONFIG_DIR`. Claude Code then fetches the quota using its own sign-in, so the extension still never touches tokens, and no model request is made. While a window is focused, the account it uses is refreshed in the background whenever its saved quota is older than 5 minutes. VS Code has no hover event for status bar items, so the tooltip is already up to date when you hover over it instead of being fetched on hover.

After you switch accounts, the extension offers to **reload the window**. Claude Code only picks up the new account when it restarts.

When you open a project that has no account yet, the extension asks once (the Accounts tab shows “Which Claude account should this project use?”). If you skip it, the project uses **Default** and the status bar shows "(not chosen)".

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
