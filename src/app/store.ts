import { create } from 'zustand';
import type { Doc, GeoObject, Id, PointDef, Values } from '../engine/types';
import { commit, emptyHistory, newDoc, redo, setObjectsPatch, undo, type History, type Patch } from '../engine/doc';
import { evaluateDoc } from '../engine/evaluate';
import { STRICT_TOOLS, TOOL_BY_KEY, type Pick, type ToolKey } from './tools';
import { lsGet, lsSet } from './persistence/library';

export interface Settings {
  theme: 'system' | 'light' | 'dark';
  strict: boolean;
  pointLabels: boolean;
  decimals: number;
  canvasMeasures: boolean;
  pins: ToolKey[];
}

const DEFAULT_SETTINGS: Settings = {
  theme: 'system',
  strict: false,
  pointLabels: true,
  decimals: 3,
  canvasMeasures: true,
  pins: [],
};

export interface Toast {
  id: number;
  text: string;
  kind: 'info' | 'error' | 'success';
}

export interface PromptState {
  label: string;
  value: string;
  unit?: string;
  onSubmit: (value: number) => void;
}

export interface ConfirmState {
  message: string;
  confirmLabel: string;
  onConfirm: () => void;
}

export type Dialog = null | 'library' | 'settings' | 'shortcuts' | 'account';

export interface Session {
  picks: Pick[];
  pending: GeoObject[]; // points created while picking, committed with the step
}

export interface AppState {
  doc: Doc;
  history: History;
  values: Values;
  tool: ToolKey;
  session: Session;
  selection: Id[];
  settings: Settings;
  // UI
  moreOpen: boolean;
  stepsOpen: boolean;
  stepsTab: 'steps' | 'objects' | 'measures';
  menuOpen: boolean;
  dialog: Dialog;
  prompt: PromptState | null;
  confirm: ConfirmState | null;
  toasts: Toast[];
  lastMore: ToolKey | null;
  scrub: number | null; // replay: show only the first n steps
  stepHover: Id[];
  readOnly: boolean;
  /**
   * Restore after moving: original position of every point dragged since the last
   * construction. In memory only (gone on reload). null = no moving session.
   */
  moveSession: Record<Id, PointDef> | null;
  popoverAt: { x: number; y: number } | null;
}

const initialDoc = newDoc();

export const useApp = create<AppState>(() => ({
  doc: initialDoc,
  history: emptyHistory(),
  values: new Map(),
  tool: 'move',
  session: { picks: [], pending: [] },
  selection: [],
  settings: { ...DEFAULT_SETTINGS, ...lsGet<Partial<Settings>>('drawgeo.settings', {}) },
  moreOpen: false,
  stepsOpen: false,
  stepsTab: 'steps',
  menuOpen: false,
  dialog: null,
  prompt: null,
  confirm: null,
  toasts: [],
  lastMore: null,
  scrub: null,
  stepHover: [],
  readOnly: false,
  moveSession: null,
  popoverAt: null,
}));

const get = useApp.getState;
const set = useApp.setState;

// ---- document ---------------------------------------------------------------

export function loadDoc(doc: Doc, opts: { readOnly?: boolean } = {}) {
  set({
    doc,
    history: emptyHistory(),
    values: evaluateDoc(doc),
    session: { picks: [], pending: [] },
    selection: [],
    scrub: null,
    stepHover: [],
    readOnly: !!opts.readOnly,
    tool: 'move',
    popoverAt: null,
    moveSession: null,
  });
}

/** Adds or removes objects (a construction, a delete): the figure's structure changed. */
const changesStructure = (p: Patch) => !!p.order;

export function applyPatch(p: Patch) {
  const s = get();
  // viewers of a shared link may only move points (and restore them); nothing is saved for them
  if (s.readOnly && (p.order || p.steps || p.measures || p.title)) return;
  const r = commit(s.doc, s.history, p);
  set({ doc: r.doc, history: r.history, values: evaluateDoc(r.doc), scrub: null, ...(changesStructure(p) ? { moveSession: null } : {}) });
}

// ---- restore after moving ----------------------------------------------------

/** Called when a drag is committed: remember where the point was before the session began. */
export function noteMoved(id: Id, original: PointDef) {
  const cur = get().moveSession;
  if (cur && id in cur) return; // keep the ORIGINAL position, not an in-between one
  set({ moveSession: { ...(cur ?? {}), [id]: original } });
}

