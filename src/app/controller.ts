// Input + render loop. Lives outside React: pointer moves and drags never cause
// React re-renders (PLAN.md §7). React only renders the chrome around the canvas.

import type { Geo, GeoObject, Id, Kind, Measure, Values, Vec } from '../engine/types';
import { addStepPatch, dependentsClosure, deletePatch, newId, nextName, setObjectsPatch } from '../engine/doc';
import { downstream, evalObject, evaluateDoc, reevaluate } from '../engine/evaluate';
import { build } from '../engine/build';
import { measureValue } from '../engine/measure';
import { Renderer, isDraggable, type CanvasMeasure, type OverlayInput } from '../render/renderer';
import { clampPan, fit, panBy, toScreen, toWorld, zoomAt, type Camera } from '../render/camera';
import { boundingBox, nearestPoint, objectAt, paramOn, snap, virtualIntersections, type HitScene, type Snap } from '../render/hit';
import { LIGHT, type Theme } from '../render/theme';
import { DISTINCT_POINTS, TOOL_BY_KEY, type Pick, type ToolUI } from './tools';
import { applyPatch, askConfirm, askNumber, clearSession, problemOf, toast, useApp, type AppState } from './store';
import { formatNumber } from './format';

type Gesture =
  | { k: 'tap'; x0: number; y0: number; type: string; shift: boolean }
  | { k: 'pan'; lastX: number; lastY: number }
  | { k: 'drag'; id: Id; dx: number; dy: number; moved: boolean }
  | { k: 'pinch'; d0: number; cam0: Camera; world0: Vec }
  | { k: 'box'; x0: number; y0: number; x1: number; y1: number };

const TAP_SLOP = { mouse: 5, pen: 6, touch: 10 } as Record<string, number>;

function tolerances(type: string) {
  return type === 'touch' ? { point: 22, curve: 16 } : { point: 11, curve: 8 };
}

export class Controller {
  renderer: Renderer | null = null;
  el: HTMLElement | null = null;
  cam: Camera = { cx: 0, cy: 0, zoom: 1 };
  theme: Theme = LIGHT;
  coarse = typeof matchMedia !== 'undefined' && matchMedia('(pointer: coarse)').matches;
  spaceDown = false;

  private pointers = new Map<number, { x: number; y: number; type: string }>();
  private gesture: Gesture | null = null;
  private live: { values: Values; override: Map<Id, GeoObject>; ids: Id[] } | null = null;
  private overlay: Omit<OverlayInput, 'cam' | 'theme' | 'coarse'> = { ghosts: [], pending: [], snap: null, candidates: [], box: null };
  private hoverId: Id | null = null;
  private lastPointerType = 'mouse';
  private raf = 0;
  private sceneDirty = true;
  private overlayDirty = true;
  private lastLiveSync = 0;
  private sessionCache: { key: unknown; values: Values } | null = null;
  private unsub: (() => void) | null = null;
  private cleanup: Array<() => void> = [];

  // ---- lifecycle ------------------------------------------------------------

  attach(el: HTMLElement, scene: HTMLCanvasElement, overlay: HTMLCanvasElement) {
    this.el = el;
    this.renderer = new Renderer(scene, overlay);
    const ro = new ResizeObserver(() => this.resize());
    ro.observe(el);
    this.cleanup.push(() => ro.disconnect());
    this.resize();
    this.initialCamera();

    const on = <K extends keyof HTMLElementEventMap>(type: K, fn: (e: HTMLElementEventMap[K]) => void, opts?: AddEventListenerOptions) => {
      el.addEventListener(type, fn as EventListener, opts);
      this.cleanup.push(() => el.removeEventListener(type, fn as EventListener, opts));
    };
    on('pointerdown', (e) => this.onDown(e));
    on('pointermove', (e) => this.onMove(e));
    on('pointerup', (e) => this.onUp(e));
    on('pointercancel', (e) => this.onCancel(e));
    on('pointerleave', () => {
      if (!this.gesture) this.clearHover();
    });
    on('wheel', (e) => this.onWheel(e), { passive: false });
    on('contextmenu', (e) => {
      e.preventDefault();
      if (useApp.getState().session.picks.length) clearSession();
    });
    // Safari (macOS trackpad) sends gesture events for pinch instead of ctrl+wheel.
    let g0: { zoom: number } | null = null;
    const gs = (e: Event) => {
      e.preventDefault();
      g0 = { zoom: this.cam.zoom };
    };
    const gc = (e: Event) => {
      e.preventDefault();
      const ge = e as Event & { scale: number; clientX: number; clientY: number };
      if (!g0) return;
      const r = el.getBoundingClientRect();
      this.setCam(zoomAt(this.cam, this.vp(), ge.clientX - r.left, ge.clientY - r.top, (g0.zoom * ge.scale) / this.cam.zoom));
    };
    el.addEventListener('gesturestart', gs);
    el.addEventListener('gesturechange', gc);
    this.cleanup.push(() => {
      el.removeEventListener('gesturestart', gs);
      el.removeEventListener('gesturechange', gc);
    });

    this.unsub = useApp.subscribe((s, prev) => {
      if (s.doc !== prev.doc && s.doc.id !== prev.doc.id) this.initialCamera();
      if (s.tool !== prev.tool || s.session !== prev.session) this.refreshHover();
      this.sceneDirty = true;
      this.overlayDirty = true;
      this.schedule();
    });
    void document.fonts?.ready.then(() => this.invalidate());
  }

