import { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import type { AccountsState } from './types';
import { vscode } from './vscode';

const root = document.getElementById('root');
if (root === null) throw new Error('missing #root');

function Host() {
  const [state, setState] = useState<AccountsState | undefined>(undefined);
  useEffect(() => {
    const onMessage = (event: MessageEvent<{ type?: string; payload?: AccountsState }>) => {
      if (event.data?.type === 'state') setState(event.data.payload);
    };
    window.addEventListener('message', onMessage);
    vscode.postMessage({ type: 'ready' });
    return () => window.removeEventListener('message', onMessage);
  }, []);
  return <App state={state} />;
}

createRoot(root).render(<Host />);
