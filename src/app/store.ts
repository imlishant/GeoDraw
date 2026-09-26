import { create } from 'zustand';
import type { Doc, GeoObject, Id, Values } from '../engine/types';
import { commit, emptyHistory, newDoc, redo, undo, type History, type Patch } from '../engine/doc';
import { evaluateDoc } from '../engine/evaluate';
import { checkSolution } from '../engine/checker';
import { PROBLEMS, type Problem } from '../engine/problems';
import { STRICT_TOOLS, TOOL_BY_KEY, type Pick, type ToolKey } from './tools';
import { lsGet, lsSet, recordSolve, rememberAttempt } from './persistence/library';

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

export type Dialog = null | 'library' | 'problems' | 'settings' | 'shortcuts' | 'account' | 'about';

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
  zoom: number;
  scrub: number | null; // replay: show only the first n steps
  stepHover: Id[];
  readOnly: boolean;
  solved: boolean;
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
  zoom: 1,
  scrub: null,
  stepHover: [],
  readOnly: false,
  solved: false,
  popoverAt: null,
}));

const get = useApp.getState;
const set = useApp.setState;

// ---- document ---------------------------------------------------------------

export function problemOf(doc: Doc): Problem | undefined {
  return doc.problemId ? PROBLEMS.find((p) => p.id === doc.problemId) : undefined;
}

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
    solved: false,
    popoverAt: null,
  });
  if (doc.problemId) {
    void rememberAttempt(doc.problemId, doc.id);
    runProblemCheck(false);
  }
}

export function applyPatch(p: Patch) {
  const s = get();
  if (s.readOnly) return;
  const r = commit(s.doc, s.history, p);
  set({ doc: r.doc, history: r.history, values: evaluateDoc(r.doc), scrub: null });
  runProblemCheck(true);
}

export function doUndo() {
  const s = get();
  if (s.session.picks.length) return clearSession();
  const r = undo(s.doc, s.history);
  if (!r) return;
  set({ doc: r.doc, history: r.history, values: evaluateDoc(r.doc), selection: [], scrub: null, popoverAt: null });
  runProblemCheck(false);
}

export function doRedo() {
  const s = get();
  const r = redo(s.doc, s.history);
  if (!r) return;
  set({ doc: r.doc, history: r.history, values: evaluateDoc(r.doc), selection: [], scrub: null });
  runProblemCheck(false);
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
  const problem = problemOf(s.doc);
  if (problem) return (problem.tools as ToolKey[]).includes(key);
  if (s.settings.strict) return STRICT_TOOLS.includes(key);
  return true;
}

export function setTool(key: ToolKey) {
  if (!isToolAllowed(key)) {
    const problem = problemOf(get().doc);
    toast(problem ? 'That tool is not allowed in this problem' : 'Strict mode: only Point, Line, Circle and Intersect', 'info');
    return;
  }
  const t = TOOL_BY_KEY[key];
  const main = t.group === 'main';
  set((s) => ({
    tool: key,
    session: { picks: [], pending: [] },
    moreOpen: false,
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

// ---- problem mode -----------------------------------------------------------

function runProblemCheck(announce: boolean) {
  const s = get();
  const problem = problemOf(s.doc);
  if (!problem) return;
  const res = checkSolution(s.doc, problem.targets);
  const was = s.solved;
  set({ solved: res.solved });
  if (res.solved && !was && announce) {
    toast('Solved ✓', 'success', 4000);
    void recordSolve(problem.id, s.doc.id);
  }
}
