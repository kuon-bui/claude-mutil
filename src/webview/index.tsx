import { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import type { AccountsLocation, AccountsState } from './types';
import { vscode } from './vscode';

const root = document.getElementById('root');
if (root === null) throw new Error('missing #root');

function Host() {
  const [state, setState] = useState<AccountsState | undefined>(undefined);
  const [location, setLocation] = useState<AccountsLocation>('editor');
  useEffect(() => {
    const onMessage = (event: MessageEvent<{ type?: string; payload?: AccountsState; location?: AccountsLocation }>) => {
      if (event.data?.type !== 'state') return;
      setState(event.data.payload);
      if (event.data.location !== undefined) setLocation(event.data.location);
    };
    window.addEventListener('message', onMessage);
    vscode.postMessage({ type: 'ready' });
    return () => window.removeEventListener('message', onMessage);
  }, []);
  return <App state={state} location={location} />;
}

createRoot(root).render(<Host />);