  detach() {
    this.unsub?.();
    this.cleanup.forEach((f) => f());
    this.cleanup = [];
    cancelAnimationFrame(this.raf);
    this.raf = 0; // otherwise schedule() thinks a frame is pending forever after a remount
    this.renderer = null;
    this.el = null;
    this.pointers.clear();
    this.gesture = null;
    this.live = null;
  }

  invalidate() {
    this.sceneDirty = true;
    this.overlayDirty = true;
    this.schedule();
  }

  private vp() {
    return this.renderer?.vp ?? { w: 1, h: 1 };
  }

  private resize() {
    if (!this.el || !this.renderer) return;
    const r = this.el.getBoundingClientRect();
    this.renderer.resize(r.width, r.height, window.devicePixelRatio || 1);
    this.invalidate();
  }

  /** Screen area covered by the top bar / banner and the bottom toolbar. */
  private insets() {
    const vp = this.vp();
    const s = useApp.getState();
    const phone = vp.w < 600;
    const top = (phone ? 70 : 76) + (s.doc.problemId || s.readOnly ? (phone ? 90 : 60) : 0);
    const bottom = phone ? 150 : 130;
    const side = phone ? 16 : Math.min(80, vp.w * 0.08);
    return { top, bottom, left: side, right: side };
  }

  initialCamera() {
    const s = useApp.getState();
    const box = boundingBox(s.doc, s.values);
    const vp = this.vp();
    if (box && !s.doc.steps.length) {
      // Only givens so far: frame a square region 1.8× their size so there is room to
      // construct around them (Euclidea frames its problems the same way).
      const side = 1.8 * Math.max(box.maxX - box.minX, box.maxY - box.minY, 100);
      const cx = (box.minX + box.maxX) / 2;
      const cy = (box.minY + box.maxY) / 2;
      this.setCam(fit({ minX: cx - side / 2, maxX: cx + side / 2, minY: cy - side / 2, maxY: cy + side / 2 }, vp, this.insets(), 1, 1.5));
    } else if (box) this.setCam(fit(box, vp, this.insets(), 0.92, 1.5));
    else this.setCam({ cx: 0, cy: 0, zoom: Math.min(1, Math.min(vp.w, vp.h) / 520) || 1 });
  }

  setCam(c: Camera) {
    const s = useApp.getState();
    this.cam = clampPan(c, this.vp(), boundingBox(s.doc, s.values));
    if (s.zoom !== this.cam.zoom) useApp.setState({ zoom: this.cam.zoom });
    this.invalidate();
  }

  zoomBy(factor: number) {
    const vp = this.vp();
    this.setCam(zoomAt(this.cam, vp, vp.w / 2, vp.h / 2, factor));
  }

  zoomToFit() {
    const s = useApp.getState();
    const vp = this.vp();
    const box = boundingBox(s.doc, s.values);
    this.setCam(box ? fit(box, vp, this.insets(), 0.92) : { cx: 0, cy: 0, zoom: 1 });
  }

  resetZoom() {
    this.setCam({ ...this.cam, zoom: 1 });
  }

  // ---- scene data -----------------------------------------------------------

  /** Values including points created during the current tool session. */
  private sessionValues(s: AppState = useApp.getState()): Values {
    const base = this.live?.values ?? s.values;
    if (!s.session.pending.length) return base;
    const key = [base, s.session];
    if (this.sessionCache && this.sessionCache.key && (this.sessionCache.key as unknown[])[0] === base && (this.sessionCache.key as unknown[])[1] === s.session) {
      return this.sessionCache.values;
    }
    const vals = new Map(base);
    for (const o of s.session.pending) vals.set(o.id, evalObject(o, (id) => vals.get(id)));
    this.sessionCache = { key, values: vals };
    return vals;
  }

