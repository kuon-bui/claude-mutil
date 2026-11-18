import { useState } from 'react';
import type { AccountRow, AccountsState, ColorOption, PanelMessage } from './types';
import { vscode } from './vscode';

function send(msg: PanelMessage): void {
  vscode.postMessage(msg);
}

export function App({ state }: { state: AccountsState | undefined }) {
  /** Hồ sơ đang mở khung Appearance (mỗi lần một hồ sơ). */
  const [editing, setEditing] = useState<string | undefined>(undefined);
  if (state === undefined) return <p className="p-4 text-[var(--vscode-descriptionForeground)]">Loading…</p>;
  return (
    <div className="mx-auto max-w-3xl p-4">
      <header className="mb-4 flex items-center justify-between gap-3">
        <h1 className="m-0 text-lg font-semibold">Accounts</h1>
        <div className="flex gap-2">
          <button
            type="button"
            className="rounded border border-[var(--vscode-panel-border)] bg-transparent px-3 py-1 disabled:opacity-60"
            disabled={state.refreshing}
            title="Fetch the latest quota for every signed-in account"
            onClick={() => send({ type: 'refresh' })}
          >
            {state.refreshing ? 'Refreshing…' : 'Refresh quota'}
          </button>
          <button
            type="button"
            className="rounded px-3 py-1 text-[var(--vscode-button-foreground)] bg-[var(--vscode-button-background)]"
            onClick={() => send({ type: 'add' })}
          >
            Add account
          </button>
        </div>
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
            <AccountCard
              row={row}
              useLabel={state.useLabel}
              palette={{ icons: state.icons, colors: state.colors }}
              editing={editing === row.id}
              onToggleEditing={() => setEditing((cur) => (cur === row.id ? undefined : row.id))}
            />
          </li>
        ))}
      </ul>
    </div>
  );
}

interface Palette { icons: string[]; colors: ColorOption[] }

function AccountCard({ row, useLabel, palette, editing, onToggleEditing }: {
  row: AccountRow; useLabel: string; palette: Palette; editing: boolean; onToggleEditing: () => void;
}) {
  return (
    <>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div className="flex items-center gap-3">
          <Avatar row={row} expanded={editing} onClick={onToggleEditing} />
          <strong>{row.name}</strong>
        </div>
        <span className="text-[var(--vscode-descriptionForeground)]">{row.kind}</span>
      </div>
      <div className="mt-1 flex flex-wrap justify-between gap-2 text-[var(--vscode-descriptionForeground)]">
        <span>{row.email}</span>
        {row.active && <span>Using in this window</span>}
      </div>
      {editing && <AppearanceEditor row={row} palette={palette} onDone={onToggleEditing} />}
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
          <p className="m-0 text-xs text-[var(--vscode-descriptionForeground)]">{row.refreshing ? 'Refreshing quota…' : row.usage.updated}</p>
        </div>
      )}
      {row.usage === undefined && row.refreshing && (
        <p className="mt-3 mb-0 text-xs text-[var(--vscode-descriptionForeground)]">Refreshing quota…</p>
      )}
      <div className="mt-3 flex flex-wrap gap-2">
        {row.actions.use && <Action label={useLabel} onClick={() => send({ type: 'use', id: row.id })} />}
        {row.actions.rename && <Action label="Rename" onClick={() => send({ type: 'rename', id: row.id })} />}
        {row.actions.appearance && (
          <Action label={editing ? 'Done' : 'Appearance'} expanded={editing} onClick={onToggleEditing} />
        )}
        {row.actions.login && <Action label="Sign in again" onClick={() => send({ type: 'login', id: row.id })} />}
        {row.actions.delete && <Action label="Delete" onClick={() => send({ type: 'delete', id: row.id })} />}
      </div>
    </>
  );
}

/** Nền avatar/ô icon: màu hồ sơ pha nhạt, đọc được ở cả theme sáng lẫn tối. */
const tint = (color: string, percent = 18) => `color-mix(in srgb, ${color} ${percent}%, transparent)`;

