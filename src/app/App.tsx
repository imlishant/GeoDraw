import { useEffect } from 'react';
import { CanvasView } from './components/CanvasView';
import { TopBar } from './components/TopBar';
import { Toolbar } from './components/Toolbar';
import { StepsButton, StepsDrawer } from './components/StepsDrawer';
import { SelectionPopover } from './components/Popover';
import { Dialogs } from './components/Dialogs';
import { Toasts, ZoomControls } from './components/Chrome';
import { controller, deleteWithConfirm } from './controller';
import { clearSession, doRedo, doUndo, loadDoc, setTool, toast, useApp } from './store';
import { applyThemeVars, DARK, LIGHT } from '../render/theme';
import { setObjectsPatch } from '../engine/doc';
import { applyPatch } from './store';
import { TOOLS } from './tools';
import { loadLocal, lsGet, lsSet, saveLocal } from './persistence/library';
import { decodeShare, readShareToken } from './persistence/share';
import { cloudEnabled, currentUser, onAuthChange, saveCloud, type CloudUser } from './persistence/cloud';

function useTheme() {
  const pref = useApp((s) => s.settings.theme);
  useEffect(() => {
    const mq = matchMedia('(prefers-color-scheme: dark)');
    const apply = () => {
      const dark = pref === 'dark' || (pref === 'system' && mq.matches);
      const t = dark ? DARK : LIGHT;
      applyThemeVars(t);
      controller.theme = t;
      controller.invalidate();
    };
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, [pref]);
}

async function startup() {
  const token = readShareToken();
  if (token) {
    try {
      loadDoc(await decodeShare(token), { readOnly: true });
      return;
    } catch (e) {
      toast(`Could not open the shared link: ${(e as Error).message}`, 'error', 5000);
    }
  }
  const id = lsGet<string | null>('drawgeo.current', null);
  const doc = id ? await loadLocal(id) : undefined;
  if (doc) loadDoc(doc);
  else {
    lsSet('drawgeo.current', useApp.getState().doc.id);
    if (!lsGet('drawgeo.welcomed', false)) {
      lsSet('drawgeo.welcomed', true);
      toast('Pick a tool below to start, or open Problems from the menu ☰', 'info', 6000);
    }
  }
}

function useAutosave() {
  useEffect(() => {
    let timer = 0;
    let cloudTimer = 0;
    let user: CloudUser | null = null;
    let off = () => {};
    if (cloudEnabled) {
      void currentUser().then((u) => (user = u));
      void onAuthChange((u) => (user = u)).then((f) => (off = f));
    }
    const unsub = useApp.subscribe((s, prev) => {
      if (s.doc === prev.doc || s.readOnly) return;
      if (s.doc.id !== prev.doc.id) lsSet('drawgeo.current', s.doc.id);
      clearTimeout(timer);
      timer = window.setTimeout(() => {
        const d = useApp.getState().doc;
        if (d.order.length || d.steps.length) void saveLocal(d);
      }, 500);
      if (user) {
        clearTimeout(cloudTimer);
        cloudTimer = window.setTimeout(() => {
          const d = useApp.getState().doc;
          if (user && (d.order.length || d.steps.length)) saveCloud(d, user.id).catch(() => toast('Cloud sync failed; your work is still saved in this browser', 'error'));
        }, 2000);
      }
    });
    return () => {
      unsub();
      off();
    };
  }, []);
}

function isTyping(e: KeyboardEvent) {
  const t = e.target as HTMLElement | null;
  return !!t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable);
}

function useKeyboard() {
  useEffect(() => {
    const byKey = new Map(TOOLS.filter((t) => t.shortcut).map((t) => [t.shortcut!.toLowerCase(), t.key]));
    const down = (e: KeyboardEvent) => {
      if (isTyping(e)) return;
      const s = useApp.getState();
      const mod = e.metaKey || e.ctrlKey;
      const k = e.key.toLowerCase();
      if (mod && k === 'z') {
        e.preventDefault();
        if (e.shiftKey) doRedo();
        else doUndo();
        return;
      }
      if (mod && k === 'y') {
        e.preventDefault();
        doRedo();
        return;
      }
      if (mod) return;
      if (e.key === ' ') {
        controller.spaceDown = true;
        e.preventDefault();
        return;
      }
      if (e.key === 'Escape') {
        if (s.prompt || s.confirm || s.dialog) return useApp.setState({ prompt: null, confirm: null, dialog: null });
        if (s.menuOpen || s.moreOpen || s.popoverAt) return useApp.setState({ menuOpen: false, moreOpen: false, popoverAt: null });
        if (s.session.picks.length) return clearSession();
        if (s.tool !== 'move') return setTool('move');
        return useApp.setState({ selection: [] });
      }
      if (s.prompt || s.confirm || s.dialog) return;
      if (e.key === 'Enter') return controller.closePolygon();
      if ((e.key === 'Delete' || e.key === 'Backspace') && s.selection.length && !s.readOnly) {
        e.preventDefault();
        return deleteWithConfirm(s.selection);
      }
      if (k === 'h' && s.selection.length && !s.readOnly) {
        const objs = s.selection.map((id) => s.doc.objects[id]).filter((o) => o && !o.given);
        if (objs.length) applyPatch(setObjectsPatch(s.doc, objs.map((o) => ({ ...o, hidden: !o.hidden })), 'Hide'));
        return;
      }
      if (k === 'm' && !s.readOnly) return useApp.setState({ moreOpen: !s.moreOpen });
      if (k === 'j') return useApp.setState({ stepsOpen: !s.stepsOpen });
      if (k === '1') return controller.zoomToFit();
      if (k === '0') return controller.resetZoom();
      if (k === '+' || k === '=') return controller.zoomBy(1.25);
      if (k === '-' || k === '_') return controller.zoomBy(1 / 1.25);
      const tool = byKey.get(k);
      if (tool && !s.readOnly) setTool(tool);
    };
    const up = (e: KeyboardEvent) => {
      if (e.key === ' ') controller.spaceDown = false;
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    };
  }, []);
}

export function App() {
  useTheme();
  useAutosave();
  useKeyboard();
  useEffect(() => {
    void startup();
    const onHash = () => void startup();
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);
  return (
    <div className="app">
      <CanvasView />
      <TopBar />
      <StepsButton />
      <StepsDrawer />
      <Toolbar />
      <ZoomControls />
      <SelectionPopover />
      <Toasts />
      <Dialogs />
    </div>
  );
}
