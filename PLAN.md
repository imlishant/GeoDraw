# DrawGeo: Product & Technical Plan

> Status: **v1 built (M0–M7 closed)**, 2026-09-24. See [DECISIONS.md](DECISIONS.md) for every assumption made during the build and where it departs from this plan, and [README.md](README.md) to run it.
> Last updated: 2026-09-24

---

## 0. TL;DR

**DrawGeo** is a web app for solving ruler-and-compass geometry problems. Each reference app has one clear role:

| Reference | Its role in DrawGeo |
|---|---|
| **Euclidea** | **The look and feel.** Clean, minimal canvas. One row of simple tools at the bottom. L/E score at the top. Nothing else on screen by default. |
| **GeoGebra Geometry** | **The tool catalog.** Its full tool list (polygons, tangents, transforms, measurements...) is available, but tucked behind a **More** drawer, never cluttering the main screen. |
| **Excalidraw** | **The engineering reference.** Open source (MIT), TypeScript, canvas-rendered, fast. We borrow its *techniques* (rendering, fonts, export, input handling), not its hand-drawn look. (§5.6) |

In short: **Euclidea on the surface, GeoGebra's depth one click away, Excalidraw's engineering underneath.**

It adds two things none of them does well together:

1. **Explicit intersection.** Pick object A, pick object B, and you get *all* their intersection points, ready to build from.
2. **Steps as a first-class record.** The construction *is* an ordered list of steps. You can replay it, annotate it, save it and share it. The drawing is just a view of that list.

The previous attempt (GeoDraw) got **bloated**. Section 13 traces why: mostly *coupling* (every new tool made every other tool more complex), not the number of features. Sections 3 and 5 are designed to prevent that.

---

## 1. Problem statement

| App | What it does well | What hurts | What we take |
|---|---|---|---|
| Euclidea | Pure constructions, L/E scoring, clean and satisfying | You can only solve *its* puzzles. No free sandbox. No saved step history. | The UI, the feel, the scoring |
| GeoGebra Geometry | Complete toolset, dragging, measurements | Feels heavy. Too many tools visible at once. Intersecting two objects isn't the fast, obvious action it should be. No construction scoring. | The tool list, behind "More" |
| Excalidraw | Fast, responsive, well-engineered open-source TypeScript | Not geometry. No constraints, no precision. | Architecture and performance patterns |

**Who it's for:** you first, then geometry enthusiasts and students who want to solve construction problems on their own and keep a record of *how* they solved them.

**Core job:** "Let me build a construction quickly and precisely, see live measurements while I drag things, and keep the exact steps I took."

---

## 2. Product principles

These are the tie-breakers when a feature decision is unclear.

1. **Construction over drawing.** Every object is defined by *how* it was built (its parents and a tool), never by raw pixels. This is what makes dragging, steps and verification possible.
2. **Precision is not negotiable.** Whatever the UI looks like, the math underneath is exact to floating-point limits and never drifts.
3. **Clean by default, complete on demand.** The screen looks like Euclidea: about 10 tools. Everything GeoGebra offers is reachable via More, search, or pinning, but never shown unless asked for.
4. **Steps are the product.** If a feature doesn't create, show or explain steps, it has to justify itself.
5. **Earn every tool.** New tools need a written reason and a cost (Section 3.4).

---

## 3. Scope

### 3.1 The tool catalog: four tiers

Every tool from GeoGebra Geometry's list is placed in one of four tiers. The tier decides **where it lives in the UI** and **whether it affects the score and the purity of a construction**.