  private visibleFn(s: AppState): (o: GeoObject) => boolean {
    let allowed: Set<Id> | null = null;
    if (s.scrub !== null) {
      allowed = new Set();
      for (const id of s.doc.order) if (s.doc.objects[id]?.given) allowed.add(id);
      for (const st of s.doc.steps.slice(0, s.scrub)) st.outputs.forEach((o) => allowed!.add(o));
    }
    const showHidden = s.tool === 'showHide';
    return (o) => (allowed ? allowed.has(o.id) : true) && (!o.hidden || showHidden);
  }

  private scene(s: AppState = useApp.getState()): HitScene {
    const extra = new Map(s.session.pending.map((o) => [o.id, o]));
    return { doc: s.doc, values: this.sessionValues(s), extra, visible: this.visibleFn(s) };
  }

  private canvasMeasures(s: AppState, values: Values): CanvasMeasure[] {
    if (!s.settings.canvasMeasures) return [];
    const out: CanvasMeasure[] = [];
    const pt = (id: Id): Vec | null => {
      const g = values.get(id);
      return g && g.k === 'point' ? g : null;
    };
    for (const m of s.doc.measures) {
      const v = measureValue(m, values);
      if (v.value === null) continue;
      const text = `${formatNumber(v.value, s.settings.decimals)}${v.unit}`;
      if (m.t === 'distance') {
        const a = pt(m.a);
        const b = pt(m.b);
        if (a && b) out.push({ kind: 'distance', refs: [a, b], text });
      } else if (m.t === 'angle') {
        const a = pt(m.a);
        const vv = pt(m.v);
        const b = pt(m.b);
        if (a && vv && b) out.push({ kind: 'angle', refs: [a, vv, b], text });
      } else {
        const g = values.get(m.of);
        if (!g) continue;
        const anchor =
          g.k === 'region'
            ? { x: g.pts.reduce((x, p) => x + p.x, 0) / g.pts.length, y: g.pts.reduce((y, p) => y + p.y, 0) / g.pts.length }
            : g.k === 'circle'
              ? { x: g.cx, y: g.cy }
              : null;
        if (anchor) out.push({ kind: 'area', refs: [anchor], text: `A = ${text}` });
      }
    }
    return out;
  }

  // ---- render loop ----------------------------------------------------------

  private schedule() {
    if (this.raf) return;
    this.raf = requestAnimationFrame(() => {
      this.raf = 0;
      this.frame();
    });
  }

  private frame() {
    const r = this.renderer;
    if (!r) return;
    const s = useApp.getState();
    if (this.sceneDirty) {
      this.sceneDirty = false;
      const values = this.live?.values ?? s.values;
      const highlight = new Set<Id>([...s.selection, ...s.stepHover, ...s.session.picks.map((p) => p.id)]);
      if (this.hoverId) highlight.add(this.hoverId);
      r.drawScene({
        doc: s.doc,
        values,
        cam: this.cam,
        theme: this.theme,
        visible: this.visibleFn(s),
        faint: (o) => !!o.hidden,
        highlight,
        showPointLabels: s.settings.pointLabels,
        measures: this.canvasMeasures(s, values),
        coarse: this.coarse,
      });
    }
    if (this.overlayDirty) {
      this.overlayDirty = false;
      const vals = this.sessionValues(s);
      const pending = s.session.pending.map((o) => vals.get(o.id)).filter((g): g is Geo & Vec => !!g && g.k === 'point');
      r.drawOverlay({ ...this.overlay, pending, cam: this.cam, theme: this.theme, coarse: this.coarse });
    }
  }

  // ---- pointer input --------------------------------------------------------