/**
 * Avatar tròn: codicon của hồ sơ trên nền màu hồ sơ pha nhạt. Hồ sơ đang dùng có vòng viền đậm. Bấm vào để mở/đóng
 * khung Appearance.
 */
function Avatar({ row, expanded, onClick }: { row: AccountRow; expanded: boolean; onClick: () => void }) {
  const ring = row.active
    ? `0 0 0 2px var(--vscode-editor-background), 0 0 0 4px ${row.color}`
    : `inset 0 0 0 1px ${tint(row.color, 45)}`;
  return (
    <button
      type="button"
      className="flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-full border-0 p-0"
      style={{ color: row.color, background: tint(row.color), boxShadow: ring }}
      title={row.active ? `${row.name} (in use) · Change icon and color` : `${row.name} · Change icon and color`}
      aria-label={`Change icon and color for ${row.name}`}
      aria-expanded={expanded}
      onClick={onClick}
    >
      <i className={`codicon codicon-${row.icon}`} style={{ fontSize: 18 }} aria-hidden="true" />
    </button>
  );
}

/** Chọn màu và icon cùng một chỗ; bấm là áp dụng ngay (avatar và thanh trạng thái đổi theo). Esc để đóng. */
function AppearanceEditor({ row, palette, onDone }: { row: AccountRow; palette: Palette; onDone: () => void }) {
  return (
    <div
      className="mt-3 rounded border border-[var(--vscode-panel-border)] p-3"
      role="group"
      aria-label={`Appearance of ${row.name}`}
      onKeyDown={(e) => { if (e.key === 'Escape') onDone(); }}
    >
      <p className="mt-0 mb-2 text-xs uppercase tracking-wide text-[var(--vscode-descriptionForeground)]">Color</p>
      <div className="mb-3 flex flex-wrap gap-2" role="radiogroup" aria-label="Color">
        {palette.colors.map((c) => {
          const selected = c.id === row.colorId;
          return (
            <button
              key={c.id}
              type="button"
              role="radio"
              aria-checked={selected}
              aria-label={c.label}
              title={c.label}
              className="size-6 cursor-pointer rounded-full border-0 p-0"
              style={{
                background: c.css,
                boxShadow: selected ? `0 0 0 2px var(--vscode-editor-background), 0 0 0 4px ${c.css}` : undefined,
              }}
              onClick={() => { if (!selected) send({ type: 'appearance', id: row.id, color: c.id }); }}
            />
          );
        })}
      </div>
      <p className="mt-0 mb-2 text-xs uppercase tracking-wide text-[var(--vscode-descriptionForeground)]">Icon</p>
      <div className="grid grid-cols-[repeat(auto-fill,2rem)] gap-1" role="radiogroup" aria-label="Icon">
        {palette.icons.map((icon) => {
          const selected = icon === row.icon;
          return (
            <button
              key={icon}
              type="button"
              role="radio"
              aria-checked={selected}
              aria-label={icon}
              title={icon}
              className="flex size-8 cursor-pointer items-center justify-center rounded border-0 bg-transparent p-0 text-[var(--vscode-foreground)] hover:bg-[var(--vscode-toolbar-hoverBackground)]"
              style={selected ? { color: row.color, background: tint(row.color), boxShadow: `inset 0 0 0 1px ${row.color}` } : undefined}
              onClick={() => { if (!selected) send({ type: 'appearance', id: row.id, icon }); }}
            >
              <i className={`codicon codicon-${icon}`} style={{ fontSize: 16 }} aria-hidden="true" />
            </button>
          );
        })}
      </div>
    </div>
  );
}

function Action({ label, onClick, expanded }: { label: string; onClick: () => void; expanded?: boolean }) {
  return (
    <button
      type="button"
      className="rounded border border-[var(--vscode-panel-border)] bg-transparent px-2 py-1"
      aria-expanded={expanded}
      onClick={onClick}
    >
      {label}
    </button>
  );
}