/** Moved points that are currently not at their original position. */
export function movedIds(s: AppState = get()): Id[] {
  if (!s.moveSession) return [];
  return Object.entries(s.moveSession)
    .filter(([id, def]) => {
      const o = s.doc.objects[id];
      return o && o.kind === 'point' && JSON.stringify(o.def) !== JSON.stringify(def);
    })
    .map(([id]) => id);
}

/** Put every moved point back, as one undoable step. The session stays, so undo shows the button again. */
export function restoreMoved() {
  const s = get();
  const ids = movedIds(s);
  if (!ids.length || !s.moveSession) return;
  const back = ids.map((id) => ({ ...s.doc.objects[id], def: s.moveSession![id] }) as GeoObject);
  applyPatch(setObjectsPatch(s.doc, back, 'Restore moved points'));
  toast('Moved points put back', 'info', 1600);
}

export function doUndo() {
  const s = get();
  if (s.session.picks.length) return clearSession();
  const p = s.history.past[s.history.past.length - 1];
  const r = undo(s.doc, s.history);
  if (!r) return;
  set({ doc: r.doc, history: r.history, values: evaluateDoc(r.doc), selection: [], scrub: null, popoverAt: null, ...(p && changesStructure(p) ? { moveSession: null } : {}) });
}

export function doRedo() {
  const s = get();
  const p = s.history.future[0];
  const r = redo(s.doc, s.history);
  if (!r) return;
  set({ doc: r.doc, history: r.history, values: evaluateDoc(r.doc), selection: [], scrub: null, ...(p && changesStructure(p) ? { moveSession: null } : {}) });
}

export function setTitle(title: string) {
  const s = get();
  if (title === s.doc.title) return;
  applyPatch({ label: 'Rename', title: [s.doc.title, title] });
}

// ---- tools ------------------------------------------------------------------

export function clearSession() {
  set({ session: { picks: [], pending: [] } });
}

export function isToolAllowed(key: ToolKey, s: AppState = get()): boolean {
  if (s.readOnly) return key === 'move';
  const t = TOOL_BY_KEY[key];
  if (t.role !== 'construct') return true;
  if (s.settings.strict) return STRICT_TOOLS.includes(key);
  return true;
}

// ---- panels: only one of menu / Steps book / More is open at a time ------------

export type Panel = 'menu' | 'steps' | 'more';

const panelsClosed = { menuOpen: false, stepsOpen: false, moreOpen: false, scrub: null, stepHover: [] as Id[] };

/** Open one panel (closing the others), or close it if it's already open. */
export function togglePanel(p: Panel) {
  const s = get();
  const isOpen = p === 'menu' ? s.menuOpen : p === 'steps' ? s.stepsOpen : s.moreOpen;
  set({ ...panelsClosed, ...(isOpen ? {} : { [`${p}Open`]: true }) });
}

export function closePanels() {
  set(panelsClosed);
}

export function setTool(key: ToolKey) {
  if (!isToolAllowed(key)) {
    toast('Strict mode: only Point, Line, Circle and Intersect', 'info');
    return;
  }
  const t = TOOL_BY_KEY[key];
  const main = t.group === 'main';
  set((s) => ({
    ...panelsClosed, // picking a tool clears the side panels away
    tool: key,
    session: { picks: [], pending: [] },
    selection: key === 'move' ? s.selection : [],
    popoverAt: null,
    lastMore: main || s.settings.pins.includes(key) ? s.lastMore : key,
  }));
}

// ---- settings ---------------------------------------------------------------

export function updateSettings(patch: Partial<Settings>) {
  const settings = { ...get().settings, ...patch };
  set({ settings });
  lsSet('drawgeo.settings', settings);
}

export function togglePin(key: ToolKey, max: number) {
  const pins = get().settings.pins;
  if (pins.includes(key)) updateSettings({ pins: pins.filter((k) => k !== key) });
  else if (pins.length >= max) toast(`You can pin up to ${max} tools. Unpin one first.`, 'info');
  else updateSettings({ pins: [...pins, key] });
}

// ---- feedback ---------------------------------------------------------------

let toastId = 0;
export function toast(text: string, kind: Toast['kind'] = 'info', ms = 3200) {
  const id = ++toastId;
  set((s) => ({ toasts: [...s.toasts.slice(-2), { id, text, kind }] }));
  setTimeout(() => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })), ms);
}

export function askNumber(p: PromptState) {
  set({ prompt: p });
}

export function askConfirm(c: ConfirmState) {
  set({ confirm: c });
}