  private local(e: PointerEvent | WheelEvent | MouseEvent): Vec {
    const r = this.el!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  private onDown(e: PointerEvent) {
    const p = this.local(e);
    this.lastPointerType = e.pointerType;
    this.pointers.set(e.pointerId, { ...p, type: e.pointerType });
    this.el!.setPointerCapture?.(e.pointerId);
    const s = useApp.getState();
    if (s.menuOpen || s.moreOpen) useApp.setState({ menuOpen: false, moreOpen: false });

    if (this.pointers.size === 2) {
      // second finger: switch to pinch, abandon whatever the first finger started
      this.abortDrag();
      const [a, b] = [...this.pointers.values()];
      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      this.gesture = { k: 'pinch', d0: Math.hypot(a.x - b.x, a.y - b.y) || 1, cam0: this.cam, world0: toWorld(this.cam, this.vp(), mid.x, mid.y) };
      this.clearHover();
      return;
    }
    if (this.pointers.size > 2) return;

    if (e.button === 1 || this.spaceDown) {
      this.gesture = { k: 'pan', lastX: p.x, lastY: p.y };
      this.setCursor('grabbing');
      return;
    }
    if (e.button === 2) return;

    if (s.tool === 'move' && !s.readOnly) {
      const w = toWorld(this.cam, this.vp(), p.x, p.y);
      const problem = problemOf(s.doc);
      const tol = tolerances(e.pointerType).point / this.cam.zoom;
      const id = nearestPoint(this.scene(s), w, tol, (o) => isDraggable(o) && !(problem && o.given));
      if (id) {
        const g = s.values.get(id) as Vec;
        this.gesture = { k: 'drag', id, dx: g.x - w.x, dy: g.y - w.y, moved: false };
        this.live = { values: new Map(s.values), override: new Map(), ids: [id, ...downstream(s.doc, [id])] };
        this.setCursor('grabbing');
        return;
      }
      if (e.shiftKey) {
        this.gesture = { k: 'box', x0: p.x, y0: p.y, x1: p.x, y1: p.y };
        return;
      }
    }
    this.gesture = { k: 'tap', x0: p.x, y0: p.y, type: e.pointerType, shift: e.shiftKey };
  }

  private onMove(e: PointerEvent) {
    const p = this.local(e);
    if (this.pointers.has(e.pointerId)) this.pointers.set(e.pointerId, { ...p, type: e.pointerType });
    const g = this.gesture;
    if (!g) {
      if (e.pointerType !== 'touch') this.updateHover(p, e.pointerType);
      return;
    }
    switch (g.k) {
      case 'pinch': {
        if (this.pointers.size < 2) return;
        const [a, b] = [...this.pointers.values()];
        const d = Math.hypot(a.x - b.x, a.y - b.y) || 1;
        const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
        const zoom = Math.min(20, Math.max(0.1, (g.cam0.zoom * d) / g.d0));
        const vp = this.vp();
        // keep the world point that started under the fingers under the fingers
        const cx = g.world0.x - (mid.x - vp.w / 2) / zoom;
        const cy = g.world0.y + (mid.y - vp.h / 2) / zoom;
        this.setCam({ cx, cy, zoom });
        return;
      }
      case 'tap': {
        const slop = TAP_SLOP[g.type] ?? 6;
        if (Math.hypot(p.x - g.x0, p.y - g.y0) > slop) {
          this.gesture = { k: 'pan', lastX: p.x, lastY: p.y };
          this.setCam(panBy(this.cam, p.x - g.x0, p.y - g.y0));
          this.setCursor('grabbing');
          this.clearHover();
        }
        return;
      }
      case 'pan':
        this.setCam(panBy(this.cam, p.x - g.lastX, p.y - g.lastY));
        g.lastX = p.x;
        g.lastY = p.y;
        return;
      case 'drag':
        this.dragTo(g, toWorld(this.cam, this.vp(), p.x, p.y));
        return;
      case 'box':
        g.x1 = p.x;
        g.y1 = p.y;
        this.overlay.box = { x0: g.x0, y0: g.y0, x1: g.x1, y1: g.y1 };
        this.overlayDirty = true;
        this.schedule();
        return;
    }
  }

  private onUp(e: PointerEvent) {
    const p = this.local(e);
    this.pointers.delete(e.pointerId);
    const g = this.gesture;
    if (g?.k === 'pinch') {
      if (this.pointers.size === 0) this.gesture = null;
      return;
    }
    this.gesture = null;
    this.setCursorForTool();
    if (!g) return;
    if (g.k === 'tap') this.handleTap(p, g.type, g.shift);
    else if (g.k === 'drag') this.endDrag(g);
    else if (g.k === 'box') this.endBox(g);
    if (e.pointerType !== 'touch') this.updateHover(p, e.pointerType);
  }

  private onCancel(e: PointerEvent) {
    this.pointers.delete(e.pointerId);
    if (this.gesture?.k === 'drag') this.abortDrag();
    this.gesture = null;
    this.overlay.box = null;
  }

  private onWheel(e: WheelEvent) {
    e.preventDefault();
    const p = this.local(e);
    const unit = e.deltaMode === 1 ? 33 : e.deltaMode === 2 ? 400 : 1;
    const dx = e.deltaX * unit;
    const dy = e.deltaY * unit;
    if (e.ctrlKey || e.metaKey) {
      // trackpad pinch (browsers report it as ctrl+wheel)
      this.setCam(zoomAt(this.cam, this.vp(), p.x, p.y, Math.exp(-dy * 0.01)));
    } else if (Math.abs(dx) > Math.abs(dy) * 0.5 && dx !== 0) {
      this.setCam(panBy(this.cam, -dx, -dy)); // two-finger trackpad scroll with a sideways component: pan
    } else if (e.shiftKey) {
      this.setCam(panBy(this.cam, -dy, 0));
    } else {
      this.setCam(zoomAt(this.cam, this.vp(), p.x, p.y, Math.exp(-dy * 0.001)));
    }
    this.updateHover(p, 'mouse');
  }

  // ---- dragging -------------------------------------------------------------

  private dragTo(g: Extract<Gesture, { k: 'drag' }>, w: Vec) {
    const live = this.live;
    if (!live) return;
    const s = useApp.getState();
    const o = s.doc.objects[g.id];
    if (!o || o.kind !== 'point') return;
    const target = { x: w.x + g.dx, y: w.y + g.dy };
    let next: GeoObject | null = null;
    const d = o.def;
    if (d.t === 'free') next = { ...o, def: { t: 'free', x: target.x, y: target.y } };
    else if (d.t === 'on') {
      const parent = live.values.get(d.of);
      if (parent && (parent.k === 'line' || parent.k === 'circle')) next = { ...o, def: { ...d, u: paramOn(parent, target).u } };
    } else if (d.t === 'polar') {
      const a = live.values.get(d.a);
      if (a && a.k === 'point') next = { ...o, def: { ...d, ang: Math.atan2(target.y - a.y, target.x - a.x) } };
    }
    if (!next) return;
    g.moved = true;
    live.override.set(g.id, next);
    reevaluate(s.doc, live.values, live.ids, live.override);
    this.sceneDirty = true;
    this.schedule();
    // keep the Measures panel live, throttled to ~30 Hz
    const now = performance.now();
    if (now - this.lastLiveSync > 33) {
      this.lastLiveSync = now;
      useApp.setState({ values: new Map(live.values) });
    }
  }

  private endDrag(g: Extract<Gesture, { k: 'drag' }>) {
    const live = this.live;
    this.live = null;
    const s = useApp.getState();
    if (!live || !g.moved) {
      // a press without movement on a point = select it
      this.selectAt(g.id);
      this.invalidate();
      return;
    }
    const obj = live.override.get(g.id);
    if (obj) applyPatch(setObjectsPatch(s.doc, [obj], `Move ${obj.name}`));
    else this.invalidate();
  }

  private abortDrag() {
    if (this.live) {
      this.live = null;
      useApp.setState({ values: evaluateDoc(useApp.getState().doc) });
      this.invalidate();
    }
  }

  private endBox(g: Extract<Gesture, { k: 'box' }>) {
    this.overlay.box = null;
    const s = useApp.getState();
    const vp = this.vp();
    const [x0, x1] = [Math.min(g.x0, g.x1), Math.max(g.x0, g.x1)];
    const [y0, y1] = [Math.min(g.y0, g.y1), Math.max(g.y0, g.y1)];
    const inside = (x: number, y: number) => {
      const q = toScreen(this.cam, vp, x, y);
      return q.x >= x0 && q.x <= x1 && q.y >= y0 && q.y <= y1;
    };
    const vis = this.visibleFn(s);
    const ids: Id[] = [];
    for (const id of s.doc.order) {
      const o = s.doc.objects[id];
      const v = s.values.get(id);
      if (!o || !v || !vis(o)) continue;
      if (v.k === 'point' && inside(v.x, v.y)) ids.push(id);
      else if (v.k === 'circle' && inside(v.cx - v.r, v.cy - v.r) && inside(v.cx + v.r, v.cy + v.r)) ids.push(id);
      else if (v.k === 'line' && Number.isFinite(v.t0) && Number.isFinite(v.t1) && inside(v.px + v.dx * v.t0, v.py + v.dy * v.t0) && inside(v.px + v.dx * v.t1, v.py + v.dy * v.t1)) ids.push(id);
    }
    useApp.setState({ selection: ids, popoverAt: null });
    this.invalidate();
  }

  // ---- taps: the tool state machine -----------------------------------------

  private selectAt(id: Id | null, shift = false) {
    const s = useApp.getState();
    if (!id) {
      useApp.setState({ selection: [], popoverAt: null });
      return;
    }
    const sel = shift ? (s.selection.includes(id) ? s.selection.filter((x) => x !== id) : [...s.selection, id]) : [id];
    const g = s.values.get(id);
    let at: Vec | null = null;
    if (g && g.k === 'point') at = toScreen(this.cam, this.vp(), g.x, g.y);
    else if (this.pointers.size === 0 && this.hoverPos) at = this.hoverPos;
    useApp.setState({ selection: sel, popoverAt: sel.length === 1 ? at ?? this.hoverPos ?? { x: 100, y: 100 } : null });
  }

  private hoverPos: Vec | null = null;

  handleTap(p: Vec, type: string, shift: boolean) {
    this.hoverPos = p;
    const s = useApp.getState();
    const tool = TOOL_BY_KEY[s.tool];
    const w = toWorld(this.cam, this.vp(), p.x, p.y);
    const tol = tolerances(type);
    const pointTol = tol.point / this.cam.zoom;
    const curveTol = tol.curve / this.cam.zoom;
    const scene = this.scene(s);

    if (s.readOnly) return;
    if (tool.key === 'move') {
      this.selectAt(objectAt(scene, w, pointTol, curveTol), shift);
      return;
    }
    if (tool.role === 'action') {
      const id = objectAt(scene, w, pointTol, curveTol);
      if (id) this.doAction(tool, id, p);
      return;
    }

    const accept = tool.next(s.session.picks);
    if (!accept) return;

    if (tool.key === 'intersect' && s.session.picks.length === 0) {
      const vi = virtualIntersections(scene, w, pointTol)[0];
      if (vi) {
        const pt = this.newPoint({ t: 'int', a: vi.a, b: vi.b, i: vi.i }, s, []);
        applyPatch(
          addStepPatch(s.doc, [pt], { id: newId('s'), tool: 'intersect', inputs: [vi.a, vi.b], outputs: [pt.id] }, 'Intersect'),
        );
        return;
      }
    }

    const sn = snap(scene, w, { kinds: accept.kinds, create: accept.create, pointTol, curveTol });
    if (!sn) {
      toast(tool.hint(s.session.picks), 'info', 1800);
      return;
    }
    const res = this.pickFromSnap(sn, s, s.session.pending);
    if (!res) return;
    const last = s.session.picks[s.session.picks.length - 1];
    const closesPolygon = tool.key === 'polygon' && s.session.picks.length >= 3 && res.pick.id === s.session.picks[0].id;
    if (last && last.id === res.pick.id && !closesPolygon) return; // same thing twice
    if (DISTINCT_POINTS.has(tool.key) && s.session.picks.some((q) => q.id === res.pick.id) && res.pick.kind === 'point') {
      toast('Pick a different point', 'info', 1500);
      return;
    }
    const picks = [...s.session.picks, res.pick];
    const pending = res.created ? [...s.session.pending, res.created] : s.session.pending;
    if (tool.next(picks) === null) this.complete(tool, picks, pending);
    else useApp.setState({ session: { picks, pending } });
  }

  /** Close an open polygon with Enter. */
  closePolygon() {
    const s = useApp.getState();
    if (s.tool !== 'polygon' || s.session.picks.length < 3) return;
    this.complete(TOOL_BY_KEY.polygon, [...s.session.picks, s.session.picks[0]], s.session.pending);
  }

  private newPoint(def: GeoObject['def'], s: AppState, pending: GeoObject[]): GeoObject {
    const taken = new Set(pending.map((o) => o.name));
    return { id: newId(), kind: 'point', name: nextName(s.doc, 'point', taken), def } as GeoObject;
  }

  private pickFromSnap(sn: Snap, s: AppState, pending: GeoObject[]): { pick: Pick; created?: GeoObject } | null {
    const kindOf = (id: Id): Kind | undefined => s.doc.objects[id]?.kind ?? pending.find((o) => o.id === id)?.kind;
    switch (sn.t) {
      case 'point':
        return { pick: { id: sn.id, kind: 'point' } };
      case 'curve':
      case 'region': {
        const k = kindOf(sn.id);
        return k ? { pick: { id: sn.id, kind: k } } : null;
      }
      case 'int': {
        const o = this.newPoint({ t: 'int', a: sn.a, b: sn.b, i: sn.i }, s, pending);
        return { pick: { id: o.id, kind: 'point' }, created: o };
      }
      case 'on': {
        const o = this.newPoint({ t: 'on', of: sn.of, u: sn.u }, s, pending);
        return { pick: { id: o.id, kind: 'point' }, created: o };
      }
      case 'free': {
        const o = this.newPoint({ t: 'free', x: sn.x, y: sn.y }, s, pending);
        return { pick: { id: o.id, kind: 'point' }, created: o };
      }
    }
  }

  private complete(tool: ToolUI, picks: Pick[], pending: GeoObject[]) {
    if (tool.role === 'measure') {
      this.addMeasure(tool, picks);
      clearSession();
      return;
    }
    if (tool.number) {
      useApp.setState({ session: { picks, pending } });
      const n = tool.number;
      askNumber({
        label: n.label,
        value: String(n.def),
        unit: n.unit,
        onSubmit: (value) => this.finish(tool, picks, pending, n.integer ? Math.round(value) : value),
      });
      return;
    }
    this.finish(tool, picks, pending);
  }

  private finish(tool: ToolUI, picks: Pick[], pending: GeoObject[], num?: number) {
    const s = useApp.getState();
    const values = new Map(s.values);
    for (const o of pending) values.set(o.id, evalObject(o, (id) => values.get(id)));
    const ctx = { doc: s.doc, values, obj: (id: Id) => s.doc.objects[id] ?? pending.find((o) => o.id === id) };
    const toolId = tool.key as Parameters<typeof build>[0];
    const res = build(toolId, picks.map((p) => p.id), ctx, num);
    if (res.error) {
      toast(res.error, 'error');
      clearSession();
      return;
    }
    const objs = [...pending, ...res.objs];
    if (objs.length === 0) {
      clearSession();
      return;
    }
    const step = { id: newId('s'), tool: toolId, inputs: picks.map((p) => p.id), outputs: objs.map((o) => o.id) };
    applyPatch(addStepPatch(s.doc, objs, step, tool.label));
    clearSession();
  }

  private addMeasure(tool: ToolUI, picks: Pick[]) {
    const s = useApp.getState();
    let m: Measure | null = null;
    if (tool.key === 'measureDistance') {
      if (picks.length === 1) {
        const o = s.doc.objects[picks[0].id];
        if (o?.kind === 'line' && o.def.t === 'thru' && o.clip === 'segment') m = { id: newId('m'), t: 'distance', a: o.def.a, b: o.def.b };
        else {
          toast('Pick two points or a segment', 'info');
          return;
        }
      } else m = { id: newId('m'), t: 'distance', a: picks[0].id, b: picks[1].id };
    } else if (tool.key === 'measureAngle') m = { id: newId('m'), t: 'angle', a: picks[0].id, v: picks[1].id, b: picks[2].id };
    else if (tool.key === 'measureArea') m = { id: newId('m'), t: 'area', of: picks[0].id };
    if (!m) return;
    applyPatch({ label: 'Measure', measures: [s.doc.measures, [...s.doc.measures, m]] });
    const v = measureValue(m, useApp.getState().values);
    if (v.value !== null) toast(`${tool.label}: ${formatNumber(v.value, s.settings.decimals)}${v.unit}`, 'info', 2000);
  }

  private doAction(tool: ToolUI, id: Id, at: Vec) {
    const s = useApp.getState();
    const o = s.doc.objects[id];
    if (!o) return;
    if (tool.key === 'label') {
      useApp.setState({ selection: [id], popoverAt: at });
      return;
    }
    if (tool.key === 'showHide') {
      if (problemOf(s.doc) && o.given) return toast('Givens stay visible in a problem', 'info');
      applyPatch(setObjectsPatch(s.doc, [{ ...o, hidden: !o.hidden }], o.hidden ? `Show ${o.name}` : `Hide ${o.name}`));
      return;
    }
    if (tool.key === 'delete') deleteWithConfirm([id]);
  }

  // ---- hover & preview ------------------------------------------------------

  private clearHover() {
    this.overlay = { ghosts: [], pending: [], snap: null, candidates: [], box: this.overlay.box };
    if (this.hoverId) {
      this.hoverId = null;
      this.sceneDirty = true;
    }
    this.overlayDirty = true;
    this.schedule();
  }

  private refreshHover() {
    if (this.hoverPos && this.lastPointerType !== 'touch') this.updateHover(this.hoverPos, this.lastPointerType);
    else this.clearHover();
  }

  private updateHover(p: Vec, type: string) {
    this.hoverPos = p;
    const s = useApp.getState();
    if (!this.renderer) return;
    const tool = TOOL_BY_KEY[s.tool];
    const w = toWorld(this.cam, this.vp(), p.x, p.y);
    const tol = tolerances(type);
    const pointTol = tol.point / this.cam.zoom;
    const curveTol = tol.curve / this.cam.zoom;
    const scene = this.scene(s);
    let hoverId: Id | null = null;
    const ov: typeof this.overlay = { ghosts: [], pending: [], snap: null, candidates: [], box: this.overlay.box };

    if (s.readOnly) {
      // viewers only pan and zoom
    } else if (tool.key === 'move') {
      const problem = problemOf(s.doc);
      hoverId = nearestPoint(scene, w, pointTol, (o) => isDraggable(o) && !(problem && o.given));
      this.setCursor(hoverId ? 'grab' : objectAt(scene, w, pointTol, curveTol) ? 'pointer' : 'default');
    } else if (tool.role === 'action') {
      hoverId = objectAt(scene, w, pointTol, curveTol);
      this.setCursor(hoverId ? 'pointer' : 'default');
    } else {
      this.setCursor('crosshair');
      const accept = tool.next(s.session.picks);
      if (accept) {
        if (accept.create || tool.key === 'intersect') {
          ov.candidates = virtualIntersections(scene, w, pointTol * 2.5).map((c) => ({ x: c.x, y: c.y }));
        }
        let sn: Snap | null;
        if (tool.key === 'intersect' && s.session.picks.length === 0) {
          const vi = virtualIntersections(scene, w, pointTol)[0];
          sn = vi ? { t: 'int', ...vi } : snap(scene, w, { kinds: accept.kinds, create: false, pointTol, curveTol });
        } else sn = snap(scene, w, { kinds: accept.kinds, create: accept.create, pointTol, curveTol });
        if (sn) {
          const kind = sn.t === 'point' ? 'point' : sn.t;
          ov.snap = { x: sn.x, y: sn.y, kind };
          if (sn.t === 'point' || sn.t === 'curve' || sn.t === 'region') hoverId = sn.id;
          if (sn.t !== 'free' && sn.t !== 'curve' && sn.t !== 'region' && sn.t !== 'point') {
            ov.ghosts.push({ k: 'point', x: sn.x, y: sn.y });
          }
          if (!(tool.key === 'intersect' && sn.t === 'int')) ov.ghosts.push(...this.preview(tool, sn, s));
        }
      }
    }
    this.overlay = ov;
    if (hoverId !== this.hoverId) {
      this.hoverId = hoverId;
      this.sceneDirty = true;
    }
    this.overlayDirty = true;
    this.schedule();
  }

  /** Ghost of what the tool would create if the user clicked here. */
  private preview(tool: ToolUI, sn: Snap, s: AppState): Geo[] {
    if (tool.number || tool.role !== 'construct') return [];
    const res = this.pickFromSnap(sn, s, s.session.pending);
    if (!res) return [];
    const picks = [...s.session.picks, res.pick];
    const pending = res.created ? [...s.session.pending, res.created] : s.session.pending;
    if (tool.next(picks) !== null || tool.key === 'polygon') return [];
    const base = this.sessionValues(s);
    const values = new Map(base);
    for (const o of pending) if (!values.has(o.id)) values.set(o.id, evalObject(o, (id) => values.get(id)));
    const ctx = { doc: s.doc, values, obj: (id: Id) => s.doc.objects[id] ?? pending.find((o) => o.id === id) };
    const out = build(tool.key as Parameters<typeof build>[0], picks.map((p) => p.id), ctx);
    if (out.error) return [];
    const ghosts: Geo[] = [];
    for (const o of out.objs) {
      const g = evalObject(o, (id) => values.get(id));
      if (g) {
        values.set(o.id, g);
        ghosts.push(g);
      }
    }
    return ghosts;
  }

  private setCursor(c: string) {
    if (this.el && this.el.style.cursor !== c) this.el.style.cursor = c;
  }

  setCursorForTool() {
    const s = useApp.getState();
    this.setCursor(s.tool === 'move' || s.readOnly ? 'default' : TOOL_BY_KEY[s.tool].role === 'action' ? 'default' : 'crosshair');
  }
}

export function deleteWithConfirm(ids: Id[]) {
  const s = useApp.getState();
  if (!ids.length) return;
  if (problemOf(s.doc) && ids.some((id) => s.doc.objects[id]?.given)) {
    toast('Givens can’t be deleted in a problem', 'info');
    return;
  }
  const all = dependentsClosure(s.doc, ids);
  const extra = all.length - ids.length;
  const run = () => {
    const cur = useApp.getState();
    applyPatch(deletePatch(cur.doc, ids));
    useApp.setState({ selection: [], popoverAt: null });
  };
  if (extra > 0) {
    const name = ids.length === 1 ? s.doc.objects[ids[0]]?.name ?? 'this' : `${ids.length} objects`;
    askConfirm({ message: `Delete ${name} and ${extra} object${extra === 1 ? '' : 's'} built on it?`, confirmLabel: 'Delete', onConfirm: run });
  } else run();
}

export const controller = new Controller();