**Tier A: the main bar (Euclidea's toolbar).** Always visible. This is what the screen looks like.

| Tool | Shortcut | Inputs | L | E |
|---|---|---|---|---|
| Move | `V` | drag a free point | 0 | 0 |
| Point | `P` | click (free, or on an object) | 0 | 0 |
| Line | `L` | 2 points | 1 | 1 |
| Circle | `C` | center + point on it | 1 | 1 |
| Perpendicular bisector | `B` | 2 points | 1 | 3 |
| Perpendicular | `T` | line + point | 1 | 3 |
| Angle bisector | `G` | 3 points (or 2 lines) | 1 | 4 |
| Parallel | `A` | line + point | 1 | 4 |
| Compass | `K` | 2 points (radius) + center | 1 | 5 |
| Intersect | `X` | 2 objects → all their points | 0 | 0 |
| **More ⋯** | `M` | opens the drawer | — | — |

**Tier B: More → constructible tools.** Still pure ruler-and-compass. Each is a composite with a **computed** L/E cost (§6.4).

| GeoGebra tool | How it maps in DrawGeo | Engine output | Cost |
|---|---|---|---|
| Segment, Ray | Line with a display clip. Also reachable by long-pressing the Line button. | line | 1L 1E |
| Vector | Segment with an arrowhead (style only) | line | 1L 1E |
| Midpoint or Center | Midpoint of 2 points / center of a circle | point | computed (§6.4) |
| Tangents | Tangents from a point to a circle | 1–2 lines | computed |
| Polygon | A closed chain of segments + optional fill | n lines + region | n L, n E |
| Regular polygon | Only for constructible n (3, 4, 5, 6, 8, 10, 12, 15, 16, 17...). Other n are Tier D. | lines | computed |
| Semicircle, Circular sector | Circle with an angle clip (an *arc*), + segments for a sector | circle (clipped) | computed |
| Reflect about line | Reflects points, lines and circles | same type as input | computed (a point is 2E) |
| Reflect about point | Point reflection | same type | computed |
| Translate by vector | Vector given by 2 existing points | same type | computed |
| Rotate around point | Angle given by **3 existing points** (not a number) | same type | computed |
| Dilate from point | Ratio given by **existing points/lengths** (not a number) | same type | computed |

**Tier C: More → measure, label and edit.** Never changes the construction. Always 0L 0E.

| GeoGebra tool | DrawGeo |
|---|---|
| Distance or Length | Live measure, pinned in the Measures list |
| Angle | Live measure |
| Area | Live measure (polygon or circle) |
| Show / Hide Label, Show / Hide Object | Also on the selection popover and as shortcuts (`H`) |
| Label / name an object | Click to name. Auto-names points A, B, C... A₁. Lines and circles are optional-named. |
| Select Objects, Delete | Box select. Delete cascades with a confirmation. |
| Pan / zoom | Always available (space-drag, wheel, pinch) |

**Tier D: More → free-form (numeric) tools.** Handy for exploring, but they are **not** ruler-and-compass. Using any of them marks the construction as **non-Euclidean**: the score pill shows `5L 17E *` with a tooltip, and problem mode disables the whole tier.

| GeoGebra tool | Why it's not pure |
|---|---|
| Segment with given length | A typed number, not a constructed length |
| Circle: center & radius | Same |
| Angle with given size | e.g. 20° is provably not constructible |
| Rotate by a typed angle, dilate by a typed factor | Same |
| Regular polygon with non-constructible n (7, 9, 11...) | Provably impossible with ruler and compass |

**Why this doesn't bring the bloat back:** every tool above outputs a **point, a line or a circle**. Arcs are circles with an angle clip, the same way segments are lines with a length clip. A polygon is a group of segments. The engine still has **two curve types**, so no tool adds intersection code (§3.4, §13.1). A tool costs one formula, one macro for its E count, one icon and one test file.

**Core features**

- L/E counter (Euclidea style), with a show/hide toggle
- Steps panel: ordered construction record with click-to-highlight and a replay scrubber
- Undo/redo (unlimited within the session)
- Local autosave (browser storage), export/import `.drawgeo.json`, export PNG/SVG
- Works with mouse, trackpad and touch/stylus

### 3.2 After v1 (M5–M7)

- Accounts (Google + email magic link), cloud save, "My constructions" library
- **Problem mode**: givens + goal + target L/E, with automatic checking (Section 6.5)
- Share by read-only link (a viewer can replay the steps)
- Per-step notes ("why I drew this circle")
- The More drawer with the full GeoGebra catalog (§3.1 Tiers B–D)
- Macros: save your own composite tool from a finished construction (M8+)

### 3.3 Explicitly out of scope (and why)

| Out | Why |
|---|---|
| Algebra view, CAS, function graphing | That's GeoGebra Classic. This is the main source of bloat. |
| Conics (ellipse, parabola), curves, loci | Not ruler-and-compass. Maybe later as a separate mode. |
| 3D | Different product |
| Real-time multiplayer | Heavy infrastructure (CRDTs, presence). Share-by-link covers 90% of the need. |
| Native mobile apps | A PWA (installable website) covers it for now |
| AI hints / auto-solver | Interesting, but a whole project on its own. It also undermines "solve it on your own." |
| Copying Euclidea's puzzle levels | Legal/IP risk. Write original problems or use classic public-domain ones (Euclid's *Elements*). |
| Freehand pen, sticky notes, rich text | Excalidraw territory. See decision D6 for a *minimal* sketch layer. |
| Hand-drawn look as the default | Excalidraw's style. It conflicts with precision (D7). |
| Tools beyond GeoGebra Geometry's list | Its catalog is the ceiling. Anything more needs a strong case through the feature budget (3.4). |

### 3.4 Feature budget: how to add a tool without bloat

Every proposed tool fills in this card before it's accepted:

- **Job:** what problem does it solve that existing tools can't do in fewer than ~3 steps?
- **Cost:** its L/E cost (Section 6.4), UI slot, shortcut, and engine complexity (new object type? new intersection pair?)
- **Kill switch:** can it be hidden behind "More tools" without hurting core flows?

**Hard rule:** the main bar holds Euclidea's 10 tools + More. Users can **pin** up to 2 extra tools from More (so 12 at most). Everything else stays in the drawer.

**New object *types*** (not tools) are the expensive part: every new type needs intersection code with *every other* type (N² growth). v1 has exactly **two** geometric types, **line-like** and **circle**, plus points. That's deliberate.

---

## 4. UX & UI

### 4.1 Layout: Euclidea first

The default screen is almost empty, like Euclidea. Panels open only when asked for.

```
┌──────────────────────────────────────────────────────────────────────────┐
│ [≡]  Untitled construction ✎        5L  17E             [↶] [↷]           │
│                                                                          │
│                                                                          │
│                                                                          │
│                          C A N V A S                                     │
│                   (clean, no grid, bounded zoom)                         │
│                                                                          │
│                                                                          │
│                                                                          │
│ [☰ Steps]                                                                │
│                  Circle: pick the center                  ← hint line    │
│      ┌──────────────────────────────────────────────────────────┐        │
│      │ ↖  •  ╱  ◯  ⊥⊥  ⊥  ∠  ∥  ◎  ✕  │  ⋯ More                │        │
│      └──────────────────────────────────────────────────────────┘        │
└──────────────────────────────────────────────────────────────────────────┘
```

