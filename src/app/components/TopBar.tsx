import { useEffect, useState, useSyncExternalStore } from 'react';
import { doRedo, doUndo, setTitle, togglePanel, updateSettings, useApp } from '../store';
import { Icon } from './Icons';
import { usePresence, type PresenceState } from './motion';
import { copyShareLink, makeCopy, newConstruction, pickFileToImport, saveFile, saveImage } from '../actions';
import { cloudEnabled } from '../persistence/cloud';

export function TopBar() {
  const doc = useApp((s) => s.doc);
  const canUndo = useApp((s) => s.history.past.length > 0 || s.session.picks.length > 0);
  const canRedo = useApp((s) => s.history.future.length > 0);
  const readOnly = useApp((s) => s.readOnly);
  const menuOpen = useApp((s) => s.menuOpen);
  const menu = usePresence(menuOpen);
  const [title, setT] = useState(doc.title);
  useEffect(() => setT(doc.title), [doc.title]);

  return (
    <>
      <div className="topbar">
        <div className="topbar-left">
          <button className="icon-btn" aria-label="Menu" aria-expanded={menuOpen} onClick={() => togglePanel('menu')}>
            <Icon name="menu" />
          </button>
          <input
            className="title-input"
            value={title}
            aria-label="Construction name"
            readOnly={readOnly}
            onChange={(e) => setT(e.target.value)}
            onBlur={() => setTitle(title.trim() || 'Untitled construction')}
            onKeyDown={(e) => {
              if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
            }}
          />
        </div>
        <div className="topbar-center">
          {readOnly && <SharedBanner />}
        </div>
        <div className="topbar-right">
          <ThemeToggle />
          <button className="icon-btn" aria-label="Undo" title="Undo (Ctrl/⌘+Z)" disabled={!canUndo || readOnly} onClick={doUndo}>
            <Icon name="undo" />
          </button>
          <button className="icon-btn" aria-label="Redo" title="Redo (Ctrl/⌘+Shift+Z)" disabled={!canRedo || readOnly} onClick={doRedo}>
            <Icon name="redo" />
          </button>
        </div>
      </div>
      {menu.state && <Menu state={menu.state} />}
    </>
  );
}

function SharedBanner() {
  return (
    <div className="panel banner">
      <span>
        <strong>Shared construction.</strong> Replay it from the Steps panel.
      </span>
      <button className="chip on" onClick={() => void makeCopy()}>
        Make my copy
      </button>
    </div>
  );
}

/** Phones and touch-only tablets have no keyboard to press shortcuts on; an iPad with a trackpad does. */
const hasKeyboard = () => typeof matchMedia === 'undefined' || matchMedia('(hover: hover) and (pointer: fine)').matches;

function Menu({ state }: { state: PresenceState }) {
  const close = (fn: () => void) => () => {
    useApp.setState({ menuOpen: false });
    fn();
  };
  const readOnly = useApp((s) => s.readOnly);
  const open = (dialog: 'library' | 'settings' | 'shortcuts' | 'account') => close(() => useApp.setState({ dialog }));
  return (
    <div className="panel menu" role="menu" data-state={state} aria-hidden={state === 'closing' || undefined}>
      <button role="menuitem" onClick={close(newConstruction)}>
        New construction
      </button>
      <button role="menuitem" onClick={open('library')}>
        My constructions…
      </button>
      <hr />
      <button role="menuitem" onClick={close(pickFileToImport)}>
        Open file…
      </button>
      <button role="menuitem" onClick={close(() => void saveFile())}>
        Save as file
      </button>
      <button role="menuitem" onClick={close(() => void saveImage())}>
        Save as image
      </button>
      <button role="menuitem" onClick={close(() => void copyShareLink())}>
        Share link…
      </button>
      {readOnly && (
        <button role="menuitem" onClick={close(() => void makeCopy())}>
          Make my copy
        </button>
      )}
      <hr />
      {cloudEnabled && (
        <button role="menuitem" onClick={open('account')}>
          Account & sync…
        </button>
      )}
      <button role="menuitem" onClick={open('settings')}>
        Settings…
      </button>
      {hasKeyboard() && (
        <button role="menuitem" onClick={open('shortcuts')}>
          Keyboard shortcuts
        </button>
      )}
    </div>
  );
}

const darkQuery = typeof matchMedia !== 'undefined' ? matchMedia('(prefers-color-scheme: dark)') : null;
const subscribeDark = (cb: () => void) => {
  darkQuery?.addEventListener('change', cb);
  return () => darkQuery?.removeEventListener('change', cb);
};

/** One tap flips light ↔ dark (Settings still offers "System"). */
function ThemeToggle() {
  const pref = useApp((s) => s.settings.theme);
  const systemDark = useSyncExternalStore(subscribeDark, () => !!darkQuery?.matches);
  const dark = pref === 'dark' || (pref === 'system' && systemDark);
  return (
    <button
      className="icon-btn"
      aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
      title={dark ? 'Light mode' : 'Dark mode'}
      data-testid="theme-toggle"
      onClick={() => updateSettings({ theme: dark ? 'light' : 'dark' })}
    >
      <Icon name={dark ? 'sun' : 'moon'} />
    </button>
  );
}
