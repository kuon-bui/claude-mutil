import type { AccountRow, AccountsState, PanelMessage } from './types';
import { vscode } from './vscode';

function send(msg: PanelMessage): void {
  vscode.postMessage(msg);
}

export function App({ state }: { state: AccountsState | undefined }) {
  if (state === undefined) return <p className="p-4 text-[var(--vscode-descriptionForeground)]">Loading…</p>;
  return (
    <div className="mx-auto max-w-3xl p-4">
      <header className="mb-4 flex items-center justify-between gap-3">
        <h1 className="m-0 text-lg font-semibold">Accounts</h1>
        <button
          type="button"
          className="rounded px-3 py-1 text-[var(--vscode-button-foreground)] bg-[var(--vscode-button-background)]"
          onClick={() => send({ type: 'add' })}
        >
          Add account
        </button>
      </header>
      {state.prompt !== undefined && (
        <p className="mb-3 rounded border border-[var(--vscode-panel-border)] px-3 py-2">{state.prompt}</p>
      )}
      {state.override !== undefined && (
        <p className="mb-3 rounded border border-[var(--vscode-panel-border)] px-3 py-2">
          claudeCode.environmentVariables sets CLAUDE_CONFIG_DIR = {state.override}; Claude Accounts cannot switch accounts.
        </p>
      )}
      <ul className="m-0 list-none p-0">
        {state.accounts.map((row) => (
          <li key={row.id} className="mb-3 rounded border border-[var(--vscode-panel-border)] p-3">
            <AccountCard row={row} useLabel={state.useLabel} />
          </li>
        ))}
      </ul>
    </div>
  );
}

function AccountCard({ row, useLabel }: { row: AccountRow; useLabel: string }) {
  return (
    <>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div className="flex items-center gap-2">
          <span aria-hidden="true">{row.active ? '●' : '○'}</span>
          <strong>{row.name}</strong>
        </div>
        <span className="text-[var(--vscode-descriptionForeground)]">{row.kind}</span>
      </div>
      <div className="mt-1 flex flex-wrap justify-between gap-2 text-[var(--vscode-descriptionForeground)]">
        <span>{row.email}</span>
        {row.active && <span>Using in this window</span>}
      </div>
      {row.missingHint !== undefined && <p className="mt-2 mb-0">{row.missingHint}</p>}
      {row.usage !== undefined && (
        <div className="mt-3">
          {row.usage.limits.map((l) => (
            <div key={l.label} className="mb-2 grid grid-cols-[8rem_1fr_3rem_auto] items-center gap-2 text-sm">
              <span>{l.label}</span>
              <div className="h-1.5 overflow-hidden rounded bg-[var(--vscode-panel-border)]">
                <div className="h-full bg-[var(--vscode-button-background)]" style={{ width: `${Math.min(100, Math.max(0, l.percent))}%` }} />
              </div>
              <span className="text-right">{Math.round(l.percent)}%</span>
              <span className="text-[var(--vscode-descriptionForeground)]">{l.resets ?? ''}</span>
            </div>
          ))}
          <p className="m-0 text-xs text-[var(--vscode-descriptionForeground)]">{row.usage.updated}</p>
        </div>
      )}
      <div className="mt-3 flex flex-wrap gap-2">
        {row.actions.use && <Action label={useLabel} onClick={() => send({ type: 'use', id: row.id })} />}
        {row.actions.rename && <Action label="Rename" onClick={() => send({ type: 'rename', id: row.id })} />}
        {row.actions.login && <Action label="Sign in again" onClick={() => send({ type: 'login', id: row.id })} />}
        {row.actions.delete && <Action label="Delete" onClick={() => send({ type: 'delete', id: row.id })} />}
      </div>
    </>
  );
}

function Action({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      className="rounded border border-[var(--vscode-panel-border)] bg-transparent px-2 py-1"
      onClick={onClick}
    >
      {label}
    </button>
  );
}