- **Top left:** menu (open / save / export / settings / theme) and the **construction name**, click to rename.
- **Top center:** score pill `5L 17E`. Click it for the breakdown. Hidden when "Show score" is off.
- **Top right:** undo / redo (Euclidea's placement).
- **Bottom center:** the Tier A bar. Same order as Euclidea. Tool icons only, with tooltip + shortcut on hover.
- **Hint line** above the bar: "Circle: pick the center" → "pick a point on the circle." Euclidea does this well. It removes the need for a manual.
- **Steps button (bottom left):** opens the Steps drawer. **Closed by default.** It has three tabs:
  - **Steps:** the construction record. Hover a step to highlight its objects. Scrub to replay.
  - **Objects:** names, visibility, colors.
  - **Measures:** pinned live values (e.g. `|AB| = 3.4142`, `∠ABC = 60.000°`). They update while you drag, which covers "move it and get new information."
- **Selection popover:** a small floating card next to the selected object: name, color, dashed/solid, hide, delete. Not a permanent side panel.

**The More drawer** (opened with `⋯` or `M`):

```
┌──────────────────────────────────────────────────────┐
│ 🔍 Find a tool...                                    │
├──────────────────────────────────────────────────────┤
│ CONSTRUCT      Segment  Ray  Vector  Midpoint  Tangents │
│ POLYGONS       Polygon  Regular polygon                 │
│ CIRCLES        Semicircle  Sector                       │
│ TRANSFORM      Reflect·line  Reflect·point  Translate   │
│                Rotate  Dilate                           │
│ MEASURE        Distance  Angle  Area                    │
│ EDIT           Label  Show/Hide  Select  Delete         │
│ ─────────────────────────────────────────────────────── │
│ FREE-FORM *    Segment=len  Circle=r  Angle=°  ...      │
└──────────────────────────────────────────────────────┘
```

- It opens as a panel above the bar (desktop) or a bottom sheet (phone), grouped by GeoGebra's categories.
- The **search box** is focused on open: type "tan" + Enter to pick Tangents. That's faster than scrolling.
- Each tool shows its **L/E cost badge**. Free-form tools show `*`.
- **Pin to bar:** right-click / long-press → "Pin". Up to 2 pins. Pins sit between the main tools and `⋯`.
- **Last used:** the most recent More tool temporarily takes a slot next to `⋯` so repeat use is one click (Excalidraw does this for its extra tools).

### 4.2 Interaction rules

- **Snapping, in priority order:** existing point → *virtual intersection* (see D1) → point on object → free point. The snap target is highlighted *before* you click.
- **Every tool is modal and repeatable**: stay in the tool after finishing. `Esc` cancels the current input, a second `Esc` drops back to Select.
- **Hover preview**: while picking the last input, show the result as a ghost (Euclidea does this).
- **Drag = Select tool + drag a free point.** Dependent objects recompute every frame.
- **Undefined is not deleted.** If two circles stop intersecting while you drag, their intersection points (and everything built on them) are *temporarily undefined*: hidden, marked in the Steps panel, and they come back when the configuration allows.
- **Keyboard first**: every tool has a single letter. `Ctrl/Cmd+Z / Shift+Z` for undo/redo, `Delete` to remove, `H` to hide, `1` to zoom to fit.

### 4.3 Responsive behaviour

| Breakpoint | Layout |
|---|---|
| ≥ 1024px (desktop) | As above. Steps drawer slides in from the left without covering the bar. |
| 600–1023px (tablet) | Same layout. 44px touch targets. More opens as a larger panel. |
| < 600px (phone) | Main bar **scrolls horizontally** (Euclidea on phone does the same). More and Steps open as bottom sheets. Score pill stays. |

**Touch specifics:** hit-test tolerance in **screen pixels** (about 8px mouse, 16px touch), independent of zoom. Two-finger gesture = pan/zoom, never a construction. Long-press = context menu. Stylus gets precision mode (smaller tolerance).

### 4.4 Visual language, light & dark themes

- **Euclidea's look:** neutral light-grey canvas, thin crisp anti-aliased strokes, small clear point markers, no grid, very few colors.
- **Fonts:** a clean rounded sans for the UI and score (e.g. **Nunito** or **Inter**, self-hosted). Point labels in **italic serif** (e.g. **STIX Two**), the math-textbook convention (*A*, *B*, *P*₁). The hand-drawn font (Excalidraw's Excalifont, open license) is used only in the optional sketch skin, if at all.
- Constructions in **dark grey**. Givens **bolder**. The goal / highlighted result in **accent blue**. Temporary previews dashed.
- Optional "hand-drawn" rendering (rough.js, like Excalidraw) is a **display skin only** and **off by default**. See D7.

**Light and dark mode, with every object clearly visible in both.** Requirements:

1. **One set of semantic color tokens** used by both the UI and the canvas renderer: `canvas.bg`, `obj.given`, `obj.constructed`, `obj.auxiliary`, `obj.hover`, `obj.selected`, `obj.preview`, `point.free`, `point.derived`, `point.undefined`, `label`, `measure`. Each has a light and a dark value. **No color literals anywhere in the renderer.** (The old app had hard-coded `rgba(180,180,180,0.5)`-style greys that disappeared on one of the two backgrounds.)
2. **Contrast rule:** every object color must reach at least **3:1 contrast** against the canvas background in *both* themes (WCAG's rule for non-text graphics). Labels and measures need 4.5:1. A unit test checks the token table so a bad color can't ship.
3. **Distinguish by more than color:** free points = filled, derived (intersection) points = hollow ring, auxiliary objects = thinner or dashed. This stays readable for color-blind users and in screenshots.
4. **Points get a halo** (a thin outline in the background color) so they stay visible where they sit on top of lines.
5. **Theme switching is live:** System / Light / Dark. The canvas redraws immediately on change, because the renderer reads tokens every frame. (The old renderer read the theme once, in its constructor.)
6. **Exports** (PNG/SVG) use the current theme by default, with a "white background" option for printing and worksheets.

### 4.5 Zoom & pan limits

Zoom is **bounded**, like Euclidea. It isn't infinite.

| Setting | Value | Why |
|---|---|---|
| Zoom range | **0.1× to 20×** (tunable) | Below 0.1×, a typical construction becomes a dot. Above 20×, float precision and snapping tolerances start to matter and users get lost. |
| Zoom steps | **Multiplicative** (×1.1 per wheel notch, smooth for trackpad pinch) | Additive steps (+0.1) feel uneven: 0.1→0.2 doubles the scale, 5.0→5.1 barely changes it. That's what the old app did. |
| Zoom anchor | Under the cursor or the pinch center | Standard |
| Pan limit | The camera can't move further than about 2 screen-widths beyond the bounding box of the construction | You can't get lost in empty space |
| Reset / fit | `1` = zoom to fit, `0` = reset to 100% | Recovery |
| Readout | Zoom % shown bottom-left, clickable | Orientation |

Point sizes, stroke widths, labels and hit-test tolerances are all in **screen pixels**, so they look the same at every zoom. Geometry and tolerances used for math stay in world units and **do not change with zoom**. The same click must produce the same construction at 50% and at 400%.

---

## 5. System architecture

### 5.1 High level

```
┌─────────────────────────────── Browser ───────────────────────────────┐
│                                                                        │
│  ┌──────────── UI shell (React) ─────────────┐                         │
│  │ Toolbar · Panels · Popovers · Dialogs      │                         │
│  └───────────────▲──────────────┬─────────────┘                         │
│                  │ subscribe    │ dispatch(command)                     │
│  ┌───────────────┴──────────────▼─────────────┐                         │
│  │           App store (Zustand)               │                         │
│  │  document (steps) · view (pan/zoom) ·       │                         │
│  │  tool state machine · selection · history   │                         │
│  └───────┬────────────────────────▲────────────┘                         │
│          │ commands               │ computed scene                      │
│  ┌───────▼────────────────────────┴────────────┐    ┌────────────────┐   │
│  │     Geometry engine (pure TS, no DOM)        │    │  Renderer      │   │
│  │  • object graph (DAG)                        │───▶│  Canvas 2D     │   │
│  │  • evaluator (topological recompute)         │    │  3 layers:     │   │
│  │  • intersections + root tracking             │    │  static/active │   │
│  │  • tolerance model                           │    │  /overlay      │   │
│  │  • L/E cost model                            │    └────────────────┘   │
│  │  • checker (problem mode, v2)                │                         │
│  └──────────────────────────────────────────────┘                         │
│          │                                                              │
│  ┌───────▼───────────┐                                                   │
│  │ Persistence       │ IndexedDB (local-first autosave)                  │
│  │ adapter           │─────────────── sync (v2) ──────────────┐          │
│  └───────────────────┘                                        │          │
└───────────────────────────────────────────────────────────────┼──────────┘
                                                                ▼
                                      ┌──────────────────────────────────┐
                                      │ Supabase (v2)                    │
                                      │ Auth (Google, email) · Postgres  │
                                      │ constructions · problems · RLS   │
                                      └──────────────────────────────────┘
```

**Key boundary:** the **geometry engine is a standalone package with no React and no DOM.** It takes a document and returns computed geometry. That keeps it:

- unit-testable (thousands of property tests run in milliseconds),
- movable to a Web Worker later with no rewrite,
- reusable for the problem checker on the server if ever needed.

### 5.2 Data model (sketch)

```ts
// The document IS the list of steps. Everything else is derived.
type ConstructionDoc = {
  schemaVersion: 1;
  id: string;
  title: string;
  givens: ObjectId[];            // objects that existed before step 1
  steps: Step[];                 // ordered, append-mostly
  objects: Record<ObjectId, GeoObject>;
  measures: Measure[];           // not counted, not part of the construction
  style: Record<ObjectId, Style>;
};

type Step = {
  id: StepId;
  tool: ToolId;                  // 'circle' | 'line' | 'intersect' | 'perpBisector' | ...
  inputs: ObjectId[];
  outputs: ObjectId[];           // e.g. intersect → [P1, P2]
  cost: { L: number; E: number };
  note?: string;
};

type GeoObject =
  | { kind: 'point'; def: PointDef }
  | { kind: 'line'; def: LineDef; clip: 'none' | 'segment' | 'ray' }
  | { kind: 'circle'; def: CircleDef };

type PointDef =
  | { type: 'free'; x: number; y: number }                   // draggable
  | { type: 'onObject'; obj: ObjectId; t: number }            // draggable along obj
  | { type: 'intersection'; a: ObjectId; b: ObjectId; branch: 0 | 1 }
  | { type: 'derived'; op: 'midpoint'; args: ObjectId[] };
```

Free points hold coordinates. **Nothing else does.** Everything else is recomputed from its definition each time an input changes. Because nothing is ever updated incrementally, error never accumulates.

### 5.3 Evaluator

- Objects form a **DAG** (a graph with no cycles: each object depends only on earlier ones). Insertion order is already a valid topological order because every step only references earlier objects.
- When a free point moves: find its downstream set (cached), then recompute only those objects, in order.
- Each object is `defined | undefined`. Undefined propagates downstream.
- **Budget:** under 2ms of recompute for 1,000 objects on a mid-range laptop. That's realistic because it's plain arithmetic and no allocation in the hot loop.

### 5.4 Commands, undo and history

Every user action is a **command** (`AddStep`, `DeleteObjects`, `MoveFreePoint`, `SetStyle`, `AddMeasure`...).

- Undo/redo is a stack of inverse commands, not snapshots. It stays small and fast.
- **Drag handling:** a whole drag gesture is *one* `MoveFreePoint` command (committed on pointer-up). Dragging does **not** add construction steps and does not change L/E.
- The Steps list only records construction commands. Style and measures live beside it.

### 5.5 Tech stack

| Layer | Choice | Why | Alternative considered |
|---|---|---|---|
| Language | **TypeScript** (strict) | Type safety for the object model | — |
| Build | **Vite** | Fast dev loop, simple | Next.js (overkill for a canvas app with no SEO needs) |
| UI shell | **React 19** | Ecosystem, familiarity. Canvas is rendered *outside* React. | Svelte / Solid: smaller and faster, but fewer ready components. Viable if you prefer it. |
| State | **Zustand** | Tiny, no boilerplate, works outside React (engine/renderer can read it) | Redux Toolkit (heavier); Jotai |
| Rendering | **Canvas 2D**, layered | Fast for hundreds–thousands of primitives, full control | SVG (easier hit-testing, slows past ~1–2k nodes); WebGL/PixiJS (unnecessary complexity for lines and circles) |
| Styling | **Tailwind** or CSS modules + tokens | Quick, consistent, dark mode | — |
| Local storage | **IndexedDB via Dexie** | Async, large capacity, works offline | localStorage (5MB cap, synchronous) |
| Backend (v2) | **Supabase** (Postgres + Auth + row-level security) | Google + email sign-in built in, SQL, generous free tier | Firebase (NoSQL, harder to query); own server (more ops) |
| Hosting | **Vercel** or **Cloudflare Pages** | Static hosting plus a CDN | Netlify |
| PWA | vite-plugin-pwa | Installable, offline | — |
| Testing | **Vitest** + **fast-check** (property tests) + **Playwright** (end-to-end) | The engine needs property tests. See Section 8. | Jest |

---

### 5.6 Excalidraw as the engineering reference

Excalidraw is open source (MIT license), written in TypeScript + React, and renders to canvas. It's a proven answer to "how do you make a canvas app feel instant." We **study and borrow its patterns**. We don't fork it.

**Borrow:**

| Excalidraw technique | How we use it |
|---|---|
| **Two canvases:** a *static* one for the scene and an *interactive* one for selection, hover and handles | Our static layer + overlay layer (§7). Hovering never redraws the whole construction. |
| **Shape cache with element versions:** each element has a version number, and drawn paths are cached until the version changes | Cache each object's `Path2D`. While dragging, only objects downstream of the dragged point get a new version. |
| **rAF-throttled rendering + viewport culling** | Draw at most once per frame. Skip objects outside the view. |
| **Package split** (the repo separates math, element and app code into packages) | `engine` / `renderer` / `app` packages, with the engine not allowed to import DOM or React |
| **Pointer Events + pinch/wheel handling** | One input path for mouse, trackpad, touch and pen |
| **Keyboard-first tool switching** (single letters, shown on hover) | Same (§4.2) |
| **Scene data embedded in exported PNG/SVG** (an exported Excalidraw image can be reopened as an editable drawing) | Embed the construction JSON in exports, so a shared picture reopens with all its steps |
| **Self-hosted fonts, preloaded** before the first render so text doesn't jump | Same for Nunito/Inter and STIX Two |
| **Local-first persistence** (browser storage, file save/open) | IndexedDB + `.drawgeo.json` (§9) |
| **rough.js** (hand-drawn strokes) and **perfect-freehand** (smooth pen strokes) libraries | Only for the optional sketch skin/layer (D6, D7) |

**Don't copy:**

- **Its data model.** Excalidraw elements are free shapes with coordinates and no dependencies. We need a construction graph (§5.2). This is the single biggest reason **not to fork**.
- **Its giant app component.** Excalidraw's main `App` component is thousands of lines. That's the same "god component" problem as GeoDraw's `AppCanvas.tsx` (§13.1).
- **Real-time collaboration infrastructure** (out of scope, §3.3).
- **The hand-drawn look as default.** The look comes from Euclidea.

**Fork vs build fresh:** forking would give a UI shell, export and fonts for free. But then we'd spend months removing freeform features and forcing a dependency graph into a model not built for it. The result would be bloated again. **Recommendation: build fresh, and keep Excalidraw's source open next to you as a reference.** Small utilities can be copied with MIT attribution.

## 6. The geometry core: accuracy and correctness

This is where the product wins or loses. Students trust what they see.

### 6.1 Number model

- **World coordinates in float64**, unrelated to screen pixels. The view transform (pan/zoom) is applied only at render time.
- **Tolerances are relative**, scaled to the magnitude of the objects involved (e.g. `ε = 1e-9 × scale`). A fixed `1e-6` breaks at extreme zoom.
- **Displayed values** are rounded (4 decimals by default, configurable). Internally, values are never rounded.
- **Exact arithmetic** (symbolic algebraic numbers) is **rejected for v1**. It's slow and complex. Float64 plus good formulas plus randomized checking (6.5) is how serious dynamic-geometry tools do it in practice.

### 6.2 Intersections (the headline feature)

| Pair | Method | Result |
|---|---|---|
| line ∩ line | 2×2 solve; parallel if `|det| < ε` | 0 or 1 point |
| line ∩ circle | project the center onto the line, then offset along it by `±√(r² − d²)` | 0, 1 (tangent) or 2 |
| circle ∩ circle | radical line method (numerically stable) | 0, 1, 2, or ∞ (same circle) |

Segments and rays are lines with a clip. Intersection is computed on the infinite carrier, then filtered by the clip **only if the user wants that** (decision D3).

**Intersect tool flow:** press `X`, click object A, click object B → **all** intersection points are created in one step (0 L, 0 E, as in Euclidea). If the objects have no intersection, a toast says "these don't intersect" and nothing is created.

### 6.3 Root tracking: the classic dynamic-geometry bug

When you drag, the two intersection points of a circle and a line can **swap labels**. Point `P` jumps to where `Q` was, and everything built on `P` jumps with it. GeoGebra users hit this constantly.

**Mitigation:**
1. Each intersection point stores `branch: 0|1` *plus* its last known position.
2. On recompute, choose the root **closest to the previous position** (continuity), not the one with the lower index.
3. Near tangency, both roots are close. Keep the previous assignment unless the gap clearly widens.
4. On load/replay (no previous positions), use the deterministic `branch` ordering. That ordering is defined relative to the parent objects' orientation, not to screen x/y.

### 6.4 L/E scoring model

Following Euclidea's convention:

- **L** = number of construction tool uses (each use of a tool that draws something = 1L).
- **E** = number of *elementary* lines and circles (straightedge and collapsing compass) that the tool use stands for.
- Moving, placing points and intersecting cost **0L 0E**.

**Euclidea's official costs (source: Euclidea, as provided):**

| Tool | L | E |
|---|---|---|
| Move | 0 | 0 |
| Point | 0 | 0 |
| Line | 1 | 1 |
| Circle | 1 | 1 |
| Perpendicular bisector | 1 | 3 |
| Perpendicular | 1 | 3 |
| Angle bisector | 1 | 4 |
| Parallel | 1 | 4 |
| Compass | 1 | 5 |
| Intersect | 0 | 0 |

**Costs for tools Euclidea doesn't have.** These are *our* calculations: the smallest known ruler-and-collapsing-compass construction. Each needs a test that proves it (see below).

| Tool | L | E | Minimal construction behind the E count |
|---|---|---|---|
| Segment / Ray | 1 | 1 | Same as Line (only drawn differently) |
| Midpoint | 1 | 3 or 4 | Two circles (A through B, B through A) + the line through their intersections = 3E, then intersect with AB. That's 3E if line AB already exists, 4E if it has to be drawn. |
| Reflect point over line *(Tier B)* | 1 | 2 | Two circles centered on the line through P. Their second intersection is P′. |
| Label, hide, color, measure | 0 | 0 | Not construction |

> The midpoint rule shows why these must be **computed, not guessed**: the cost can depend on what already exists. If that's too subtle, the simple alternative is to not offer a midpoint tool at all (Euclidea doesn't). Then users get the midpoint by intersecting the perpendicular bisector with the segment: 3E + 1E for the segment = transparent and honest. **Recommendation: leave Midpoint out of the default toolbar** and keep it only in sandbox "More" with a 4E cost.

**How costs are defined in code (so they're calculated, not typed in):**
1. Each composite tool is defined as a **macro**: a small recipe of primitive steps (circles, lines, intersections).
2. Its E cost = number of lines and circles in that recipe. It's derived automatically.
3. A test runs each macro on random inputs and checks the result matches the composite tool's direct formula. Another test asserts that the derived E matches Euclidea's table above for the tools Euclidea has.

**Settings toggles:**
- **Show score** on/off: hides the L/E pill entirely for relaxed exploration.
- **Strict mode** on/off: only Line, Circle, Point, Intersect (pure Euclid). Composite tools are greyed out.
- Problem mode (v2) can force either of these per problem.

### 6.5 Problem checking (v2)

"It looks right" is not the same as "it is right." A construction that looks right in one configuration can be a coincidence.

**Method:** randomized verification.
1. A problem defines *givens* (free objects) and a *goal predicate* (e.g. "some line in the construction is tangent to circle c at point T").
2. On submit: randomly perturb the givens N times (e.g. 20), re-evaluate the whole construction, and test the predicate each time with tolerance.
3. Pass only if the predicate holds in **all** trials (skipping trials where the construction is undefined, but requiring a minimum number of valid ones).

The chance of a wrong construction passing 20 random configurations is negligible. It's fast because the evaluator is fast.

### 6.6 Degenerate cases to handle explicitly

- Line through two coincident points → undefined
- Circle with radius 0 → undefined
- Intersecting an object with itself, or two identical circles/lines → "infinitely many" message, no points
- Creating a point that coincides with an existing point → reuse the existing one (dedupe within tolerance)
- Parallel lines → no intersection. The tool says so instead of placing a point at infinity.
- Huge coordinates after zooming far out → relative tolerances handle it. Infinite lines are clipped to the viewport for rendering.

---

## 7. Performance targets

| Metric | Target |
|---|---|
| Drag frame time (500 objects) | under 8ms (120fps headroom), under 16ms worst case |
| Recompute (1,000 objects) | under 2ms |
| Hit-test on hover | under 1ms (spatial index / bounding boxes when over 500 objects) |
| Initial JS (gzipped) | under 250KB for the app shell and engine |
| Time to interactive | under 1.5s on a mid-range laptop |
| Autosave | debounced 500ms, off the main interaction path |

**Techniques:**
- Render layers: a *static* canvas (untouched objects), an *active* canvas (objects downstream of the drag), and an *overlay* canvas (hover, snap, previews). Redraw only the layers that change.
- `requestAnimationFrame`-coalesced rendering. Pointer events never render directly.
- No React re-render on drag. React only re-renders panels whose values actually changed (measures), throttled to about 30Hz.
- `devicePixelRatio`-aware canvas for crisp lines on retina screens.

---

## 8. Testing strategy

| Layer | How |
|---|---|
| Geometry primitives | Unit tests plus **property tests** (fast-check): e.g. "an intersection point lies on both objects within ε", "a perpendicular bisector point is equidistant from both ends" |
| Root tracking | Simulated drags along random paths: assert no jumps above a threshold between frames except at true tangency |
| Composite tools | Build each composite from primitives and assert the same result as the shortcut tool (also validates E costs) |
| Serialization | Round-trip: save → load → identical computed geometry. Schema-migration tests. |
| Classic constructions | A golden suite (equilateral triangle, square, regular pentagon, tangent from a point, ...) replayed and checked |
| UI | Playwright: tool flows, undo/redo, touch emulation |
| Performance | A benchmark script (1k objects, simulated drag) in CI that fails on regressions |

---

## 9. Persistence, accounts and sharing

**Phase 1 (v1): local-first**
- Autosave to IndexedDB. Multiple constructions in a local library.
- Export/import `.drawgeo.json` (human-readable, versioned with `schemaVersion`).
- Export PNG/SVG of the canvas, and optionally "steps as text" for writing up a solution.

**Phase 2 (v2): accounts**
- Supabase Auth: Google OAuth + email magic link (no passwords to manage).
- Tables: `profiles`, `constructions (id, owner, title, doc jsonb, created_at, updated_at, problem_id?)`, `problems`, `attempts (user, problem, L, E, solved, doc)`.
- Row-level security: users can only read and write their own rows. Shared links use a `public_share_id`.
- **Sync strategy:** last-write-wins per document, with a "newer version exists" prompt. Real-time merge (CRDTs) is not needed for a single-user editor. **Don't build auth before the editor is good.**

**Privacy:** store only email, display name and constructions. No analytics beyond privacy-friendly page counts (e.g. Plausible) unless you decide otherwise.

---

## 10. Roadmap & milestones

Each milestone has **exit criteria**. Status as of 2026-09-24:

| # | Milestone | Status | How the exit criteria were checked |
|---|---|---|---|
| **M0** | Foundations | ✅ Done | Vite + TS + React, engine package, Vitest + Playwright, pan/zoom canvas |
| **M1** | Engine core | ✅ Done | Property tests for all intersections; a no-root-swap drag test; engine has exactly two curve types |
| **M2** | Pure construction MVP | ✅ Done | E2E builds an equilateral triangle by hand, drags givens, undo/redo; Euclidea layout; light/dark; bounded zoom |
| **M3** | Euclidea parity | ✅ Done | All 10 Euclidea tools; perpendicular bisector, perpendicular, parallel and angle bisector re-derived from primitives with matching E; live measures |
| **M4** | Polish & persistence | ✅ Done | Local library + autosave, JSON/PNG/SVG (construction embedded), steps as text, replay scrubber, step notes, shortcuts, phone/tablet layouts, real touch/pinch e2e, PWA |
| **M5** | More drawer | ✅ Done | All GeoGebra Geometry tools reachable (Tiers B–D) with search, cost badges, pinning; engine still two curve types |
| **M6** | Accounts & cloud | ⚠️ Built, unverified | Supabase auth + sync + RLS schema, env-gated; not run against a live project (DECISIONS D4). Share-by-link done server-free via the URL fragment |
| **M7** | Problem mode | ✅ Done | 14 problems; checker rejects eyeballed answers for every problem; reference solutions meet their L/E goals; stars |
| **M8+** | Candidates | ⏸ Open | Custom macros, sketch layer, Euclidea's V star, sync conflict prompt: see DECISIONS §10 |

The durations are rough solo-dev estimates. The *order* matters more than the dates.

---

## 11. Decisions to make

Each has a recommendation. Tell me where you disagree.

**D1. Intersections: auto-create, explicit-only, or hybrid?**
- *Auto (Euclidea):* every pair of objects auto-creates its intersection points. Fast, but clutters the canvas and grows O(n²).
- *Explicit (your request):* the Intersect tool picks A and B and creates all their points. Clean and intentional.
- ✅ **Recommend hybrid:** the Intersect tool as you described, *plus* "virtual intersections." All intersections are computed lazily and appear as snap targets on hover. They become real points only when you click one or use it as an input. This gets Euclidea's speed without the clutter.

**D2. Are drags recorded in Steps?**
✅ **No.** Steps record *what* you constructed. Dragging only explores. Optionally, "snapshot this configuration" can be saved as a view.

**D3. Do segments/rays intersect only within their visible extent?**
- Pure geometry says lines are infinite. Users expect segments to be finite.
- ✅ **Recommend:** intersect the full carrier line, but mark points outside the segment as "extension" (hollow marker). Or keep only in-segment points if you find that confusing. **This one is your call.**

**D4. Composite tools: always available, or unlocked?**
Euclidea unlocks them via progression. ✅ **Recommend:** always available in the sandbox, with a **strict mode** toggle (Line + Circle + Intersect only) that problems can enforce.

**D5. Rendering: Canvas 2D vs SVG.**
✅ Canvas 2D (performance headroom, layered redraws). SVG only for export.

**D6. A "sketch layer" (Excalidraw-style rough notes)?**
You mentioned liking how Excalidraw lets you "rough it out." Options:
- (a) None. Precision only.
- (b) ✅ A **minimal sketch layer**: freehand pen and text notes on a separate layer that never interacts with the construction, never snaps, never counts. Toggle visibility. Post-v1 (M4 at the earliest).
- (c) Full Excalidraw features. ❌ This is how bloat happened last time.

**D7. Hand-drawn (rough.js) rendering style?**
✅ Optional skin, off by default, never in problem mode. It looks charming, but wobbly lines make it harder to judge tangency and alignment.

**D8. Framework: React vs Svelte/Solid.**
✅ React, unless you're more fluent in something else. The canvas isn't in React anyway, so this matters less than it seems.

**D9. Backend: Supabase vs Firebase.**
✅ Supabase (SQL plus row-level security fit "attempts per problem" queries better). Deferred to M6 either way.

**D11. Free-form (Tier D) tools: include or leave out?**
They're convenient (typed lengths and angles) but not ruler-and-compass. ✅ **Recommend:** include them at the bottom of More, clearly marked `*`. Using one flags the construction as non-Euclidean, and problem mode disables them. You keep GeoGebra's convenience without losing Euclidea's rigor.

**D12. Fork Excalidraw or build fresh?**
✅ **Build fresh, borrow patterns** (§5.6). Its freeform data model is the wrong foundation for constructions.

**D10. Name.** "DrawGeo" is the working title. Worth deciding before the domain and PWA manifest.

---

## 12. Risks, pitfalls & fallacies

| # | Pitfall / fallacy | Why it's tempting | What goes wrong | Countermeasure |
|---|---|---|---|---|
| 1 | **"More tools = better app"** | GeoGebra has everything | Bloat, the previous attempt's failure mode | Feature budget card, 12-tool toolbar cap, out-of-scope list |
| 2 | **Storing shapes as coordinates** | Simpler at first | No dragging, no steps, no verification | Definition-based DAG from day one (5.2) |
| 3 | **"If it looks right, it is right"** | Visual confirmation feels convincing | Coincidental constructions pass | Randomized perturbation checker (6.5) |
| 4 | **Fixed epsilon** | `1e-6` feels safe | Breaks at high or low zoom, tangency flickers | Relative tolerances, world coords separate from screen |
| 5 | **Index-based intersection roots** | Easy | Points swap mid-drag and constructions "break" | Continuity root tracking (6.3) |
| 6 | **Deleting on undefined** | Clean up | User loses work when a drag passes through a degenerate state | `undefined` state that recovers |
| 7 | **Snapshot undo** | Easy to implement | Memory grows, slow on big docs | Command/inverse-command history |
| 8 | **Rendering through React state** | "React-y" | Drags stutter | Canvas outside React, rAF loop |
| 9 | **Auth/cloud first** | Feels like "real app" progress | Months on plumbing, editor still mediocre | Local-first. Accounts only at M6. |
| 10 | **Copying Euclidea levels** | Content for free | IP issues | Original problems plus Euclid's *Elements* (public domain) |
| 11 | **Mixing precision UI with rough UI** | Excalidraw looks great | Students misjudge tangency | Rough is an optional skin. Sketch layer kept separate. |
| 12 | **Floating-point "equality"** | `a === b` | Duplicate points, missed coincidences | Tolerance-based dedupe, a single `approxEqual` helper used everywhere |
| 13 | **Designing for phone first** | Mobile is big | Constructions need precision and space | Desktop/tablet first, phone "usable," not optimized |
| 14 | **Scoring disputes** | Assuming Euclidea's costs | Wrong E values annoy enthusiasts | One cost table, verified by tests that build composites from primitives |

---

## 13. Lessons from the previous build (GeoDraw)

Source: [github.com/imlishant/GeoDraw](https://github.com/imlishant/GeoDraw), reviewed 2026-09-24 (29 commits, about 4,200 lines of TypeScript). **Nothing is carried over as code.** Only the lessons are.

### 13.1 Where the bloat actually came from

The old app didn't have too many *features*. It had 8 tools. The bloat came from **how each feature was wired in**: every new tool made every other tool more complicated.

1. **Each composite tool became a new object type.** Perpendicular bisector, perpendicular line and angle bisector were separate types, not just "a line." With 5 non-point types, `intersections.ts` needed **15 pairwise intersection functions** and a 25-branch `if` chain (790 lines) to intersect them. Adding a Parallel tool would have meant 6 more functions, and so on.
   - The commit history shows the symptom: *"Fixed Perpendicular Line not working with itself"*, *"Fix perpendicular line and intersection tool working with each other"*.
   - **→ Now:** composite tools produce an ordinary **line or circle**. Only its *definition* differs. The engine knows exactly two curve types. Adding Parallel adds one formula and zero intersection code. (§3.4, §5.2)
2. **Tool logic lived in UI components.** `AppCanvas.tsx` (863 lines) mixed input handling, snapping, hit-testing, tool state and render triggering. Each `*Tool.tsx` re-implemented its own "find closest point / closest line" search. `PerpendicularLineTool.tsx` alone is 256 lines.
   - **→ Now:** one shared hit-test/snap service. Each tool is a small state machine ("pick point → pick line → emit step") with no geometry math and no DOM.
3. **No engine boundary.** Geometry was computed in three places: the store, the renderer (which recomputed directions for drawing) and the tool handlers. Fixes in one place didn't reach the others.
   - **→ Now:** a pure engine package is the single source of truth. The renderer only draws what the engine outputs. (§5.1)
4. **No tests, and AI-generated fixes.** There are zero test files. One commit reads *"Fix a lot of bugs introduced, used gemini3."* Without tests, each fix was a gamble.
   - **→ Now:** the engine ships with property tests from M1, and composite tools are verified against their primitive recipes. (§8)
5. **Dead parallel code.** `constraints.ts` (`ConstraintValidator`) and `interaction.ts` (`CanvasInteractionHandler`) are never imported. They're earlier attempts left in place.
   - **→ Now:** delete what isn't used. CI lint rule for unused exports.

### 13.2 What didn't work in practice (bugs by design)

| # | Problem in GeoDraw | Where | Effect for the user | What we do instead |
|---|---|---|---|---|
| 1 | Infinite lines faked with endpoints `±10000` units away (`const big = 10000`) | `intersections.ts` helpers | Wrong or missing intersections far from the origin or at low zoom. Precision loss. | Lines stored as point + direction. Intersections solved analytically. Drawn clipped to the viewport. (§6.2) |
| 2 | Intersection points picked by index (`intersections[index]`) | `utils.ts › recalculateElement` | Points swap while dragging. At tangency the list shrinks to 1, index 1 no longer exists, and **the point silently keeps its old coordinates** (stale, not undefined). | Continuity root tracking + explicit `undefined` state. (§6.3) |
| 3 | Circle–circle returns 2 identical points at tangency. Epsilons scattered: `1e-6`, `1e-8`, `1e-10`. | `intersections.ts` | Duplicate points, tangency flicker | One tolerance module, relative epsilons, tangency returns exactly 1 point. (§6.1) |
| 4 | Point dedupe tolerance depends on zoom (`findExistingPoint(x, y, 2 / zoom)`) | `AppCanvas.tsx` | The same click reuses an existing point at one zoom level and creates a near-duplicate at another | Screen-pixel tolerance for *picking*, world-unit tolerance for *math*. Never mixed. (§4.5) |
| 5 | Derived points store `x, y`, and other shapes are recomputed at draw time | `types.ts`, `renderer.ts` | Two sources of truth that drift apart. Only intersection points were ever recomputed. | Only free points store coordinates. Everything else is derived. (§5.2) |
| 6 | Snapshot undo: every change copies the whole element array, capped at 50. Graph rebuilt on each undo. | `useGeometryStore.ts` | History lost after 50 actions. Memory grows with size × actions. | Command-based undo, unlimited. (§5.4) |
| 7 | Delete doesn't cascade (`removeElement` leaves dependents behind) | `useGeometryStore.ts` | Orphans pointing at deleted parents. Crashes or ghosts on later drags. | Cascade delete with a "this also removes N objects" confirmation |
| 8 | Each drag frame rebuilds a Map of *all* points and an array of *all* elements, *per dependent* | `recalculateElement` | O(n²) work per frame. Lag grows quickly with construction size. | Precomputed update order + in-place evaluation. Target under 2ms for 1,000 objects. (§5.3, §7) |
| 9 | Drag and hover state in React `useState`. The render effect has 13 dependencies. | `AppCanvas.tsx` | A whole React re-render on every mouse move | Canvas rendered outside React on `requestAnimationFrame` (§7) |
| 10 | Snap to a 20px grid | `utils.ts › findSnapTarget` | Non-Euclidean points sneak into "pure" constructions | No grid snapping in construction mode. Grid is a visual aid only, if shown at all. |
| 11 | Theme read once in the renderer constructor. Hard-coded `rgba(...)` greys. | `renderer.ts` | Some objects nearly invisible in one theme. Theme switch needs a reload. | Token system + contrast test (§4.4) |
| 12 | Zoom additive ±0.1 within [0.1, 10] | `AppCanvas.tsx` | Jerky at low zoom, sluggish at high zoom | Multiplicative, bounded (§4.5) |
| 13 | Mouse events only | `AppCanvas.tsx` | No touch or tablet support | Pointer Events (one API for mouse, touch and pen) from day one |
| 14 | No step list, no L/E, no save | — | The core "how did I solve it" value was missing | The steps list *is* the document (§5.2) |

### 13.3 What worked and is worth keeping (as ideas)

- **Hover an object in the Intersect tool to preview all its intersections**, then click the one you want. This was a good interaction. It becomes the "virtual intersections" snap in D1, applied to every tool.
- **One undo entry per construction and per drag.** The right granularity.
- **Reuse an existing point instead of stacking a duplicate** on top of it. The idea is right, but the tolerance must be done properly (row 4).
- **Visual difference between free and derived points.** Keep it, and add a shape difference, not only color.
- Stack choices (Vite, React, TypeScript, Zustand, Canvas 2D) were fine. The problems were structural, not the libraries.
- Point labels with subscripts (A₁, B₂): keep, as a v1 nicety.

### 13.4 Guardrails so it doesn't happen again

1. **Engine contract review:** any PR that adds a new object *type* (not a tool) needs a written justification. The default answer is no.
2. **Each file has one job.** Soft cap about 300 lines per file. A bigger file is a signal to split, not a rule to game.
3. **No feature merges without tests** for its geometry.
4. **AI-assisted fixes must come with a failing test first** that reproduces the bug. That keeps "fix" commits honest.
5. **Performance benchmark in CI** (1,000-object drag) so O(n²) regressions fail the build.

---

## 14. Open questions for you

1. D3: should segments intersect beyond their ends?
2. D6: do you want the sketch layer at all, and in which milestone?
3. Primary device: laptop with mouse/trackpad, or iPad with pencil? This changes M4 priorities.
4. Should problem mode (M7) come *before* accounts (M6)? If solving problems matters more to you than syncing, swap them. Problems can work with local saves only.
5. Is a public release a goal, or personal use first? That decides how much onboarding and polish goes into M4.
6. D11: include the free-form (typed number) GeoGebra tools with a `*` flag, or leave them out entirely?
7. Zoom range 0.1×–20×: does that feel right, or do you want tighter limits like Euclidea's?
8. Which 2 More tools would you pin first? That tells us which Tier B tools to build first in M5.
